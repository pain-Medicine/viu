"""Content-type and magic-bytes validation for downloaded files."""

from typing import AbstractSet

# --- Subtitle constants ---
SUBTITLE_CONTENT_TYPES: set[str] = {
    "text/plain",
    "text/vtt",
    "application/x-subrip",
    "text/x-ssa",
}

SUBTITLE_MAGIC: tuple[bytes, ...] = (
    b"\xef\xbb\xbf",  # UTF-8 BOM
    b"WEBVTT",
    b"1\r\n",
    b"1\n",
    b"[Script",
)

# --- Image constants ---
IMAGE_CONTENT_TYPES: set[str] = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

IMAGE_MAGIC: tuple[bytes, ...] = (
    b"\xff\xd8",    # JPEG
    b"\x89PNG",     # PNG
    b"GIF8",        # GIF87a / GIF89a
    b"RIFF",        # WebP (RIFF container) — we also check for WEBP at offset 8
)


# --- Private helpers ---

def _check_content_type(
    response, allowed_types: AbstractSet[str], label: str
) -> None:
    """Raise ValueError if the Content-Type header is not in *allowed_types*."""
    raw = response.headers.get("content-type", "")
    # Strip charset suffix: "text/plain; charset=utf-8" -> "text/plain"
    content_type = raw.split(";")[0].strip().lower()
    if content_type not in allowed_types:
        raise ValueError(
            f"{label} has disallowed Content-Type: {content_type!r}"
        )


def _check_magic(
    first_bytes: bytes, magic_set: tuple[bytes, ...], label: str
) -> None:
    """Raise ValueError if *first_bytes* does not start with any entry in *magic_set*."""
    for magic in magic_set:
        if first_bytes.startswith(magic):
            return
    raise ValueError(
        f"{label} failed magic-bytes check (first 16 bytes: {first_bytes[:16]!r})"
    )


# --- Public API ---

def validate_subtitle(response) -> None:
    """Validate that *response* looks like a subtitle file.

    Checks both the Content-Type header and magic bytes of response.content.

    Raises:
        ValueError: If either check fails.
    """
    _check_content_type(response, SUBTITLE_CONTENT_TYPES, "Subtitle")
    _check_magic(response.content, SUBTITLE_MAGIC, "Subtitle")


def validate_image(response) -> None:
    """Validate that *response* looks like an image file.

    Checks both the Content-Type header and magic bytes of response.content.

    Raises:
        ValueError: If either check fails.
    """
    _check_content_type(response, IMAGE_CONTENT_TYPES, "Image")
    content = response.content
    # WebP magic: starts with RIFF and has WEBP at offset 8
    if content[:4] == b"RIFF":
        if len(content) >= 12 and content[8:12] == b"WEBP":
            return
        raise ValueError(
            f"Image failed magic-bytes check: RIFF container but not WEBP "
            f"(first 16 bytes: {content[:16]!r})"
        )
    _check_magic(content, IMAGE_MAGIC[:3], "Image")  # JPEG, PNG, GIF only
