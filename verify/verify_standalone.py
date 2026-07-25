#!/usr/bin/env python3
"""Standalone Daily Bread / newsproof verifier -- one file, no dependencies.

This is the part that actually matters. The badge on the website is served by the
same site as the magazine, so on its own it proves nothing against the publisher.
This file does not come from the publisher: a reader, an archivist, a rival
newsroom or a court keeps their own copy and runs it offline against a publisher
fingerprint they obtained once, somewhere else.

    python3 verify_standalone.py proof.json \\
        --publisher-key publisher-key.json \\
        --log-key log-key.json \\
        --anchors anchors.jsonl \\
        --consistency consistency.json

No `pip install` anything: Ed25519 verification, RFC 6962 proofs and RFC 8785
canonical JSON are all re-implemented here in the standard library, deliberately,
so that a bug in the publisher's code cannot excuse a bad proof. It is slow and
it does not care.

Seven checks: the served bytes match the hash that was signed, the bundle names
the publisher key you pinned, the publisher signature is valid, the edition is in
the log, the inclusion proof and tree head agree, the log signature is valid, and
a public anchor covers this version of the log. No anchor supplied => FAIL, on
purpose (`--allow-unanchored` to accept the weaker guarantee knowingly).
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys

DOMAIN_STATEMENT = b"newsproof/v1/statement\x00"
DOMAIN_STH = b"newsproof/v1/sth\x00"


# --- Ed25519 verification (RFC 8032, pure Python) --------------------------
_q = 2 ** 255 - 19
_L = 2 ** 252 + 27742317777372353535851937790883648493


def _inv(x):
    return pow(x, _q - 2, _q)


_d = -121665 * _inv(121666) % _q
_I = pow(2, (_q - 1) // 4, _q)


def _xrecover(y):
    xx = (y * y - 1) * _inv(_d * y * y + 1)
    x = pow(xx, (_q + 3) // 8, _q)
    if (x * x - xx) % _q != 0:
        x = (x * _I) % _q
    if x % 2 != 0:
        x = _q - x
    return x


_By = 4 * _inv(5) % _q
_B = (_xrecover(_By) % _q, _By % _q)


def _add(P, Q):
    x1, y1 = P
    x2, y2 = Q
    x3 = (x1 * y2 + x2 * y1) * _inv(1 + _d * x1 * x2 * y1 * y2) % _q
    y3 = (y1 * y2 + x1 * x2) * _inv(1 - _d * x1 * x2 * y1 * y2) % _q
    return (x3 % _q, y3 % _q)


def _mul(P, e):
    Q = (0, 1)
    for i in reversed(range(e.bit_length())):
        Q = _add(Q, Q)
        if (e >> i) & 1:
            Q = _add(Q, P)
    return Q


def _isoncurve(P):
    x, y = P
    return (-x * x + y * y - 1 - _d * x * x * y * y) % _q == 0


def _decodepoint(s):
    y = int.from_bytes(s, "little") & ((1 << 255) - 1)
    x = _xrecover(y)
    if x & 1 != (s[31] >> 7) & 1:
        x = _q - x
    P = (x, y)
    if not _isoncurve(P):
        raise ValueError("point not on curve")
    return P


def ed25519_verify(pub: bytes, message: bytes, sig: bytes) -> bool:
    try:
        if len(sig) != 64 or len(pub) != 32:
            return False
        R = _decodepoint(sig[:32])
        A = _decodepoint(pub)
        S = int.from_bytes(sig[32:], "little")
        if S >= _L:
            return False
        h = int.from_bytes(hashlib.sha512(sig[:32] + pub + message).digest(), "little")
        return _mul(_B, S) == _add(R, _mul(A, h))
    except (ValueError, IndexError):
        return False


# --- canonical JSON (RFC 8785, restricted) ---------------------------------
def _norm(value):
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        raise TypeError("floats not allowed")
    if isinstance(value, (list, tuple)):
        return [_norm(v) for v in value]
    if isinstance(value, dict):
        return {k: _norm(v) for k, v in
                sorted(value.items(), key=lambda kv: kv[0].encode("utf-16-be"))}
    raise TypeError(type(value).__name__)


def canonical(obj) -> bytes:
    return json.dumps(_norm(obj), ensure_ascii=False,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


# --- RFC 6962 --------------------------------------------------------------
def leaf_hash(data: bytes) -> bytes:
    return hashlib.sha256(b"\x00" + data).digest()


def node_hash(a: bytes, b: bytes) -> bytes:
    return hashlib.sha256(b"\x01" + a + b).digest()


def verify_inclusion(leaf, index, size, path, expected) -> bool:
    if not 0 <= index < size:
        return False
    fn, sn, acc = index, size - 1, leaf
    for sibling in path:
        if sn == 0:
            return False
        if (fn & 1) or fn == sn:
            acc = node_hash(sibling, acc)
            while fn != 0 and (fn & 1) == 0:
                fn >>= 1
                sn >>= 1
        else:
            acc = node_hash(acc, sibling)
        fn >>= 1
        sn >>= 1
    return sn == 0 and acc == expected


def verify_consistency(m, n, path, old_root, new_root) -> bool:
    if m > n or m < 0:
        return False
    if m == n:
        return not path and old_root == new_root
    if m == 0:
        return not path
    if not path:
        return False
    fn, sn = m - 1, n - 1
    while fn & 1:
        fn >>= 1
        sn >>= 1
    rest = list(path)
    first = rest.pop(0) if fn != 0 else old_root
    fr = sr = first
    for sibling in rest:
        if sn == 0:
            return False
        if (fn & 1) or fn == sn:
            fr = node_hash(sibling, fr)
            sr = node_hash(sibling, sr)
            while fn != 0 and (fn & 1) == 0:
                fn >>= 1
                sn >>= 1
        else:
            sr = node_hash(sr, sibling)
        fn >>= 1
        sn >>= 1
    return sn == 0 and fr == old_root and sr == new_root


# --- keys ------------------------------------------------------------------
def load_key(path: str):
    doc = json.loads(open(path, encoding="utf-8").read())
    raw = base64.b64decode(doc["public_key_b64"])
    if hashlib.sha256(raw).hexdigest()[:16] != doc["key_id"]:
        raise ValueError(f"{path}: key_id does not match key material")
    return raw, doc["key_id"]


# --- the checks ------------------------------------------------------------
class Report:
    def __init__(self):
        self.rows = []

    def check(self, ok, label, detail=""):
        self.rows.append((bool(ok), label, detail))
        return bool(ok)

    @property
    def ok(self):
        return all(ok for ok, _, _ in self.rows)

    def render(self):
        return "\n".join(f"  [{'PASS' if ok else 'FAIL'}] {label}"
                         + (f"  {detail}" if detail else "")
                         for ok, label, detail in self.rows)


def verify(bundle, pub_key, pub_id, log_key, log_id, anchors, consistency,
           require_anchor=True) -> Report:
    r = Report()
    st = bundle["statement"]

    body = base64.b64decode(bundle["body_b64"])
    r.check(hashlib.sha256(body).hexdigest() == st["content_sha256"],
            "served bytes match the hash that was signed",
            st["content_sha256"][:16] + "...")
    r.check(bundle["publisher_key_id"] == pub_id,
            "bundle names the publisher key you pinned", pub_id)
    r.check(ed25519_verify(pub_key, DOMAIN_STATEMENT + canonical(st),
                           base64.b64decode(bundle["publisher_signature"])),
            "publisher signature over the statement")

    inc, sth = bundle["inclusion"], bundle["sth"]
    r.check(verify_inclusion(leaf_hash(canonical(st)), inc["leaf_index"],
                             inc["tree_size"],
                             [bytes.fromhex(h) for h in inc["audit_path"]],
                             bytes.fromhex(sth["root_sha256"])),
            "edition is in the transparency log",
            f"leaf {inc['leaf_index']} of {inc['tree_size']}")
    r.check(inc["tree_size"] == sth["tree_size"],
            "inclusion proof and tree head agree on size")
    r.check(bundle["log_key_id"] == log_id,
            "bundle names the log key you pinned", log_id)
    r.check(ed25519_verify(log_key, DOMAIN_STH + canonical(sth),
                           base64.b64decode(bundle["log_signature"])),
            "log signature over the tree head", f"root {sth['root_sha256'][:16]}...")

    by_size = {a["tree_size"]: a for a in (anchors or [])}
    proofs = {(c["old_size"], c["new_size"]): c for c in (consistency or [])}
    linked = 0
    for size, entry in sorted(by_size.items()):
        if size > sth["tree_size"]:
            continue
        if size == sth["tree_size"]:
            if r.check(entry["root_sha256"] == sth["root_sha256"],
                       f"anchored root at size {size} equals this tree head",
                       entry.get("ref") or entry.get("via", "")):
                linked += 1
            continue
        proof = proofs.get((size, sth["tree_size"]))
        if not proof:
            r.check(False, f"consistency proof from anchored size {size} present")
            continue
        if r.check(verify_consistency(size, sth["tree_size"],
                                      [bytes.fromhex(h) for h in proof["path"]],
                                      bytes.fromhex(entry["root_sha256"]),
                                      bytes.fromhex(sth["root_sha256"])),
                   f"log still contains everything anchored at size {size}",
                   entry.get("ref") or entry.get("via", "")):
            linked += 1

    if require_anchor:
        r.check(linked > 0, "a public anchor covers this version of the log",
                "" if linked else "without one, history is rewritable by the publisher")
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bundle")
    ap.add_argument("--publisher-key", required=True)
    ap.add_argument("--log-key", required=True)
    ap.add_argument("--anchors", default=None)
    ap.add_argument("--consistency", default=None)
    ap.add_argument("--show-body", action="store_true")
    ap.add_argument("--allow-unanchored", action="store_true")
    args = ap.parse_args()

    bundle = json.loads(open(args.bundle, encoding="utf-8").read())
    pub_key, pub_id = load_key(args.publisher_key)
    log_key, log_id = load_key(args.log_key)

    anchors = []
    if args.anchors:
        anchors = [json.loads(x) for x in
                   open(args.anchors, encoding="utf-8").read().splitlines() if x.strip()]
    consistency = []
    if args.consistency:
        consistency = json.loads(open(args.consistency, encoding="utf-8").read())

    st = bundle["statement"]
    print(st["title"])
    print(f'  {st["article_id"]}  version {st["version"]}  {st["published_at"]}')
    if st.get("supersedes"):
        print(f'  supersedes {st["supersedes"][:16]}...  note: {st.get("revision_note")}')
    print()

    report = verify(bundle, pub_key, pub_id, log_key, log_id, anchors, consistency,
                    require_anchor=not args.allow_unanchored)
    print(report.render())
    print()
    if report.ok:
        print("VERIFIED. This is the edition that was signed and logged.")
        if args.allow_unanchored and not anchors:
            print("Caveat: no public anchor, so this shows the publisher is")
            print("self-consistent, not that history stands.")
    else:
        print("FAILED. Do not trust this copy.")

    if args.show_body:
        sys.stdout.write("\n" + "-" * 60 + "\n")
        sys.stdout.buffer.write(base64.b64decode(bundle["body_b64"]))
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
