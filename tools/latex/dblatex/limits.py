"""How many words each writer's slot holds on its printed page.

The studio shows every section's word limit. Its web half is measured in the
browser on the Web PDF sheet; this is the print half, measured on the press:
the studio's default model is laid over content/<edition>.tex (overlay.py, the
path press.hq takes) and typeset by lualatex, with each slot's copy grown until
it no longer fits its page. The result goes to press/<edition>/limits.json,
beside booklet.json, where the studio reads it and shows the smaller limit.

A slot too long for its box does not warn: dailybread.cls sets the body in a
box that runs silently off the foot of the page, under the running strip (TeX
reports no overfull box). So fitting is read off the typeset page itself with
`pdftotext -bbox`: a slot fits while the last word of its copy is on its page,
above the foot of the text area, and nothing else on that page has been pushed
below that line that was not there already (a sign-off, a caption).

Every slot on a different page is independent, so each typesetting probes all
of them at once: about a dozen lualatex runs for the issue, not a dozen each.

Two phases. First each piece on its own page, nothing continued: that gives
`main` (words) and, from the copy that just filled it, `mainLines`, the line
budget the overlay breaks long pieces by. Then the long pieces (overlay.JUMPS)
are grown again with continuations on, until their half of a Continued page
is full; a continuation too long for its slot is cut by the class and so goes
missing from the page, which is what the search looks for. `capacity` is the
total, published PUBLISH under what was measured. Grown copy comes in
paragraphs of PARA_WORDS, since every paragraph break costs space: a writer
whose paragraphs are much shorter than that gets somewhat fewer words.
"""
import html
import json
import re
import subprocess
import tempfile
from pathlib import Path

from . import press
from .overlay import JUMPS, Overlay, body_lines, typeset
from .reader import read_tex

MM_PT = 72 / 25.4
# the foot of the text area: A5 height less the class's 13 mm bottom margin
FOOT_PT = press.A5_PT[1] - 13 * MM_PT
WORD = re.compile(r"[^\W_][\w'’\-]*", re.UNICODE)
PRECISION = 4                    # words: stop when the search brackets this tightly

# The writer's slot in each section: the copy a writer sends in, not the
# furniture around it. Paths are into the studio model (db.js DEFAULT_MODEL).
# Sections that are pictures first (comics, art, stickers) have no slot.
SLOTS = [
    ("letter", "letter.paragraphs"),
    ("contents", "contents.dek"),
    ("history", "history.paragraphs"),
    ("voices", "voices.reports.0.body"),
    ("voices", "voices.reports.1.body"),
    ("voices", "voices.reports.2.body"),
    ("waitlist", "waitlist.dek"),
    ("interview", "interview.quote"),
    ("calendar", "calendar.dek"),
    ("directory", "directory.note"),
    ("lab", "lab.paragraphs"),
]


def words(v):
    if isinstance(v, list):
        return sum(words(x) for x in v)
    return len(WORD.findall(re.sub(r"<[^>]*>", " ", str(v or ""))))


def get(model, path):
    cur = model
    for k in path.split("."):
        cur = cur[int(k)] if isinstance(cur, list) else cur.get(k)
        if cur is None:
            return None
    return cur


def put(model, path, value):
    keys = path.split(".")
    cur = model
    for k in keys[:-1]:
        cur = cur[int(k)] if isinstance(cur, list) else cur[k]
    last = keys[-1]
    if isinstance(cur, list):
        cur[int(last)] = value
    else:
        cur[last] = value


def marker(i):
    # one letter-only token per slot, so it survives casing and is found exactly
    return "zqend" + "abcdefghijklmnop"[i] + "q"


PARA_WORDS = 45                  # grown copy comes in paragraphs of this size, as writers write
PUBLISH = 0.97                   # a limit is published this far under what was measured


def grow(model, i, path, n, pool):
    """The slot's copy plus n words of its own vocabulary, in paragraphs of
    PARA_WORDS (a paragraph break costs space, so one long block would measure
    more room than real copy has), then its marker."""
    words_ = [pool[j % len(pool)] for j in range(n)] + [marker(i)]
    paras = [" ".join(words_[k:k + PARA_WORDS]) for k in range(0, len(words_), PARA_WORDS)]
    v = get(model, path)
    if isinstance(v, list):
        put(model, path, v + paras)
    else:
        put(model, path, "\n\n".join([str(v or "")] + paras).strip())


def vocabulary(node):
    """The words of a section's own copy, so filler has its word lengths:
    string values only, never keys, colours or links."""
    out = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k not in ("href", "c", "sc", "coverSrc", "img"):
                out += vocabulary(v)
    elif isinstance(node, list):
        for v in node:
            out += vocabulary(v)
    elif isinstance(node, str) and not re.match(r"^#[0-9a-fA-F]{3,6}$", node):
        out += WORD.findall(re.sub(r"<[^>]*>", " ", node))
    return out


def page_words(pdf):
    """[[(text, yMax), ...] per page] from pdftotext -bbox."""
    out = subprocess.run(["pdftotext", "-bbox", str(pdf), "-"], capture_output=True, text=True, check=True).stdout
    pages = []
    for block in out.split("<page ")[1:]:
        pages.append([(html.unescape(t), float(y)) for y, t in
                      re.findall(r'<word[^>]*yMax="([\d.]+)"[^>]*>([^<]*)</word>', block)])
    return pages


def below(page):
    return sum(1 for _, y in page if y > FOOT_PT + 0.5)


def probe_model(model, probes):
    m = json.loads(json.dumps(model))
    for i, (sec, path) in enumerate(SLOTS):
        if probes[i] is not None:
            grow(m, i, path, probes[i], vocabulary(model.get(sec, {})) or ["word"])
    return m


def run(repo, edition, model, probes, work, mains):
    """Typeset `model` with slot i grown by probes[i] words (None: not grown),
    continuations per `mains` ({} for none). Returns the words per page."""
    typeset(repo, edition, probe_model(model, probes), work, mains=mains)
    return page_words(Path(work) / "build" / "print.pdf")


def search(start, fits, run_probes, log, label):
    """Per slot, the most words that still fit: double from `start` until it
    does not, then bisect. Every typesetting probes every open slot at once."""
    lo = dict(start)
    hi = {i: None for i in lo}
    step = {i: 32 for i in lo}
    rounds = 0
    while True:
        probes = [None] * len(SLOTS)
        for i in lo:
            if hi[i] is None:
                probes[i] = lo[i] + step[i]
            elif hi[i] - lo[i] > PRECISION:
                probes[i] = (lo[i] + hi[i]) // 2
        if all(p is None for p in probes):
            return lo, rounds
        rounds += 1
        pages = run_probes(probes)
        for i, k in enumerate(probes):
            if k is None:
                continue
            if fits(pages, i):
                lo[i] = k
                if hi[i] is None:
                    step[i] *= 2
            else:
                hi[i] = k
        log("%s round %d: %s" % (label, rounds, " ".join("%s=%s" % (SLOTS[i][1].split(".")[0], p) for i, p in enumerate(probes) if p is not None)))


def measure(repo, edition, model, log=print):
    repo = Path(repo)
    work = Path(tempfile.mkdtemp(prefix="db-limits-"))
    n = len(SLOTS)
    jump_paths = {path for path, _ in JUMPS}

    # 1. where each slot prints, and what already sits below the foot there
    base = run(repo, edition, model, [0] * n, work, {})
    home, floor = {}, {}
    for i in range(n):
        home[i] = [p for p, pg in enumerate(base) if any(marker(i) in t.lower() for t, _ in pg)]
        for p in home[i]:
            floor[p] = below(base[p]) - sum(1 for t, y in base[p] if marker(i) in t.lower() and y > FOOT_PT + 0.5)
    lost = [SLOTS[i][1] for i in range(n) if not home[i]]
    if lost:
        log("not on any page as typeset (already over?): " + ", ".join(lost))

    def page_ok(pages, i):
        return all(below(pages[p]) <= floor[p] for p in home[i])

    # 2. phase A: each piece on its own page, nothing continued
    def fits_a(pages, i):
        for p in home[i]:
            ys = [y for t, y in pages[p] if marker(i) in t.lower()]
            if not ys or max(ys) > FOOT_PT + 0.5:
                return False
        return page_ok(pages, i)
    main, rounds_a = search({i: 0 for i in range(n) if home[i]}, fits_a,
                            lambda pr: run(repo, edition, model, pr, work, {}), log, "page")

    # the first page's line budget, from the copy that just filled it
    lines = {}
    for i, (sec, path) in enumerate(SLOTS):
        if path in jump_paths and i in main:
            pid = dict(JUMPS)[path]
            issue = Overlay(repo, read_tex((repo / "content" / f"{edition}.tex").read_text()),
                            probe_model(model, [main[i] if k == i else None for k in range(n)]), work / "stage").apply()
            body = next(p for p in issue["pages"] if p["id"] == pid)["content"].get("body") or []
            lines[path] = round(body_lines(body), 2)

    # 3. phase B: long pieces continue on a Continued page; grow until the half-page slot is full
    home_pages = {p for i in home for p in home[i]}
    def fits_b(pages, i):
        if not page_ok(pages, i):
            return False                          # the first page must still close above its foot
        return any(marker(i) in t.lower() for p, pg in enumerate(pages) if p not in home_pages for t, _ in pg)
    jumpers = {i: main[i] for i, (_, path) in enumerate(SLOTS) if path in lines}
    total, rounds_b = search(jumpers, fits_b,
                             lambda pr: run(repo, edition, model, pr, work, lines), log, "continued")

    slots = []
    for i, (sec, path) in enumerate(SLOTS):
        now = words(get(model, path))
        measured = (now + (total[i] if i in total else main[i])) if i in main else None
        slot = {"section": sec, "path": path, "words": now,
                "main": (now + main[i]) if i in main else None,
                "measured": measured,
                "capacity": int(measured * PUBLISH) if measured else None,
                "pages": [p + 1 for p in home[i]]}
        if path in lines:
            slot["mainLines"] = lines[path]
        slots.append(slot)
    return {"slots": slots, "rounds": rounds_a + rounds_b + 1, "footPt": round(FOOT_PT, 2)}
