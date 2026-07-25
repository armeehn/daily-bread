"""Ed25519 in pure Python, so the signer needs nothing but the standard library.

The original newsproof used the `cryptography` package. Daily Bread's build host
has no `pip` and no way to install one, and the project's whole ethos is
dependency-free (the browser verifier is WebCrypto and nothing else). So the
signing side is the RFC 8032 reference implementation, transcribed verbatim from
the specification's appendix. It is slow -- a handful of seconds to sign sixteen
editions -- and that is entirely fine for a magazine that ships four times a year.

What matters is that the bytes are *standard* Ed25519: a signature produced here
verifies unchanged under `crypto.subtle.verify({name:"Ed25519"}, ...)` in the
browser and under the `cryptography` library in the offline reference verifier.
The public key is the raw 32-byte encoding, exactly what both of those expect.
That cross-implementation check -- browser WebCrypto validating a signature this
file produced -- is the acceptance test the build actually relies on.
"""

from __future__ import annotations

import hashlib

# --- field and curve constants (RFC 8032, Curve25519 / edwards25519) -------
_b = 256
_q = 2 ** 255 - 19
_L = 2 ** 252 + 27742317777372353535851937790883648493


def _sha512(m: bytes) -> bytes:
    return hashlib.sha512(m).digest()


def _inv(x: int) -> int:
    return pow(x, _q - 2, _q)


_d = -121665 * _inv(121666) % _q
_I = pow(2, (_q - 1) // 4, _q)


def _xrecover(y: int) -> int:
    xx = (y * y - 1) * _inv(_d * y * y + 1)
    x = pow(xx, (_q + 3) // 8, _q)
    if (x * x - xx) % _q != 0:
        x = (x * _I) % _q
    if x % 2 != 0:
        x = _q - x
    return x


_By = 4 * _inv(5) % _q
_Bx = _xrecover(_By)
_B = (_Bx % _q, _By % _q)


def _edwards_add(P, Q):
    x1, y1 = P
    x2, y2 = Q
    denom = _inv(1 + _d * x1 * x2 * y1 * y2)
    x3 = (x1 * y2 + x2 * y1) * denom % _q
    y3 = (y1 * y2 + x1 * x2) * _inv(1 - _d * x1 * x2 * y1 * y2) % _q
    return (x3 % _q, y3 % _q)


def _scalarmult(P, e: int):
    # Iterative double-and-add; avoids Python's recursion limit for 252-bit e.
    Q = (0, 1)  # neutral element
    for i in reversed(range(e.bit_length())):
        Q = _edwards_add(Q, Q)
        if (e >> i) & 1:
            Q = _edwards_add(Q, P)
    return Q


def _encodeint(y: int) -> bytes:
    return y.to_bytes(_b // 8, "little")


def _encodepoint(P) -> bytes:
    x, y = P
    val = y | ((x & 1) << (_b - 1))
    return val.to_bytes(_b // 8, "little")


def _bit(h: bytes, i: int) -> int:
    return (h[i // 8] >> (i % 8)) & 1


def _secret_scalar(h: bytes) -> int:
    return 2 ** (_b - 2) + sum(2 ** i * _bit(h, i) for i in range(3, _b - 2))


def _hint(m: bytes) -> int:
    return int.from_bytes(_sha512(m), "little")


def publickey(seed: bytes) -> bytes:
    """Derive the 32-byte public key from a 32-byte seed (RFC 8032 secret key)."""
    if len(seed) != 32:
        raise ValueError("seed must be 32 bytes")
    h = _sha512(seed)
    a = _secret_scalar(h)
    return _encodepoint(_scalarmult(_B, a))


def sign(seed: bytes, public: bytes, message: bytes) -> bytes:
    """Return the 64-byte Ed25519 signature over `message`."""
    if len(seed) != 32:
        raise ValueError("seed must be 32 bytes")
    h = _sha512(seed)
    a = _secret_scalar(h)
    r = _hint(h[_b // 8 : _b // 4] + message)
    R = _scalarmult(_B, r)
    S = (r + _hint(_encodepoint(R) + public + message) * a) % _L
    return _encodepoint(R) + _encodeint(S)


def _isoncurve(P) -> bool:
    x, y = P
    return (-x * x + y * y - 1 - _d * x * x * y * y) % _q == 0


def _decodepoint(s: bytes):
    y = int.from_bytes(s, "little") & ((1 << (_b - 1)) - 1)
    x = _xrecover(y)
    if x & 1 != (s[(_b - 1) // 8] >> ((_b - 1) % 8)) & 1:
        x = _q - x
    P = (x, y)
    if not _isoncurve(P):
        raise ValueError("point is not on the curve")
    return P


def verify(public: bytes, message: bytes, signature: bytes) -> bool:
    """True iff `signature` is a valid Ed25519 signature over `message`."""
    try:
        if len(signature) != 64 or len(public) != 32:
            return False
        R = _decodepoint(signature[:32])
        A = _decodepoint(public)
        S = int.from_bytes(signature[32:], "little")
        if S >= _L:
            return False
        h = _hint(signature[:32] + public + message)
        return _scalarmult(_B, S) == _edwards_add(R, _scalarmult(A, h))
    except (ValueError, IndexError):
        return False


def _selftest() -> None:
    """Round-trip plus a tamper check. Standard-conformance (interop with
    WebCrypto and `cryptography`) is proven separately by the browser verifier."""
    seed = hashlib.sha256(b"newsproof-ed25519-selftest-seed").digest()
    pub = publickey(seed)
    msg = b"the quick brown fox"
    sig = sign(seed, pub, msg)
    assert verify(pub, msg, sig), "round-trip verify failed"
    assert not verify(pub, msg + b"!", sig), "tampered message verified"
    bad = bytearray(sig)
    bad[0] ^= 1
    assert not verify(pub, msg, bytes(bad)), "tampered signature verified"
    assert len(pub) == 32 and len(sig) == 64


if __name__ == "__main__":
    _selftest()
    print("ed25519 self-test passed")
