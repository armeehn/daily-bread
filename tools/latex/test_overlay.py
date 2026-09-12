#!/usr/bin/env python3
"""The studio overlay must never break the issue, whatever the studio sends.

    python3 tools/latex/test_overlay.py

No TeX here: this proves overlay.apply() and the .tex round-trip of its output.
That the merged issue also typesets is press-booklet.yml's overlay smoke step,
and `db-latex.py press --model` by hand.
"""
import base64
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools" / "latex"))
from dblatex import overlay  # noqa: E402
from dblatex.reader import read_tex  # noqa: E402
from dblatex.writer import write_tex  # noqa: E402

EDITION = "issue-01"
PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")

ok, bad = [], []
def check(name, cond, extra=""):
    (ok if cond else bad).append(name + (f" — {extra}" if extra else ""))


def issue():
    return read_tex((REPO / "content" / f"{EDITION}.tex").read_text())


def default_model():
    script = 'const DB=require(process.argv[1]);process.stdout.write(JSON.stringify(DB.clone(DB.DEFAULT_MODEL)))'
    out = subprocess.run(["node", "-e", script, str(REPO / "db.js")], check=True,
                         capture_output=True, text=True).stdout
    return json.loads(out)


def shape(iss):
    return [(p["id"], p["template"], p.get("variant")) for p in iss["pages"]]


def roundtrips(iss):
    """write -> read must give the same issue back: every value survived escaping."""
    return read_tex(write_tex(iss)) == iss


with tempfile.TemporaryDirectory() as tmp:
    stage = Path(tmp)
    base = issue()
    model = default_model()

    # ---- the default model over its own issue ----------------------------------
    merged = overlay.apply(REPO, copy.deepcopy(base), model, stage)
    check("page ids, templates and variants are untouched", shape(merged) == shape(base))
    check("48 pages in, 48 pages out", len(merged["pages"]) == len(base["pages"]) == 48)
    pal = merged["meta"].get("palette", "")
    check("theme became a palette of seven hexes and a scheme", len(pal.split(",")) == 8 and pal.endswith(",upright"), pal)
    p01 = next(p for p in merged["pages"] if p["id"] == "p01")["content"]
    check("letter headline is the studio's", p01["title"] == overlay.plain(model["letter"]["headline"]), repr(p01["title"]))
    check("a capitals field stays in capitals", p01["mastheadLabel"] == p01["mastheadLabel"].upper(), p01["mastheadLabel"])
    check("masthead rows are `ROLE | name`", all(" | " in r and r.split(" | ")[0].isupper() for r in p01["masthead"]), str(p01["masthead"][:2]))
    fc = next(p for p in merged["pages"] if p["id"] == "fc")["content"]
    check("cover art was staged under studio/", fc["art"].startswith("studio/") and (stage / fc["art"]).is_file(), fc["art"])
    check("merged issue round-trips through the .tex notation", roundtrips(merged))
    untouched = [p for p in merged["pages"] if p["id"] in ("p28", "p29", "p32", "p35")]
    orig = {p["id"]: p for p in base["pages"]}
    check("pages with no studio field are byte-for-byte the .tex's", all(p == orig[p["id"]] for p in untouched))

    # ---- an empty model changes nothing ---------------------------------------
    same = overlay.apply(REPO, copy.deepcopy(base), {}, stage)
    check("empty model: issue unchanged", same == base)
    check("empty model: no palette", "palette" not in same["meta"])

    # ---- a hostile model: wrong types, markup, every TeX special --------------
    specials = "100% #1 & $5 _x_ {y} \\z ~ ^ <b>bold</b> &amp; “quotes” — 🍞"
    hostile = {
        "meta": {"issueNo": 7, "issueName": specials, "season": ["not", "a", "string"]},
        "theme": {"ink": "not-a-colour", "bone": "#000000"},
        "letter": {"headline": ["a", "list"], "paragraphs": "one string, not a list",
                   "masthead": [{"role": None, "name": specials}, "a bare string", 42],
                   "dropcap": {"nested": "dict"}, "sec": None, "tag": specials},
        "contents": {"toc": "nope", "heading": specials},
        "voices": {"reports": [{"no": 1, "body": specials + "\n\nsecond paragraph"}, None, "x"]},
        "calendar": {"events": [{"d": specials}], "screenings": [], "voteFilms": [1, 2]},
        "lab": {"status": [{"t": specials, "s": "", "c": "#zz"}], "paragraphs": ["", "  ", specials]},
        "stickers": {"items": [{"label": specials, "c": ""}]},
        "hero": {"coverSrc": "../../etc/passwd", "badges": "nope"},
        "footer": {"blurb": specials * 40},
    }
    try:
        rough = overlay.apply(REPO, copy.deepcopy(base), hostile, stage)
        check("hostile model: apply() does not raise", True)
    except Exception as e:  # noqa: BLE001
        rough = None
        check("hostile model: apply() does not raise", False, repr(e))
    if rough:
        check("hostile model: structure intact", shape(rough) == shape(base))
        check("hostile model: no palette from a non-hex theme", "palette" not in rough["meta"])
        check("hostile model: round-trips (TeX specials escaped)", roundtrips(rough))
        p01 = next(p for p in rough["pages"] if p["id"] == "p01")["content"]
        check("hostile model: HTML flattened", "<b>" not in p01["kicker"] and "bold" in p01["kicker"].lower(), p01["kicker"])
        check("hostile model: a list where a string belongs is joined, not crashed", isinstance(p01["title"], str))
        check("hostile model: a string where a list belongs becomes one paragraph", p01["body"] == ["one string, not a list"], str(p01["body"]))
        fc = next(p for p in rough["pages"] if p["id"] == "fc")["content"]
        check("hostile model: a path outside the repo is ignored", fc["art"] == orig["fc"]["content"]["art"], fc["art"])
        empties = [(p["id"], k) for p in rough["pages"] for k, v in p["content"].items()
                   if v == "" and orig[p["id"]]["content"].get(k) != ""]
        check("hostile model: no field was blanked", not empties, str(empties[:5]))

    # ---- themes ----------------------------------------------------------------
    night = copy.deepcopy(model)
    night["theme"] = {"ink": "#f4eee2", "bone": "#191622", "pink": "#ff5c8a", "orange": "#ffb43d", "teal": "#3ad0b0"}
    inv = overlay.apply(REPO, copy.deepcopy(base), night, stage)
    check("light ink on dark bone is the inverted scheme", inv["meta"]["palette"].endswith(",inverted"), inv["meta"]["palette"])
    check("missing panel/muted fall back to bone/ink", inv["meta"]["palette"].split(",")[5:7] == ["191622", "f4eee2"])

    # ---- images ----------------------------------------------------------------
    emb = copy.deepcopy(model)
    emb["hero"]["coverSrc"] = "data:image/png;base64," + base64.b64encode(PNG_1PX).decode()
    e = overlay.apply(REPO, copy.deepcopy(base), emb, stage)
    art = next(p for p in e["pages"] if p["id"] == "fc")["content"]["art"]
    check("an embedded image is written and referenced", art.startswith("studio/") and (stage / art).read_bytes() == PNG_1PX, art)

for l in ok:
    print("  ✓ " + l)
for l in bad:
    print("  ✗ " + l)
print(f"overlay: {len(ok)} pass, {len(bad)} fail")
sys.exit(1 if bad else 0)
