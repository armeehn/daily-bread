"""newsproof for Daily Bread -- tamper-evident publishing, pure-Python edition.

Each language edition of an issue is signed with an offline publisher key,
recorded in an append-only RFC 6962 transparency log, and pinned to a public
anchor. The `statement` and proof-bundle schemas are byte-for-byte identical to
upstream newsproof, so the shipped browser badge (verify.js, WebCrypto) and the
offline reference verifier both work against these proofs unchanged.

See README.md in this directory and THREAT-MODEL.md before deploying for real.
"""
