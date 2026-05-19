import logging

from viu_media.core.security import check_response_size, validate_url

from ...types import EpisodeStream, Server
from ..constants import API_BASE_URL, API_GRAPHQL_REFERER
from ..types import AllAnimeEpisode, AllAnimeSource
from .base import BaseExtractor

logger = logging.getLogger(__name__)


class SsHlsExtractor(BaseExtractor):
    @classmethod
    def extract(
        cls,
        url,
        client,
        episode_number: str,
        episode: AllAnimeEpisode,
        source: AllAnimeSource,
    ) -> Server:
        # TODO: requires some serious work i think : )
        response = client.get(
            url,
            timeout=10,
        )
        response.raise_for_status()
        check_response_size(response, label="StreamSb stream API")
        streams = response.json()["links"]

        validated_links = []
        for link in streams["links"]:
            try:
                validated_links.append(
                    EpisodeStream(link=validate_url(link), quality="1080")
                )
            except ValueError as e:
                logger.error(f"Invalid URL in StreamSb stream: {e}")

        return Server(
            name="StreamSb",
            links=validated_links,
            episode_title=episode["notes"],
            headers={},
        )
