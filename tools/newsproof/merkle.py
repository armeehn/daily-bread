"""RFC 6962 Merkle tree: the part that stops *you*.

A signature proves who wrote something.  It does nothing about a publisher who
re-signs an edited article and discards the old version -- the new signature is
perfectly valid.  What defeats that is an append-only log.

Two proof types carry the weight:

  inclusion    this exact article version is leaf i of a tree of size n
  consistency  the tree of size n still contains, unchanged, everything the
               tree of size m contained

Publish a tree head somewhere you do not control, and consistency proofs mean
you can add history but never rewrite it.  Corrections stay possible; silent
corrections do not.

Hashing follows RFC 6962 exactly, including the 0x00/0x01 domain separation
that keeps a leaf from ever being mistaken for an interior node.
"""

from __future__ import annotations

import hashlib

EMPTY_ROOT = hashlib.sha256(b"").digest()


def leaf_hash(data: bytes) -> bytes:
    return hashlib.sha256(b"\x00" + data).digest()


def node_hash(left: bytes, right: bytes) -> bytes:
    return hashlib.sha256(b"\x01" + left + right).digest()


def _split(n: int) -> int:
    """Largest power of two strictly less than n (RFC 6962's k)."""
    if n < 2:
        raise ValueError("split requires n >= 2")
    return 1 << ((n - 1).bit_length() - 1)


# --------------------------------------------------------------------------
# Tree construction
# --------------------------------------------------------------------------
def root(leaves: list[bytes]) -> bytes:
    """MTH(D[n])."""
    if not leaves:
        return EMPTY_ROOT
    if len(leaves) == 1:
        return leaf_hash(leaves[0])
    k = _split(len(leaves))
    return node_hash(root(leaves[:k]), root(leaves[k:]))


# --------------------------------------------------------------------------
# Inclusion
# --------------------------------------------------------------------------
def inclusion_proof(leaves: list[bytes], index: int) -> list[bytes]:
    """PATH(m, D[n])."""
    n = len(leaves)
    if not 0 <= index < n:
        raise IndexError("leaf index out of range")
    if n == 1:
        return []
    k = _split(n)
    if index < k:
        return inclusion_proof(leaves[:k], index) + [root(leaves[k:])]
    return inclusion_proof(leaves[k:], index - k) + [root(leaves[:k])]


def verify_inclusion(
    leaf: bytes, index: int, tree_size: int, proof: list[bytes], expected: bytes
) -> bool:
    """Recompute the root from a leaf and its audit path alone."""
    if index >= tree_size or index < 0:
        return False
    fn, sn = index, tree_size - 1
    acc = leaf
    for sibling in proof:
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


# --------------------------------------------------------------------------
# Consistency
# --------------------------------------------------------------------------
def consistency_proof(leaves: list[bytes], old_size: int) -> list[bytes]:
    """PROOF(m, D[n])."""
    n = len(leaves)
    if not 0 <= old_size <= n:
        raise ValueError("old_size out of range")
    if old_size == 0 or old_size == n:
        return []
    return _subproof(old_size, leaves, True)


def _subproof(m: int, leaves: list[bytes], complete: bool) -> list[bytes]:
    n = len(leaves)
    if m == n:
        return [] if complete else [root(leaves)]
    k = _split(n)
    if m <= k:
        return _subproof(m, leaves[:k], complete) + [root(leaves[k:])]
    return _subproof(m - k, leaves[k:], False) + [root(leaves[:k])]


def verify_consistency(
    old_size: int,
    new_size: int,
    proof: list[bytes],
    old_root: bytes,
    new_root: bytes,
) -> bool:
    """Confirm the newer tree is an append-only extension of the older one."""
    if old_size > new_size or old_size < 0:
        return False
    if old_size == new_size:
        return proof == [] and old_root == new_root
    if old_size == 0:
        return proof == []
    if not proof:
        return False

    fn, sn = old_size - 1, new_size - 1
    while fn & 1:
        fn >>= 1
        sn >>= 1

    path = list(proof)
    if fn != 0:
        first = path.pop(0)
    else:
        first = old_root
    fr = first
    sr = first

    for sibling in path:
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
