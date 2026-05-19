# Scraper Security Hardening Design

**Date:** 2026-05-19
**Status:** Approved

## Context

FastAnime scrapes anime streaming sites using httpx, curl_cffi, yt-dlp, and Python regex/BS4. Two constraints cannot be changed:

- **SSL certificate verification is disabled** — Cloudflare blocks requests with verification enabled.
- **Unlimited redirects are required** — Provider sites use arbitrary redirect chains.

Because we cannot harden the transport layer, all security must be enforced at the **application layer** — validating the shape and content of data after it is received.

## Threat Model

Both of the following are in scope:

1. **Compromised provider sites** — A site we intentionally scrape serves malicious HTML/JS (hacked, or acting adversarially to avoid DMCA).
2. **Network adversaries (MITM)** — With SSL off, an attacker on the local network or ISP level can inject arbitrary responses.

Domain allowlisting is not viable: stream CDN domains rotate rapidly to avoid DMCA takedowns.

## Known Vulnerabilities

| Severity | Location | Issue |
|----------|----------|-------|
| Critical | `animeunity/extractor.py:30` | `eval(info_str, ctx)` on scraped HTML — ctx does not strip Python builtins |
| Medium | All extractors | Extracted URLs not validated for scheme before use |
| Medium | `yt_dlp.py:_download_subs()` | Subtitle files written to disk without content-type or magic bytes check |
| Medium | `cli/utils/image.py` | Image responses written without content validation |
| Medium | All scraping requests | No response size cap — memory exhaustion possible via huge responses |

## Chosen Approach: Defense-in-Depth Content Validation Layer

A new `viu_media/core/security/` package acts as the single auditable gate for all scraped content. All extractors and the downloader route through it. No changes to SSL settings, redirect behaviour, or provider logic.

## Module Layout

```
viu_media/core/security/
    __init__.py           # exports: parse_js_object, validate_url, validate_download, check_response_size
    js_parser.py          # safe JS object literal parsing (replaces eval)
    url_validator.py      # scheme + structural validation for extracted URLs
    content_validator.py  # content-type + magic bytes validation for downloaded files
    response_validator.py # response size caps for scraping requests
```

## Component Designs

### 1. JS Safe Parser (`js_parser.py`)

Replaces `eval(info_str, ctx)` in `animeunity/extractor.py`. Uses `pyjson5.loads()` — a pure parser with no code execution path. Handles unquoted keys, trailing commas, and JS `null`/`true`/`false` natively.

The existing `VIDEO_INFO_CLEAN_REGEX` pre-processing step is removed — pyjson5 makes it unnecessary.

```python
import pyjson5

def parse_js_object(js_str: str) -> dict:
    try:
        result = pyjson5.loads(js_str)
    except Exception as e:
        raise ValueError(f"Failed to parse JS object: {e}") from e
    if not isinstance(result, dict):
        raise ValueError(f"Expected JS object, got {type(result).__name__}")
    return result
```

**Note:** `animepahe/extractor.py` uses pure string substitution with no eval — no change needed.

### 2. URL Validator (`url_validator.py`)

Validates structure only (no domain allowlisting). Blocks `javascript:`, `file://`, `data:`, and malformed URLs before they reach any HTTP client or player.

```python
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}

def validate_url(url: str) -> str:
    if not isinstance(url, str) or not url.strip():
        raise ValueError("URL must be a non-empty string")
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"Disallowed URL scheme: {parsed.scheme!r}")
    if not parsed.netloc:
        raise ValueError("URL has no host")
    return url
```

Applied at every point where a URL is extracted from scraped content and placed into a `Server` or `EpisodeStream` object.

### 3. Content/Download Validator (`content_validator.py`)

Validates both the declared `Content-Type` header and actual magic bytes before writing any file to disk. A malicious server cannot bypass this by lying about content type.

Subtitle magic patterns cover SRT, VTT, ASS/SSA, and UTF-8 BOM variants.
Image magic patterns cover JPEG, PNG, GIF, and WebP.

Two public functions: `validate_subtitle(response)` and `validate_image(response)`. Both raise `ValueError` on failure.

Internal helpers (not exported):
- `_check_content_type(response, allowed_types, label)` — strips charset suffix from `Content-Type` header, checks membership in `allowed_types`
- `_check_magic(first_bytes, magic_set, label)` — checks whether `first_bytes` starts with any entry in `magic_set`

### 4. Response Size Cap (`response_validator.py`)

Applied only to scraping requests (HTML pages, JSON API responses, embed pages) — not to video downloads handled by yt-dlp.

```python
MAX_SCRAPE_BYTES = 5 * 1024 * 1024  # 5 MB

def check_response_size(response, label: str = "response") -> None:
    size = len(response.content)
    if size > MAX_SCRAPE_BYTES:
        raise ValueError(f"{label} too large: {size} bytes (max {MAX_SCRAPE_BYTES})")
```

## Integration Points

| File | Change |
|------|--------|
| `animeunity/extractor.py:30` | Replace `eval(info_str, ctx)` with `parse_js_object(info_str)`; remove `VIDEO_INFO_CLEAN_REGEX` pre-processing |
| `animeunity/extractor.py` | Wrap `download_url_match.group(1)` through `validate_url()` before assigning to `info["link"]` |
| `animepahe/extractor.py` | Wrap any stream URL extracted from decoded JS through `validate_url()` before returning |
| All allanime extractors (ak, dropbox, filemoon, mp4_upload, streamsb, vid_mp4, we_transfer, wixmp, yt_mp4) | Wrap every extracted URL through `validate_url()` before placing in `EpisodeStream.link` |
| `yt_dlp.py:_download_subs()` | Call `validate_subtitle(response)` before writing |
| `cli/utils/image.py` | Call `validate_image(response)` before writing |
| Scraping HTML/JSON requests in all providers | Call `check_response_size(response)` before accessing `.text` or `.content` on any page/API/embed fetch; not applied to binary content fetched by yt-dlp |

## Error Handling

All validators raise `ValueError` with a descriptive message. Callers catch this and:
- Log at `ERROR` level (visible during development when a provider changes format)
- Return `None` or an empty result — consistent with existing extractor patterns

No silent swallowing. No new exception types.

## Dependencies

Add `pyjson5` to project dependencies. All other components use stdlib only (`urllib.parse`, `re`).

## Testing Strategy

One test file per module under `tests/core/security/`:

| Test file | Key cases |
|-----------|-----------|
| `test_js_parser.py` | Valid JS object, unquoted keys, `null`/`true`/`false`, malicious `__import__` attempt, malformed input |
| `test_url_validator.py` | Valid http/https, `javascript:`, `file://`, `data:`, empty string, no netloc |
| `test_content_validator.py` | Correct magic bytes accepted, wrong magic rejected, mismatched content-type rejected |
| `test_response_validator.py` | Under-limit accepted, over-limit raises, edge at exactly the limit |

All tests are pure unit tests on strings/bytes — no HTTP mocking required.
