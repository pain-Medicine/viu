"""URL scheme and structure validation for extracted URLs."""

from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}


def validate_url(url: str) -> str:
    """Validate that *url* uses an allowed scheme and has a host.

    Blocks javascript:, file://, data:, and malformed/empty URLs.
    Returns the url unchanged on success so it can be used inline::

        stream = EpisodeStream(link=validate_url(raw_link), ...)

    Raises:
        ValueError: If the URL is empty, has a disallowed scheme, or lacks a netloc.
    """
    if not isinstance(url, str) or not url.strip():
        raise ValueError("URL must be a non-empty string")
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"Disallowed URL scheme: {parsed.scheme!r}")
    if not parsed.netloc:
        raise ValueError("URL has no host")
    return url
