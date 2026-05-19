import logging

from viu_media.core.security import check_response_size, validate_url

from ...types import EpisodeStream, Server
from ..constants import MP4_SERVER_JUICY_STREAM_REGEX
from ..utils import logger as _legacy_logger
from .base import BaseExtractor

logger = logging.getLogger(__name__)


class Mp4Extractor(BaseExtractor):
    @classmethod
    def extract(cls, url, client, episode_number, episode, source):
        response = client.get(url, timeout=10, follow_redirects=True)
        response.raise_for_status()
        check_response_size(response, label="mp4-upload embed page")

        embed_html = response.text.replace(" ", "").replace("\n", "")

        # NOTE: some of the video were deleted so the embed html will just be "Filewasdeleted"
        vid = MP4_SERVER_JUICY_STREAM_REGEX.search(embed_html)
        if not vid:
            if embed_html == "Filewasdeleted":
                _legacy_logger.debug(
                    "Failed to extract stream url from mp4-uploads. Reason: Filewasdeleted"
                )
                return
            _legacy_logger.debug(
                f"Failed to extract stream url from mp4-uploads. Reason: unknown. Embed html: {embed_html}"
            )
            return
        try:
            validated_link = validate_url(vid.group(1))
        except ValueError as e:
            logger.error(f"Invalid URL in mp4-upload stream: {e}")
            return
        return Server(
            name="mp4-upload",
            links=[EpisodeStream(link=validated_link, quality="1080")],
            episode_title=episode["notes"],
            headers={"Referer": "https://www.mp4upload.com/"},
        )
