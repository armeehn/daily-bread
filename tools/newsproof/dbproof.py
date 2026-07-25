#!/usr/bin/env python3
"""dbproof -- sign the Daily Bread editions and emit their transparency proofs.

    python3 -m newsproof.dbproof init      create the publisher and log keys
    python3 -m newsproof.dbproof sign      hash every built edition, log + sign it,
                                           write .well-known/newsproof/ and proofs
    python3 -m newsproof.dbproof anchor     pin the current tree head publicly
    python3 -m newsproof.dbproof status     what the log currently attests to

Run it from the repo root after `node tools/build.js`, e.g.

    node tools/build.js
    python3 -m newsproof.dbproof sign        # (run with cwd = tools/, or add tools/ to PYTHONPATH)

`sign` is idempotent: an edition whose bytes have not changed is not re-logged.
An edition whose bytes HAVE changed is recorded as a new version that supersedes
the old one; the old version stays in the log forever. That is the whole point.

Private keys default to tools/newsproof/store/keys/ (git-ignored). The log and
all public proof material live under <site>/.well-known/newsproof/, which IS
committed -- git history, mirrored on GitHub, is itself part of the anchoring
story.
"""

from __future__ import annotations

import argparse
import base64
import json
import shutil
import sys
from pathlib import Path

from . import anchor as anchor_mod
from . import canon, keys, merkle, pages
from .log import TransparencyLog

HERE = Path(__file__).resolve().parent            # tools/newsproof/
DEFAULT_KEYDIR = HERE / "store" / "keys"
WELL_KNOWN = ".well-known/newsproof"


def _repo_root(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).resolve()
    # tools/newsproof/ -> tools/ -> repo root
    return HERE.parent.parent


def _load_site() -> dict:
    return json.loads((HERE / "site.json").read_text(encoding="utf-8"))


def _wk(root: Path) -> Path:
    return root / WELL_KNOWN


def _index_path(wk: Path) -> Path:
    return wk / "index.json"


def _load_index(wk: Path) -> dict:
    p = _index_path(wk)
    return json.loads(p.read_text()) if p.exists() else {}


def _save_index(wk: Path, data: dict) -> None:
    _index_path(wk).write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")


# --------------------------------------------------------------------------
def cmd_init(args) -> int:
    keydir = Path(args.keydir)
    keydir.mkdir(parents=True, exist_ok=True)
    root = _repo_root(args.site)
    wk = _wk(root)
    wk.mkdir(parents=True, exist_ok=True)

    if (keydir / "publisher-private.json").exists() and not args.force:
        print("keys already exist; pass --force to overwrite (this changes identity)",
              file=sys.stderr)
        return 1

    pub_id = keys.generate(keydir / "publisher-private.json", wk / "publisher-key.json")
    log_id = keys.generate(keydir / "log-private.json", wk / "log-key.json")

    TransparencyLog(wk).init()
    _save_index(wk, {})

    print(f"publisher key {pub_id}  ->  {keydir / 'publisher-private.json'}")
    print(f"log key       {log_id}  ->  {keydir / 'log-private.json'}")
    print()
    print("Move publisher-private.json off this machine before you publish for")
    print("real, and publish the fingerprint somewhere other than this site.")
    print(f"publisher fingerprint: {pub_id}")
    return 0


def _read_body(root: Path, edition: dict) -> bytes:
    path = root / edition["path"]
    if not path.exists():
        raise FileNotFoundError(f"missing built edition: {path} (run node tools/build.js)")
    return path.read_bytes()


def cmd_sign(args) -> int:
    keydir = Path(args.keydir)
    root = _repo_root(args.site)
    wk = _wk(root)
    site = _load_site()
    issue = site["issue"]

    if not (keydir / "publisher-private.json").exists():
        print("no keys; run `init` first", file=sys.stderr)
        return 1

    log = TransparencyLog(wk)
    if not log.leaves_path.exists():
        log.init()
    index = _load_index(wk)

    pub_priv = keys.load_private(keydir / "publisher-private.json")
    pub_raw, pub_id = keys.load_public(wk / "publisher-key.json")
    log_priv = keys.load_private(keydir / "log-private.json")
    _, log_id = keys.load_public(wk / "log-key.json")

    changed = 0
    for edition in site["editions"]:
        body = _read_body(root, edition)
        content_hash = canon.content_digest(body)
        aid = f"{issue['id']}/{edition['code']}"
        prev = index.get(aid)

        if prev and prev["content_sha256"] == content_hash:
            continue  # unchanged; already logged

        if prev:
            version = prev["version"] + 1
            supersedes = prev["statement_digest"]
            note = args.message or f"re-issued {edition['code']} edition"
        else:
            version, supersedes, note = 1, None, None

        statement = pages.build_statement(issue, edition, body, version, supersedes, note)
        leaf_index = log.append(statement)
        index[aid] = {
            "version": version,
            "statement_digest": canon.statement_digest(statement),
            "leaf_index": leaf_index,
            "content_sha256": content_hash,
            "code": edition["code"],
        }
        changed += 1
        print(f"  logged {aid} v{version}  leaf {leaf_index}  {content_hash[:16]}...")

    if changed == 0 and log.size > 0:
        print("no edition changed; refreshing proofs against the current tree")
    _save_index(wk, index)

    # One signed tree head over the whole log.
    sth_record = log.sign_tree_head(log_priv, log_id)
    tree_size = sth_record["sth"]["tree_size"]
    root_hex = sth_record["sth"]["root_sha256"]

    # Per-edition proof bundles (current version of each edition).
    proofs_dir = wk / "proofs"
    if proofs_dir.exists():
        shutil.rmtree(proofs_dir)
    proofs_dir.mkdir(parents=True, exist_ok=True)

    manifest_editions = []
    for edition in site["editions"]:
        aid = f"{issue['id']}/{edition['code']}"
        meta = index[aid]
        # Rebuild the exact statement that is at meta['leaf_index'].
        leaves = log.leaves()
        stmt_bytes = leaves[meta["leaf_index"]]
        statement = json.loads(stmt_bytes.decode("utf-8"))
        body = _read_body(root, edition)

        signature = keys.sign(pub_priv, canon.DOMAIN_STATEMENT, canon.canonical(statement))
        bundle = {
            "schema": "newsproof/v1/bundle",
            "statement": statement,
            "publisher_key_id": pub_id,
            "publisher_signature": signature,
            "inclusion": log.inclusion(meta["leaf_index"]),
            "sth": sth_record["sth"],
            "log_key_id": sth_record["log_key_id"],
            "log_signature": sth_record["log_signature"],
            "body_b64": base64.b64encode(body).decode(),
        }
        (proofs_dir / f"{edition['code']}.proof.json").write_text(
            json.dumps(bundle, indent=2) + "\n"
        )
        manifest_editions.append({
            "code": edition["code"],
            "endo": edition["endo"],
            "url": edition["url"],
            "proof": f"proofs/{edition['code']}.proof.json",
            "version": meta["version"],
            "leaf_index": meta["leaf_index"],
        })

    # Consistency proofs from every anchored size up to now (verify.js needs these
    # whenever an anchor is older than the current tree).
    consistency = _consistency_bundle(log)
    (wk / "consistency.json").write_text(json.dumps(consistency, indent=2) + "\n")

    manifest = {
        "schema": "newsproof/v1/manifest",
        "issue": issue,
        "publisher_key_id": pub_id,
        "log_key_id": log_id,
        "tree_size": tree_size,
        "root_sha256": root_hex,
        "sth_timestamp": sth_record["sth"]["timestamp"],
        "editions": manifest_editions,
    }
    (wk / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    # Ship the offline verifier next to the proofs so a reader can grab it.
    verify_dir = root / "verify"
    verify_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(HERE / "verify_standalone.py", verify_dir / "verify_standalone.py")

    print(f"\nsigned {len(site['editions'])} edition(s); tree size {tree_size}")
    print(f"  root {root_hex}")
    print(f"  wrote {wk.relative_to(root)}/  (keys, log, proofs, manifest)")
    if not log.anchors():
        print("\n  NO ANCHOR YET -- readers will see amber 'signed, not anchored'.")
        print("  Run `anchor` and pin the line publicly to reach green.")
    return 0


def _consistency_bundle(log: TransparencyLog) -> list[dict]:
    leaves = log.leaves()
    now = len(leaves)
    out = []
    for size in sorted({a["tree_size"] for a in log.anchors()}):
        if 0 < size < now:
            out.append({
                "old_size": size,
                "new_size": now,
                "old_root": merkle.root(leaves[:size]).hex(),
                "new_root": merkle.root(leaves).hex(),
                "path": [h.hex() for h in merkle.consistency_proof(leaves, size)],
            })
    return out


def cmd_anchor(args) -> int:
    root = _repo_root(args.site)
    wk = _wk(root)
    log = TransparencyLog(wk)
    record = log.latest_sth()
    if not record:
        print("nothing to anchor yet; run `sign` first", file=sys.stderr)
        return 1
    line = anchor_mod.anchor_line(record)
    entry = anchor_mod.submit(log, record, args.via, args.ref)
    # Rebuild consistency proofs now that an anchor exists at this (or a past) size.
    (wk / "consistency.json").write_text(
        json.dumps(_consistency_bundle(log), indent=2) + "\n"
    )
    print(line)
    print()
    print(f"recorded as anchor via '{entry['via']}'"
          + (f" ({entry['ref']})" if entry.get("ref") else "") + ".")
    if args.via == "git":
        size = record["sth"]["tree_size"]
        print(f"\nNow make it real and immutable:")
        print(f"  git add {wk.relative_to(root)} && git commit -m 'anchor size {size}'")
        print(f"  git tag -a newsproof-{size} -m {json.dumps(line)}")
        print(f"  git push origin --tags")
    else:
        print("Post that line somewhere you do not control, and note where with --ref.")
    return 0


def cmd_status(args) -> int:
    root = _repo_root(args.site)
    wk = _wk(root)
    log = TransparencyLog(wk)
    record = log.latest_sth()
    index = _load_index(wk)
    print(f"editions      {len(index)}")
    print(f"log entries   {log.size}")
    if record:
        print(f"tree size     {record['sth']['tree_size']}")
        print(f"root          {record['sth']['root_sha256']}")
        print(f"signed at     {record['sth']['timestamp']}")
    anchors = log.anchors()
    print(f"anchors       {len(anchors)}")
    for a in anchors[-3:]:
        print(f"  size={a['tree_size']:<4} via={a['via']:<8} {a.get('ref','')}")
    if not anchors:
        print("  none -- history is currently rewritable by the publisher")
    for aid, meta in sorted(index.items()):
        print(f"  {aid}  v{meta['version']}  leaf {meta['leaf_index']}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default=None, help="repo root (default: inferred)")
    ap.add_argument("--keydir", default=str(DEFAULT_KEYDIR))
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("init"); p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_init)

    p = sub.add_parser("sign")
    p.add_argument("-m", "--message", default=None, help="revision note, if content changed")
    p.set_defaults(fn=cmd_sign)

    p = sub.add_parser("anchor")
    p.add_argument("--via", default="git", choices=("manual", "file", "git", "rfc3161"))
    p.add_argument("--ref", default="", help="where the anchor line is posted")
    p.set_defaults(fn=cmd_anchor)

    sub.add_parser("status").set_defaults(fn=cmd_status)

    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
