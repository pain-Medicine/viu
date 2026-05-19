"""Safe JS object literal parser — replaces eval() with pyjson5.loads()."""

import pyjson5


def parse_js_object(js_str: str) -> dict:
    """Parse a JavaScript object literal string into a Python dict.

    Uses pyjson5.loads() which handles unquoted keys, trailing commas,
    and JS constants (null/true/false) natively — without code execution.

    Raises:
        ValueError: If parsing fails or the result is not a dict.
    """
    try:
        result = pyjson5.loads(js_str)
    except Exception as e:
        raise ValueError(f"Failed to parse JS object: {e}") from e
    if not isinstance(result, dict):
        raise ValueError(f"Expected JS object, got {type(result).__name__}")
    return result
