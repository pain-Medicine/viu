import logging

from viu_media.core.security import parse_js_object, validate_url

from .constants import (
    DOWNLOAD_FILENAME_REGEX,
    DOWNLOAD_URL_REGEX,
    QUALITY_REGEX,
    VIDEO_INFO_REGEX,
)

logger = logging.getLogger(__name__)


def extract_server_info(html_content: str, episode_title: str | None) -> dict | None:
    """
    Extracts server information from the VixCloud/AnimeUnity embed page.
    Handles extraction from both window.video object and download URL.
    """
    video_info = VIDEO_INFO_REGEX.search(html_content)
    download_url_match = DOWNLOAD_URL_REGEX.search(html_content)

    if not (download_url_match and video_info):
        return None

    try:
        info = parse_js_object(video_info.group(1))
    except ValueError as e:
        logger.error(f"Failed to parse video info: {e}")
        return None

    try:
        download_url = validate_url(download_url_match.group(1))
    except ValueError as e:
        logger.error(f"Invalid download URL: {e}")
        return None

    info["link"] = download_url

    # Extract metadata from download URL if missing in window.video
    if filename_match := DOWNLOAD_FILENAME_REGEX.search(download_url):
        info["name"] = filename_match.group(1)
    else:
        info["name"] = f"{episode_title or 'Unknown'}"

    if quality_match := QUALITY_REGEX.search(download_url):
        # "720p" -> 720
        info["quality"] = int(quality_match.group(1)[:-1])
    else:
        info["quality"] = 0  # Fallback

    return info
