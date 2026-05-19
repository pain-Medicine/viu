import logging

from viu_media.core.security import check_response_size, validate_url

from ...types import EpisodeStream, Server
from ..constants import API_BASE_URL, API_GRAPHQL_REFERER, MP4_SERVER_JUICY_STREAM_REGEX
from ..types import AllAnimeEpisode, AllAnimeSource
from .base import BaseExtractor

logger = logging.getLogger(__name__)


# TODO: requires decoding obsfucated js (filemoon)
class FmHlsExtractor(BaseExtractor):
    @classmethod
    def extract(
        cls,
        url,
        client,
        episode_number: str,
        episode: AllAnimeEpisode,
        source: AllAnimeSource,
    ) -> Server:
        response = client.get(
            f"https://{API_BASE_URL}{url.replace('clock', 'clock.json')}",
            timeout=10,
        )
        response.raise_for_status()
        check_response_size(response, label="FmHls embed page")

        embed_html = response.text.replace(" ", "").replace("\n", "")
        vid = MP4_SERVER_JUICY_STREAM_REGEX.search(embed_html)
        if not vid:
            raise Exception("")
        try:
            validated_link = validate_url(vid.group(1))
        except ValueError as e:
            logger.error(f"Invalid URL in FmHls stream: {e}")
            raise
        return Server(
            name="dropbox",
            links=[EpisodeStream(link=validated_link, quality="1080")],
            episode_title=episode["notes"],
            headers={"Referer": "https://www.mp4upload.com/"},
        )


# TODO: requires decoding obsfucated js (filemoon)
class OkExtractor(BaseExtractor):
    @classmethod
    def extract(
        cls,
        url,
        client,
        episode_number: str,
        episode: AllAnimeEpisode,
        source: AllAnimeSource,
    ) -> Server:
        response = client.get(
            f"https://{API_BASE_URL}{url.replace('clock', 'clock.json')}",
            timeout=10,
        )
        response.raise_for_status()
        check_response_size(response, label="Ok embed page")

        embed_html = response.text.replace(" ", "").replace("\n", "")
        vid = MP4_SERVER_JUICY_STREAM_REGEX.search(embed_html)
        if not vid:
            raise Exception("")
        try:
            validated_link = validate_url(vid.group(1))
        except ValueError as e:
            logger.error(f"Invalid URL in Ok stream: {e}")
            raise
        return Server(
            name="dropbox",
            links=[EpisodeStream(link=validated_link, quality="1080")],
            episode_title=episode["notes"],
            headers={"Referer": "https://www.mp4upload.com/"},
        )
