import logging

from viu_media.core.security import check_response_size, validate_url

from ...types import EpisodeStream, Server
from ..constants import API_BASE_URL, API_GRAPHQL_REFERER
from ..types import AllAnimeEpisodeStreams
from .base import BaseExtractor

logger = logging.getLogger(__name__)


class Smp4Extractor(BaseExtractor):
    @classmethod
    def extract(cls, url, client, episode_number, episode, source):
        response = client.get(
            f"https://{API_BASE_URL}{url.replace('clock', 'clock.json')}",
            timeout=10,
        )
        response.raise_for_status()
        check_response_size(response, label="sharepoint stream API")
        streams: AllAnimeEpisodeStreams = response.json()
        referer = response.json().get("Referer")

        validated_links = []
        for stream in streams["links"]:
            try:
                validated_links.append(
                    EpisodeStream(
                        link=validate_url(stream["link"]),
                        quality="1080",
                        format=stream["resolutionStr"],
                    )
                )
            except ValueError as e:
                logger.error(f"Invalid URL in sharepoint stream: {e}")

        return Server(
            name="sharepoint",
            links=validated_links,
            episode_title=episode["notes"],
            headers={"Referer": referer} if referer else {},
        )
