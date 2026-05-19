import logging

from viu_media.core.security import validate_url

from ...types import EpisodeStream, Server
from ..constants import API_BASE_URL, API_GRAPHQL_REFERER
from ..types import AllAnimeEpisode, AllAnimeSource
from .base import BaseExtractor

logger = logging.getLogger(__name__)


class YtExtractor(BaseExtractor):
    @classmethod
    def extract(
        cls,
        url,
        client,
        episode_number: str,
        episode: AllAnimeEpisode,
        source: AllAnimeSource,
    ) -> Server:
        try:
            validated_url = validate_url(url)
        except ValueError as e:
            logger.error(f"Invalid URL in Yt stream: {e}")
            raise
        return Server(
            name="Yt",
            links=[EpisodeStream(link=validated_url, quality="1080")],
            episode_title=episode["notes"],
            headers={"Referer": "https://youtu-chan.com"},
        )
