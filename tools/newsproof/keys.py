"""Ed25519 keys, pure-Python edition.

Same two-key discipline as upstream newsproof, same public-key JSON on disk (so
the browser verifier and the reference `cryptography`-based verifier both read it
unchanged). The only difference is mechanical: signing runs on `ed25519.py`
rather than the `cryptography` package, and the private half is stored as its
raw 32-byte seed rather than a PKCS#8 PEM.

  publisher key   signs edition statements. Belongs offline. Compromising the
                  web host must not let anyone mint a valid edition.
  log key         signs tree heads. Necessarily online as the log grows. Its
                  compromise is survivable: a forged tree head still cannot be
                  made consistent with a root already anchored in public.

The private-key files live outside the served site and are git-ignored. Treat
them the way the threat model says: the publisher seed belongs on something that
is not the thing serving traffic.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path

from . import ed25519


def key_id(public_raw: bytes) -> str:
    return hashlib.sha256(public_raw).hexdigest()[:16]


class SigningKey:
    """A loaded private key. `.sign(msg)` returns raw signature bytes."""

    def __init__(self, seed: bytes, public: bytes) -> None:
        self.seed = seed
        self.public = public

    def sign(self, message: bytes) -> bytes:
        return ed25519.sign(self.seed, self.public, message)


def generate(private_path: Path, public_path: Path, passphrase: str | None = None) -> str:
    """Create a fresh keypair. `passphrase` is accepted for signature-compatibility
    with the upstream CLI but ignored: the seed is stored raw in a git-ignored
    file that never reaches the server, which is the protection that matters."""
    seed = os.urandom(32)
    public = ed25519.publickey(seed)
    kid = key_id(public)

    private_path.parent.mkdir(parents=True, exist_ok=True)
    private_path.write_text(
        json.dumps(
            {
                "schema": "newsproof/v1/seckey",
                "algorithm": "ed25519",
                "key_id": kid,
                "seed_b64": base64.b64encode(seed).decode(),
                "public_key_b64": base64.b64encode(public).decode(),
            },
            indent=2,
        )
        + "\n"
    )
    os.chmod(private_path, 0o600)

    public_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.write_text(
        json.dumps(
            {
                "schema": "newsproof/v1/pubkey",
                "algorithm": "ed25519",
                "key_id": kid,
                "public_key_b64": base64.b64encode(public).decode(),
            },
            indent=2,
        )
        + "\n"
    )
    return kid


def load_private(path: Path, passphrase: str | None = None) -> SigningKey:
    doc = json.loads(Path(path).read_text())
    if doc.get("algorithm") != "ed25519":
        raise ValueError("unsupported key algorithm")
    seed = base64.b64decode(doc["seed_b64"])
    public = ed25519.publickey(seed)
    if "public_key_b64" in doc and base64.b64decode(doc["public_key_b64"]) != public:
        raise ValueError("seed does not match stored public key")
    return SigningKey(seed, public)


def load_public(path: Path) -> tuple[bytes, str]:
    doc = json.loads(Path(path).read_text())
    if doc.get("algorithm") != "ed25519":
        raise ValueError("unsupported key algorithm")
    raw = base64.b64decode(doc["public_key_b64"])
    if key_id(raw) != doc["key_id"]:
        raise ValueError("key_id does not match the key material")
    return raw, doc["key_id"]


def sign(priv: SigningKey, domain: bytes, message: bytes) -> str:
    return base64.b64encode(priv.sign(domain + message)).decode()


def verify(public: bytes, domain: bytes, message: bytes, signature_b64: str) -> bool:
    try:
        return ed25519.verify(public, domain + message, base64.b64decode(signature_b64))
    except (ValueError, TypeError):
        return False
