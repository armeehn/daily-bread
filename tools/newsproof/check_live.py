#!/usr/bin/env python3
"""Check the LIVE site against the published proofs.

    python3 -m newsproof.check_live                 # against the deployed site
    python3 -m newsproof.check_live --offline       # repo vs proofs only, no network
    python3 -m newsproof.check_live --base http://localhost:8788

`dbproof status` verifies the log against itself and never re-hashes anything, so
it reads perfectly healthy while every reader sees "This edition could not be
verified". This is the check that actually catches that, and it is the same
comparison the reader's badge makes: the bytes served right now must still hash
to the value inside the signed statement.

It compares THREE hashes per edition, because the two ways this breaks want very
different responses:

  proof   statement.content_sha256 from .well-known/newsproof/proofs/<code>.json
  built   sha256 of the file in this checkout
  served  sha256 of the bytes the live site returns

  served == proof                  OK.
  served == built != proof         STALE PROOF. The edition was rebuilt and
                                   published but never re-signed. Publishing
                                   hygiene, not an attack. Only the off-box
                                   publisher key can clear it: `dbproof sign`.
  served != built                  SERVED BYTES DIFFER FROM THE REPO. This is the
                                   loud one -- a bad deploy, a poisoned cache, an
                                   edge that is rewriting the page, or actual
                                   tampering.

Exit status: 0 all verified, 1 stale proofs only, 2 at least one edition whose
served bytes do not match the repo.

No dependencies, on purpose -- same rule as verify_standalone.py.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_BASE = "https://db.ripostelabs.xyz"
WELL_KNOWN = ".well-known/newsproof"

# Cloudflare's two HTML injections, both of which carry a per-request ray id and
# so change the served bytes on every single request. AI Labyrinth is an
# independent dashboard toggle; JS Detections is bound to Bot Fight Mode and on
# the Free plan cannot be disabled at all -- which is why the full editions ship
# `Cache-Control: no-transform` (see emitHeaders() in tools/build.js). If these
# patterns ever match again, that opt-out has stopped working.
INJECTIONS = [
    ("AI Labyrinth", re.compile(rb'<a href="[^"]*/cdn-cgi/content\?id=[^"]*"[^>]*></a>')),
    ("Bot Fight Mode JS Detections",
     re.compile(rb"<script>\(function\(\)\{function c\(\).*?\}\)\(\);</script>", re.S)),
]


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def fetch(url: str, timeout: float) -> bytes:
    # Ask for identity: we must hash the same bytes the badge hashes, and the
    # badge reads arrayBuffer() (already decompressed). urllib does not decode
    # br/gzip for us, so never let the server pick an encoding.
    req = urllib.request.Request(url, headers={
        "Accept-Encoding": "identity",
        "User-Agent": "newsproof-check-live/1",
        "Cache-Control": "no-cache",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def diagnose(served: bytes, built: bytes) -> str | None:
    """If the delta is only Cloudflare's known injections, say so by name."""
    found = [name for name, pat in INJECTIONS if pat.search(served)]
    if not found:
        return None
    stripped = served
    for _, pat in INJECTIONS:
        stripped = pat.sub(b"", stripped)
    if stripped == built:
        return ("edge injection is back: " + ", ".join(found) +
                " -- the `no-transform` opt-out in _headers is not taking effect")
    return "edge injection present (" + ", ".join(found) + ") AND other differences"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE,
                    help=f"site root to fetch (default {DEFAULT_BASE})")
    ap.add_argument("--offline", action="store_true",
                    help="compare repo bytes to proofs only; do not fetch")
    ap.add_argument("--timeout", type=float, default=30.0)
    ap.add_argument("--site", default=None, help="repo root (default: two levels up)")
    args = ap.parse_args()

    root = Path(args.site).resolve() if args.site else HERE.parent.parent
    site = json.loads((HERE / "site.json").read_text(encoding="utf-8"))
    base = args.base.rstrip("/")

    stale, served_bad, missing, unreachable = [], [], [], []
    rows = []

    for ed in site["editions"]:
        code = ed["code"]
        proof_path = root / WELL_KNOWN / "proofs" / f"{code}.proof.json"
        built_path = root / ed["path"]

        if not proof_path.exists() or not built_path.exists():
            missing.append(code)
            rows.append((code, "MISSING", "no proof or no built page"))
            continue

        proof = json.loads(proof_path.read_text(encoding="utf-8"))
        want = proof["statement"]["content_sha256"]
        built = built_path.read_bytes()
        built_sha = sha256(built)

        if args.offline:
            if built_sha == want:
                rows.append((code, "OK", "repo bytes match the signed hash"))
            else:
                stale.append(code)
                rows.append((code, "STALE PROOF", f"built {built_sha[:16]} != signed {want[:16]}"))
            continue

        try:
            served = fetch(base + ed["url"], args.timeout)
        except (urllib.error.URLError, OSError) as e:
            unreachable.append(code)
            rows.append((code, "UNREACHABLE", str(e)))
            continue

        served_sha = sha256(served)
        if served_sha == want:
            rows.append((code, "OK", "served bytes match the signed hash"))
        elif served_sha == built_sha:
            stale.append(code)
            rows.append((code, "STALE PROOF",
                         f"served == repo ({served_sha[:16]}) but signed is {want[:16]}"))
        else:
            served_bad.append(code)
            why = diagnose(served, built) or f"served {served_sha[:16]} != repo {built_sha[:16]}"
            rows.append((code, "SERVED DIFFERS", why))

    width = max(len(c) for c, _, _ in rows) if rows else 8
    print(f"newsproof live check  ({'offline' if args.offline else base})\n")
    for code, status, note in rows:
        print(f"  {code:<{width}}  {status:<14}  {note}")
    print()

    ok = len(rows) - len(stale) - len(served_bad) - len(missing) - len(unreachable)
    print(f"  {ok} verified, {len(stale)} stale proof(s), {len(served_bad)} serving mismatch(es),"
          f" {len(missing)} missing, {len(unreachable)} unreachable")

    if served_bad:
        print("\n  !! SERVED BYTES DIFFER FROM THIS REPO for: " + ", ".join(served_bad))
        print("     A bad deploy, a poisoned cache, an edge rewriting the page, or tampering.")
        print("     This is the case the transparency log exists for -- investigate before signing.")
    if stale:
        print("\n  -- Stale proofs for: " + ", ".join(stale))
        print("     These editions were published but never re-signed, so every reader sees")
        print('     the badge\'s "This edition could not be verified". Clear it with the')
        print("     off-box publisher key:")
        print("         node tools/build.js && cd tools && python3 -m newsproof.dbproof sign")
        print("     Never run `dbproof init` -- on a host with no key its guard passes")
        print("     trivially and it would mint a new identity and reset the log.")
    if unreachable:
        print("\n  ?? Unreachable: " + ", ".join(unreachable))

    if served_bad:
        return 2
    if stale or missing or unreachable:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
