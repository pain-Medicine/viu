"""Response size cap for scraping requests (HTML, JSON, embeds)."""

MAX_SCRAPE_BYTES = 5 * 1024 * 1024  # 5 MB


def check_response_size(response, label: str = "response") -> None:
    """Raise ValueError if *response.content* exceeds the scraping size cap.

    Applied to HTML pages, JSON API responses, and embed pages —
    NOT to binary downloads handled by yt-dlp.

    Raises:
        ValueError: If the response body exceeds MAX_SCRAPE_BYTES.
    """
    size = len(response.content)
    if size > MAX_SCRAPE_BYTES:
        raise ValueError(
            f"{label} too large: {size} bytes (max {MAX_SCRAPE_BYTES})"
        )
