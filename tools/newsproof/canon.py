"""Canonical serialisation (RFC 8785, restricted).

Unchanged from upstream newsproof, and deliberately so: the whole point of a
canonical form is that two honest implementations serialise the same object into
the same bytes. The browser verifier's `canonical()` in verify.js mirrors this
function exactly. Floats are rejected outright rather than risk ES6 number
formatting disagreeing with Python.
"""

from __future__ import annotations

import hashlib
import json

SCHEMA = "newsproof/v1"

# Domain separation. Every signature covers a tagged message, so a signature made
# over a statement can never be replayed as a signature over a tree head.
DOMAIN_STATEMENT = b"newsproof/v1/statement\x00"
DOMAIN_STH = b"newsproof/v1/sth\x00"


def _utf16_key(key: str) -> bytes:
    """RFC 8785 sorts object keys by UTF-16 code unit, not code point."""
    return key.encode("utf-16-be")


def _normalise(value):
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        raise TypeError("floats are not allowed in canonical records")
    if isinstance(value, (list, tuple)):
        return [_normalise(v) for v in value]
    if isinstance(value, dict):
        items = sorted(value.items(), key=lambda kv: _utf16_key(kv[0]))
        return {k: _normalise(v) for k, v in items}
    raise TypeError(f"cannot canonicalise {type(value).__name__}")


def canonical(obj) -> bytes:
    """Deterministic UTF-8 bytes for a JSON-shaped object."""
    return json.dumps(
        _normalise(obj),
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def content_digest(body: bytes) -> str:
    """Hash of the served bytes exactly as they leave the server."""
    return sha256_hex(body)


def statement_digest(statement: dict) -> str:
    """Stable identifier for one version of one edition."""
    return sha256_hex(canonical(statement))
