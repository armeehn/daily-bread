# newsproof — tamper-evident publishing for Daily Bread

Every language edition of an issue is signed with a key kept **off the web
server**, recorded in an append-only [RFC 6962](https://www.rfc-editor.org/rfc/rfc6962)
transparency log, and pinned to a public **anchor**. Readers verify it three ways:
the badge on [`/verify/`](../../verify/) (WebCrypto, in-browser), the single-file
[`verify_standalone.py`](verify_standalone.py) run offline, or by re-deriving every
root themselves from [`leaves.jsonl`](../../.well-known/newsproof/leaves.jsonl).

This is a pure-Python port of [newsproof](https://…) with the same on-disk
`statement`/`bundle`/`sth` schemas, so the shipped verifiers are unchanged. It
depends on **nothing but the Python standard library** — Ed25519 is the RFC 8032
reference implementation in [`ed25519.py`](ed25519.py). Read
[`THREAT-MODEL.md`](THREAT-MODEL.md) before trusting any of it.

## What it proves

> This is the exact issue Daily Bread published in each language, and every
> earlier version is still provable.

Not that anything in it is *true*. Signing attests authorship, not accuracy. See
the threat model for the full, honest boundary — especially that the in-browser
badge is convenience, and the offline verifier is the real check.

## Layout

| file | role |
|------|------|
| `ed25519.py` | RFC 8032 Ed25519, pure Python (keygen, sign, verify) |
| `canon.py` | RFC 8785 canonical JSON; the browser mirrors it exactly |
| `merkle.py` | RFC 6962 tree, inclusion and consistency proofs |
| `keys.py` | two keys: an offline publisher key, an online log key |
| `log.py` | the append-only log and signed tree heads |
| `anchor.py` | anchoring transports (git tag, RFC 3161, manual, file) |
| `pages.py` | one built HTML edition → the signed statement |
| `dbproof.py` | the CLI: `init`, `sign`, `anchor`, `status` |
| `site.json` | the issue metadata + the edition list (track `tools/build.js` LANGS) |
| `verify_standalone.py` | one-file offline verifier, no dependencies |

Public proof material is written to `../../.well-known/newsproof/` (committed and
served); private keys go to `store/keys/` (git-ignored, and they must leave the
build host for a real deployment).

## Rebuild the proofs

```sh
node tools/build.js                       # (re)build the 16 static editions
cd tools
python3 -m newsproof.dbproof sign         # hash, log and sign each edition
python3 -m newsproof.dbproof anchor --via git --ref "git tag in <org>/daily-bread"
# then, from the repo root:
git add .well-known/newsproof && git commit -m "newsproof: re-sign issue"
git tag -a newsproof-<size> -m "<the printed anchor line>" && git push origin --tags
```

`sign` is **idempotent**: an edition whose bytes did not change is not re-logged.
An edition whose bytes *did* change is recorded as a new version that supersedes
the old one — the old one stays in the log forever. That is the whole editorial
policy: correct freely, but the previous wording remains provable.

## First-time setup

```sh
cd tools
python3 -m newsproof.dbproof init         # generates publisher + log keypairs
```

Then **move `store/keys/publisher-private.json` off this machine** and publish its
fingerprint somewhere other than the site (print masthead, a verified profile).
On a reader's first visit, a key they fetch from you proves nothing about you.

## Verify (what any reader can do)

```sh
python3 verify_standalone.py en.proof.json \
    --publisher-key publisher-key.json --log-key log-key.json \
    --anchors anchors.jsonl --consistency consistency.json
```

No anchor supplied ⇒ **FAIL**, deliberately: an attacker who can serve you a
tampered edition can also serve you an empty anchors file, so a missing anchor is
a failure, not a skipped check. `--allow-unanchored` accepts the weaker guarantee
knowingly.

## Is the site actually verifying right now?

```sh
cd tools
python3 -m newsproof.check_live            # against the deployed site
python3 -m newsproof.check_live --offline  # repo vs proofs, no network
```

**Do not use `dbproof status` for this.** It verifies the log against itself and
never re-hashes anything, so it reads perfectly healthy while every reader is
looking at "This edition could not be verified". That is not hypothetical: the
proofs went stale 59 minutes after they were signed and it went unnoticed for a
month.

`check_live` makes the same comparison the reader's badge makes, and separates
the two ways it breaks:

- **STALE PROOF** — served bytes equal the repo, but neither matches the
  signature. The edition was rebuilt and published, never re-signed. Publishing
  hygiene. Only the off-box publisher key clears it: `dbproof sign`.
- **SERVED DIFFERS** — served bytes do not equal the repo. A bad deploy, a
  poisoned cache, an edge rewriting the page, or tampering. This is the case the
  transparency log exists for. It names Cloudflare's two known HTML injections
  explicitly if it sees them.

Exit status: `0` all verified, `1` stale proofs, `2` a serving mismatch.
CI runs it daily — see `.github/workflows/verify-editions.yml`.

⚠ **Never run `dbproof init` on a checkout that has no key.** Its only guard is
whether `store/keys/publisher-private.json` already exists, so on a host where
the key was never present that guard passes with no `--force` needed — and it
mints a new identity, overwrites the committed public keys, resets the log and
wipes the index. `sign`'s own error message says "no keys; run `init` first";
on the build host that advice is wrong. Bring the key to the repo instead.
