"""The append-only log.

Storage is deliberately boring: one canonical statement per line in a text
file.  Boring means a third party can re-derive every root in the log with a
few lines of code and no trust in this implementation.
"""

from __future__ import annotations

import datetime
import json
from pathlib import Path

from . import canon, keys, merkle


def _now() -> str:
    return (
        datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


class TransparencyLog:
    def __init__(self, root_dir: Path) -> None:
        self.dir = Path(root_dir)
        self.leaves_path = self.dir / "leaves.jsonl"
        self.sth_path = self.dir / "sth.json"
        self.sth_history = self.dir / "sth-history.jsonl"
        self.anchors_path = self.dir / "anchors.jsonl"

    # -- storage -----------------------------------------------------------
    def init(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self.leaves_path.touch()
        self.sth_history.touch()
        self.anchors_path.touch()

    def leaves(self) -> list[bytes]:
        if not self.leaves_path.exists():
            return []
        return [
            line.encode("utf-8")
            for line in self.leaves_path.read_text(encoding="utf-8").splitlines()
            if line
        ]

    @property
    def size(self) -> int:
        return len(self.leaves())

    def append(self, statement: dict) -> int:
        blob = canon.canonical(statement)
        if b"\n" in blob:
            raise ValueError("canonical statement must be single-line")
        with self.leaves_path.open("a", encoding="utf-8") as fh:
            fh.write(blob.decode("utf-8") + "\n")
        return self.size - 1

    # -- proofs ------------------------------------------------------------
    def root_hex(self, size: int | None = None) -> str:
        ls = self.leaves()
        if size is not None:
            ls = ls[:size]
        return merkle.root(ls).hex()

    def inclusion(self, index: int) -> dict:
        ls = self.leaves()
        return {
            "leaf_index": index,
            "tree_size": len(ls),
            "audit_path": [h.hex() for h in merkle.inclusion_proof(ls, index)],
        }

    def consistency(self, old_size: int) -> dict:
        ls = self.leaves()
        return {
            "old_size": old_size,
            "new_size": len(ls),
            "path": [h.hex() for h in merkle.consistency_proof(ls, old_size)],
        }

    # -- signed tree heads -------------------------------------------------
    def sign_tree_head(self, log_private, log_key_id: str) -> dict:
        size = self.size
        sth = {
            "schema": "newsproof/v1/sth",
            "tree_size": size,
            "root_sha256": self.root_hex(),
            "timestamp": _now(),
        }
        signature = keys.sign(log_private, canon.DOMAIN_STH, canon.canonical(sth))
        record = {"sth": sth, "log_key_id": log_key_id, "log_signature": signature}
        self.sth_path.write_text(json.dumps(record, indent=2) + "\n")
        with self.sth_history.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, sort_keys=True) + "\n")
        return record

    def latest_sth(self) -> dict | None:
        if not self.sth_path.exists():
            return None
        return json.loads(self.sth_path.read_text())

    def sth_at(self, size: int) -> dict | None:
        """The newest signed tree head no larger than `size`."""
        best = None
        if not self.sth_history.exists():
            return None
        for line in self.sth_history.read_text().splitlines():
            if not line:
                continue
            rec = json.loads(line)
            if rec["sth"]["tree_size"] <= size:
                if best is None or rec["sth"]["tree_size"] > best["sth"]["tree_size"]:
                    best = rec
        return best

    # -- anchors -----------------------------------------------------------
    def record_anchor(self, entry: dict) -> None:
        with self.anchors_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, sort_keys=True) + "\n")

    def anchors(self) -> list[dict]:
        if not self.anchors_path.exists():
            return []
        return [
            json.loads(line)
            for line in self.anchors_path.read_text().splitlines()
            if line
        ]
