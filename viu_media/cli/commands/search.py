from typing import TYPE_CHECKING
import logging

import click


from ...core.config import AppConfig
from ...core.exceptions import ViuError
from ..utils.completion import anime_titles_shell_complete
from . import examples

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from typing import TypedDict

    from viu_media.cli.service.feedback.service import FeedbackService
    from typing_extensions import Unpack

    from ...libs.provider.anime.base import BaseAnimeProvider
    from ...libs.provider.anime.types import Anime
    from ...libs.selectors.base import BaseSelector

    class Options(TypedDict):
        anime_title: list[str]
        episode_range: str | None


@click.command(
    help="This subcommand directly interacts with the provider to enable basic streaming. Useful for binging anime.",
    short_help="Binge anime",
    epilog=examples.search,
)
@click.option(
    "--anime-title",
    "-t",
    shell_complete=anime_titles_shell_complete,
    multiple=True,
    help="Specify which anime to download",
)
@click.option(
    "--episode-range",
    "-r",
    help="A range of episodes to binge (start-end)",
)
@click.pass_obj
def search(config: AppConfig, **options: "Unpack[Options]"):
    from viu_media.cli.service.feedback.service import FeedbackService

    from ...core.exceptions import ViuError
    from ...libs.provider.anime.params import (
        AnimeParams,
        SearchParams,
    )
    from ...libs.provider.anime.provider import create_provider
    from viu_media.core.utils.normalizer import normalize_title
    from ...libs.selectors.selector import create_selector

    if not options["anime_title"]:
        raw = click.prompt("What are you in the mood for? (comma-separated)")
        options["anime_title"] = [a.strip() for a in raw.split(",") if a.strip()]

    feedback = FeedbackService(config)
    provider = create_provider(config.general.provider)
    selector = create_selector(config)

    anime_titles = options["anime_title"]
    logger.debug(f"Search command initiated. Anime titles to search: {anime_titles}, Episode range: {options.get('episode_range')}")
    feedback.info(f"[green bold]Streaming:[/] {anime_titles}")
    for anime_title in anime_titles:
        logger.debug(f"Processing anime: {anime_title}")
        # ---- search for anime ----
        feedback.info(f"[green bold]Searching for:[/] {anime_title}")
        with feedback.progress(f"Fetching anime search results for {anime_title}"):
            search_results = provider.search(
                SearchParams(
                    query=normalize_title(
                        anime_title, config.general.provider.value, True
                    ).lower(),
                    translation_type=config.stream.translation_type,
                )
            )
        logger.debug(f"Search returned {len(search_results.results) if search_results else 0} results for '{anime_title}'")
        if not search_results:
            logger.error(f"No results found for {anime_title}")
            raise ViuError("No results were found matching your query")

        _search_results = {
            search_result.title: search_result
            for search_result in search_results.results
        }

        selected_anime_title = selector.choose(
            "Select Anime", list(_search_results.keys())
        )
        if not selected_anime_title:
            raise ViuError("No title selected")
        anime_result = _search_results[selected_anime_title]

        # ---- fetch selected anime ----
        with feedback.progress(f"Fetching {anime_result.title}"):
            logger.debug(f"Fetching details for anime ID: {anime_result.id}, Title: {anime_result.title}")
            anime = provider.get(AnimeParams(id=anime_result.id, query=anime_title))

        if not anime:
            logger.error(f"Failed to fetch details for {anime_result.title}")
            raise ViuError(f"Failed to fetch anime {anime_result.title}")

        available_episodes: list[str] = sorted(
            getattr(anime.episodes, config.stream.translation_type), key=float
        )

        if options["episode_range"]:
            from ..utils.parser import parse_episode_range

            try:
                episodes_range = parse_episode_range(
                    options["episode_range"], available_episodes
                )

                for episode in episodes_range:
                    stream_anime(
                        config,
                        provider,
                        selector,
                        feedback,
                        anime,
                        episode,
                        anime_title,
                    )
            except (ValueError, IndexError) as e:
                raise ViuError(f"Invalid episode range: {e}") from e
        else:
            episode = selector.choose(
                "Select Episode",
                getattr(anime.episodes, config.stream.translation_type),
            )
            logger.debug(f"User selected episode: {episode}")
            if not episode:
                raise ViuError("No episode selected")
            stream_anime(
                config, provider, selector, feedback, anime, episode, anime_title
            )


def stream_anime(
    config: AppConfig,
    provider: "BaseAnimeProvider",
    selector: "BaseSelector",
    feedback: "FeedbackService",
    anime: "Anime",
    episode: str,
    anime_title: str,
):
    from viu_media.cli.service.player.service import PlayerService

    from ...libs.player.params import PlayerParams
    from ...libs.provider.anime.params import EpisodeStreamsParams

    logger.debug(f"Starting stream_anime for {anime.title}, episode {episode}")
    player_service = PlayerService(config, provider)

    with feedback.progress("Fetching episode streams"):
        streams = provider.episode_streams(
            EpisodeStreamsParams(
                anime_id=anime.id,
                query=anime_title,
                episode=episode,
                translation_type=config.stream.translation_type,
            )
        )
        logger.debug(f"Fetched {len(streams) if streams else 0} streams for {anime.title} ep {episode}")
        if not streams:
            logger.error(f"No streams found for {anime.title} ep {episode}")
            raise ViuError(
                f"Failed to get streams for anime: {anime.title}, episode: {episode}"
            )

    if config.stream.server.value == "TOP":
        with feedback.progress("Fetching top server"):
            server = next(streams, None)
            if not server:
                raise ViuError(
                    f"Failed to get server for anime: {anime.title}, episode: {episode}"
                )
    else:
        with feedback.progress("Fetching servers"):
            servers = {server.name: server for server in streams}
        servers_names = list(servers.keys())
        if config.stream.server.value in servers_names:
            server = servers[config.stream.server.value]
        else:
            server_name = selector.choose("Select Server", servers_names)
            if not server_name:
                raise ViuError("Server not selected")
            server = servers[server_name]
    quality = [
        ep_stream.link
        for ep_stream in server.links
        if ep_stream.quality == config.stream.quality
    ]
    if not quality:
        feedback.warning("Preferred quality not found, selecting quality...")
        stream_link = selector.choose(
            "Select Quality", [link.quality for link in server.links]
        )
        if not stream_link:
            raise ViuError("Quality not selected")
        stream_link = next(
            (link.link for link in server.links if link.quality == stream_link), None
        )

    stream_link = server.links[0].link
    if not stream_link:
        logger.error("Failed to extract stream link from server object.")
        raise ViuError(
            f"Failed to get stream link for anime: {anime.title}, episode: {episode}"
        )
    logger.debug(f"Selected stream link: {stream_link}")
    feedback.info(f"[green bold]Now Streaming:[/] {anime.title} Episode: {episode}")

    logger.debug("Handing off to player_service.play")
    player_service.play(
        PlayerParams(
            url=stream_link,
            title=f"{anime.title}; Episode {episode}",
            query=anime_title,
            episode=episode,
            subtitles=[sub.url for sub in server.subtitles],
            headers=server.headers,
        ),
        anime,
    )
