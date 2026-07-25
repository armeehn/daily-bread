"""Anchoring: the step that makes the log binding rather than decorative.

Everything up to here is signed by keys the publisher controls, which means a
determined publisher could throw the log away and rebuild a cleaner one.  The
fix is to publish a tree head somewhere the publisher cannot quietly edit.
After that, any replacement history has to explain why it disagrees with a root
the world already saw.

What counts as "somewhere you cannot edit" is a judgement call, and honestly
the weakest link in most deployments.  Ranked roughly by how hard they are to
walk back:

  rfc3161   a timestamp authority's signature over the root, verifiable
            offline forever, and not something you can re-issue for a past date
  git       a signed tag pushed to a repo with third-party mirrors and its own
            transparency story
  file      write it into an artefact you distribute widely (an RSS feed, a
            daily email) -- weak alone, useful in aggregate
  manual    you post it publicly yourself and note where

Anything is better than nothing.  Nothing is the default state of every news
site on the internet today.
"""

from __future__ import annotations

import datetime
import json
import subprocess
import tempfile
from pathlib import Path

from . import canon


def anchor_line(sth_record: dict) -> str:
    """One compact line, designed to be pasted anywhere public."""
    sth = sth_record["sth"]
    return (
        f"newsproof-anchor v1 "
        f"size={sth['tree_size']} "
        f"root={sth['root_sha256']} "
        f"ts={sth['timestamp']} "
        f"logkey={sth_record['log_key_id']} "
        f"sig={sth_record['log_signature']}"
    )


def parse_anchor_line(line: str) -> dict:
    fields = {}
    parts = line.strip().split()
    if len(parts) < 3 or parts[0] != "newsproof-anchor":
        raise ValueError("not a newsproof anchor line")
    for token in parts[2:]:
        key, _, value = token.partition("=")
        fields[key] = value
    fields["size"] = int(fields["size"])
    return fields


def rfc3161_request(root_hex: str) -> bytes:
    """Build a DER timestamp request over the tree root, via openssl."""
    with tempfile.TemporaryDirectory() as tmp:
        digest = Path(tmp) / "root.bin"
        digest.write_bytes(bytes.fromhex(root_hex))
        out = Path(tmp) / "req.tsq"
        subprocess.run(
            ["openssl", "ts", "-query", "-data", str(digest), "-sha256",
             "-cert", "-out", str(out)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return out.read_bytes()


def submit(log, sth_record: dict, via: str, ref: str = "") -> dict:
    """Record an anchoring event.  Network transports are best-effort."""
    sth = sth_record["sth"]
    entry = {
        "tree_size": sth["tree_size"],
        "root_sha256": sth["root_sha256"],
        "sth_timestamp": sth["timestamp"],
        "via": via,
        "ref": ref,
        "recorded_at": datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "line": anchor_line(sth_record),
    }

    if via == "rfc3161":
        try:
            request = rfc3161_request(sth["root_sha256"])
            entry["tsq_b64"] = __import__("base64").b64encode(request).decode()
            entry["note"] = (
                "timestamp request built; POST it to a TSA "
                "(Content-Type: application/timestamp-query) and store the reply"
            )
        except Exception as exc:  # openssl missing or refused
            entry["note"] = f"could not build timestamp request: {exc}"
    elif via == "git":
        entry["note"] = (
            "commit the anchor line, then: git tag -s newsproof-"
            f"{sth['tree_size']} -m '<line>' && git push --tags"
        )
    elif via == "file":
        path = Path(ref) if ref else Path("anchors.txt")
        with path.open("a", encoding="utf-8") as fh:
            fh.write(entry["line"] + "\n")
        entry["note"] = f"appended to {path}"

    log.record_anchor(entry)
    return entry


def verify_anchor(line: str, leaves: list[bytes], public_log_key: bytes) -> dict:
    """Check a published anchor line against a log you have a copy of."""
    from . import keys, merkle

    fields = parse_anchor_line(line)
    size = fields["size"]
    result = {"size": size, "claimed_root": fields["root"]}

    computed = merkle.root(leaves[:size]).hex()
    result["root_matches"] = computed == fields["root"]

    sth = {
        "schema": "newsproof/v1/sth",
        "tree_size": size,
        "root_sha256": fields["root"],
        "timestamp": fields["ts"],
    }
    result["signature_valid"] = keys.verify(
        public_log_key, canon.DOMAIN_STH, canon.canonical(sth), fields["sig"]
    )
    result["ok"] = result["root_matches"] and result["signature_valid"]
    return result
