"""The studio's edition, laid over the issue's .tex, typeset on demand.

The studio edits the WEB edition: fifteen sections, one theme, one cover. The
press typesets the PRINT edition: content/<edition>.tex, forty-eight A5 pages
over fifteen templates. Most print pages (features, reviews, listings, colophon)
have no field in the studio, so the web model can never be the print source.
What it can be is an overlay: every studio field with a print counterpart
replaces that field, the theme becomes the palette, and every page the studio
knows nothing about is typeset exactly as the .tex has it.

    issue (.tex)  +  studio model  ->  issue'  ->  write_tex  ->  press.build_pdfs
       48 pages       15 sections      48 pages     a temp .tex     booklet.pdf

The mapping below is by page id, which every edition shares (fc, ic, p01 … bc;
`db-latex.py check` proves the structure). A field is written only when the
studio value is non-empty; print copy that is set in capitals stays in capitals
(the kit's labels are), and HTML in the web copy is flattened to text.

Studio images (a path under the repo, or an embedded data: URL) are staged into
an assets directory beside the build, and the .tex refers to them as studio/…;
press.build_pdfs resolves \\dbassets there instead of db-render/.
"""
import base64
import hashlib
import html
import re
import shutil
from pathlib import Path

from . import press
from .reader import read_tex
from .writer import write_tex

# Where the kit's own images live (uploads/…), linked into every staging dir.
KIT_ASSETS = "db-render"
STUDIO_ASSETS = "studio"
# Studio theme keys -> \palette positions (see dailybread.cls).
PALETTE_KEYS = ("ink", "bone", "pink", "orange", "teal", "panel", "muted")

_TAG = re.compile(r"<[^>]+>")
_HEX = re.compile(r"^#?([0-9a-fA-F]{6})$")
_DATA_URL = re.compile(r"^data:([\w/+.-]+);base64,(.*)$", re.S)
_EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}


def plain(value):
    """Web copy as press copy: tags gone, entities resolved, whitespace collapsed."""
    if value is None:
        return ""
    text = html.unescape(_TAG.sub("", str(value)))
    return " ".join(text.split())


def like(existing, value):
    """Keep the case convention of the print field: labels set in capitals stay so."""
    if isinstance(existing, str) and existing and existing == existing.upper() != existing.lower():
        return value.upper()
    return value


def row(existing_rows, index, *fields):
    """A `a | b | c` row, each field cased like the same field of the print row it
    replaces (or the first print row when the studio has more rows than print)."""
    ref = ""
    if isinstance(existing_rows, list) and existing_rows:
        ref = existing_rows[min(index, len(existing_rows) - 1)]
    ref_fields = [f.strip() for f in str(ref).split("|")]
    out = []
    for i, f in enumerate(fields):
        f = plain(f)
        out.append(like(ref_fields[i] if i < len(ref_fields) else "", f))
    return " | ".join(out)


def luminance(hex6):
    """Relative brightness of a 6-digit hex colour, 0 (black) to 1 (white)."""
    r, g, b = (int(hex6[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def sec_no(sec):
    """'Sec.05' -> '05'."""
    m = re.search(r"(\d+)", str(sec or ""))
    return m.group(1).zfill(2) if m else ""


def tag_text(tag):
    """'// interview · forty years of nerve' -> 'interview · forty years of nerve'."""
    return plain(tag).lstrip("/ ").strip()


class Overlay:
    """One studio model over one issue; `apply()` returns the merged issue."""

    def __init__(self, repo, issue, model, stage):
        self.repo = Path(repo)
        self.issue = issue
        self.m = model or {}
        self.stage = Path(stage)
        self.pages = {p["id"]: p for p in issue["pages"]}
        self.touched = set()

    # ---- helpers ---------------------------------------------------------
    def s(self, *path):
        """A studio value by path, '' when absent."""
        v = self.m
        for key in path:
            if isinstance(v, dict) and key in v:
                v = v[key]
            else:
                return ""
        return v if v is not None else ""

    def put(self, page_id, prop, value):
        """Write a print field from a studio value; empty studio values leave the
        print copy alone. Strings keep the print field's case convention."""
        page = self.pages.get(page_id)
        if page is None:
            return
        if isinstance(value, list):
            value = [plain(v) for v in value if plain(v)]
            if not value:
                return
        else:
            value = plain(value)
            if not value:
                return
            value = like(page["content"].get(prop), value)
        page["content"][prop] = value
        self.touched.add(page_id)

    def rows(self, page_id, prop, items, fields):
        """A row list from studio objects: fields names the keys, in row order."""
        page = self.pages.get(page_id)
        if page is None or not isinstance(items, list) or not items:
            return
        existing = page["content"].get(prop)
        out = [row(existing, i, *[it.get(k, "") if isinstance(it, dict) else it for k in fields])
               for i, it in enumerate(items)]
        page["content"][prop] = out
        self.touched.add(page_id)

    def image(self, value):
        """Stage a studio image; returns the path the .tex uses, or '' if none."""
        value = str(value or "")
        if not value:
            return ""
        studio_dir = self.stage / STUDIO_ASSETS
        studio_dir.mkdir(parents=True, exist_ok=True)
        m = _DATA_URL.match(value)
        if m:
            data = base64.b64decode(m.group(2))
            name = hashlib.sha256(data).hexdigest()[:16] + _EXT.get(m.group(1), ".bin")
            (studio_dir / name).write_bytes(data)
            return f"{STUDIO_ASSETS}/{name}"
        src = self.repo / value
        if not src.is_file():
            return ""
        shutil.copyfile(src, studio_dir / src.name)
        return f"{STUDIO_ASSETS}/{src.name}"

    # ---- the mapping -----------------------------------------------------
    def apply(self):
        self.meta()
        self.covers()
        self.letter()
        self.contents()
        self.history()
        self.voices()
        self.comics()
        self.interview()
        self.stickers()
        self.art()
        self.waitlist()
        self.lab()
        self.listings()
        self.colophon()
        return self.issue

    def meta(self):
        meta, m = self.issue["meta"], self.s("meta")
        if plain(m.get("issueNo")):
            meta["issue"] = plain(m["issueNo"])
        if plain(m.get("issueName")):
            meta["theme"] = plain(m["issueName"])
        if plain(m.get("issueNo")) and plain(m.get("season")):
            meta["edition"] = f"{plain(m['issueNo'])} · {plain(m['season']).upper()}"
        theme = self.s("theme")
        hexes = []
        for key in PALETTE_KEYS:
            h = _HEX.match(str(theme.get(key, "")) if isinstance(theme, dict) else "")
            hexes.append(h.group(1).lower() if h else "")
        # all five core colours or nothing: a half palette is worse than the default
        if all(hexes[:5]):
            hexes[5] = hexes[5] or hexes[1]
            hexes[6] = hexes[6] or hexes[0]
            # light ink on dark bone is the inverted scheme (the class swaps the
            # fixed-colour logo on the back cover for it)
            scheme = "inverted" if luminance(hexes[0]) > luminance(hexes[1]) else "upright"
            meta["palette"] = ",".join(hexes + [scheme])

    def covers(self):
        m, f = self.s("meta"), self.s("footer")
        tag = f"{plain(m.get('issueNo'))} — {plain(m.get('issueName'))}" if plain(m.get("issueName")) else ""
        for pid in ("fc", "bc"):
            self.put(pid, "issueTag", tag)
            self.put(pid, "price", self.s("hero", "coverFree"))
            self.put(pid, "publisherLong", m.get("funder"))
            self.put(pid, "tagline", f.get("blurb"))
            self.put(pid, "issn", f.get("issn"))
            if plain(m.get("issueNo")) and plain(m.get("season")):
                self.put(pid, "edition", f"{plain(m['issueNo'])} · {plain(m['season'])}")
        art = self.image(self.s("hero", "coverSrc"))
        if art:
            self.pages["fc"]["content"]["art"] = art
            self.touched.add("fc")

    def letter(self):
        L, m = self.s("letter"), self.s("meta")
        badges = self.s("hero", "badges")
        stamp = badges[0].get("text") if isinstance(badges, list) and badges and isinstance(badges[0], dict) else ""
        for pid in ("ic", "p01"):
            self.put(pid, "body", L.get("paragraphs"))
            self.put(pid, "lead", L.get("dropcap"))
            self.put(pid, "stamp", stamp)
            self.put(pid, "wordmark", m.get("brand"))
            self.put(pid, "subtitle", m.get("tagline"))
            if plain(m.get("issueNo")) and plain(m.get("season")):
                self.put(pid, "mastheadLabel", f"Masthead / {plain(m['issueNo'])} · {plain(m['season'])}")
            self.rows(pid, "masthead", L.get("masthead"), ("role", "name"))
            self.put(pid, "ack", L.get("landAck"))
            self.put(pid, "funderLine", L.get("funderNote"))
            if L.get("tag"):
                self.put(pid, "kicker", f"{sec_no(L.get('sec'))} · {tag_text(L['tag'])}")
            self.put(pid, "title", L.get("headline"))
            self.put(pid, "signoff", L.get("signoff"))

    def contents(self):
        C, m, S = self.s("contents"), self.s("meta"), self.s("submit")
        for pid in ("p02", "p03"):
            self.put(pid, "title", C.get("heading"))
            self.rows(pid, "rows", C.get("toc"), ("pg", "t", "k"))
            self.put(pid, "whoBlurb", C.get("dek"))
            if plain(m.get("issueNo")):
                self.put(pid, "manifestLabel", f"Manifest / {plain(m['issueNo'])}")
            self.put(pid, "manifestTag", C.get("doc"))
            # "<b>Art for the centrefold</b> — A4 landscape…" -> "Art for the centrefold | A4 landscape…"
            take = S.get("takeItems") if isinstance(S, dict) else None
            if isinstance(take, list) and take:
                split = [re.split(r"\s+—\s+", plain(t), maxsplit=1) for t in take]
                self.rows(pid, "subRows", [{"a": p[0], "b": p[1] if len(p) > 1 else ""} for p in split], ("a", "b"))

    def history(self):
        H = self.s("history")
        self.put("p04", "title", H.get("headline"))
        self.put("p04", "body", H.get("paragraphs"))
        self.put("p07", "kicker", H.get("ledgerLabel"))
        self.rows("p07", "table", H.get("ledger"), ("y", "e", "s", "sc"))
        self.put("p07", "note2", H.get("method"))

    def voices(self):
        reports = self.s("voices", "reports")
        if not isinstance(reports, list):
            return
        for pid, r in zip(("p11", "p12", "p13"), reports):
            if not isinstance(r, dict):
                continue
            if r.get("no"):
                self.put(pid, "tag", f"Young Voices · {plain(r['no'])}")
            self.put(pid, "meta", r.get("meta"))
            self.put(pid, "title", r.get("title"))
            body = r.get("body")
            self.put(pid, "body", body if isinstance(body, list) else re.split(r"\n\s*\n", str(body or "")))

    def comics(self):
        K = self.s("comics")
        for pid in ("p14", "p15", "p42"):
            self.put(pid, "credit", K.get("credit"))
        self.put("p14", "title", K.get("title"))

    def interview(self):
        I = self.s("interview")
        q = plain(I.get("quote"))
        if q and not q.startswith(("“", '"')):
            q = f"“{q}”"
        for pid in ("p16", "p17"):
            self.put(pid, "quote", q)

    def stickers(self):
        S = self.s("stickers")
        items = S.get("items") if isinstance(S, dict) else None
        page = self.pages.get("p20")
        if page is None:
            return
        self.put("p20", "brand", S.get("title"))
        self.put("p20", "brandSub", S.get("sheetMeta"))
        if isinstance(items, list) and items:
            # LABEL | shape | accent | bone — the shape is the print row's, the studio has none
            existing = page["content"].get("stickers") or []
            bone = self.s("theme", "bone") or "#f6f1e7"
            out = []
            for i, it in enumerate(items):
                ref = [f.strip() for f in str(existing[min(i, len(existing) - 1)]).split("|")] if existing else []
                shape = ref[1] if len(ref) > 1 else "circle"
                out.append(row(existing, i, it.get("label", ""), shape, it.get("c", "") or "#f0477d", bone))
            page["content"]["stickers"] = out
            self.touched.add("p20")

    def art(self):
        A = self.s("art")
        for pid in ("p20", "p22", "p23", "p24"):
            self.put(pid, "title", A.get("colourHd"))

    def waitlist(self):
        W = self.s("waitlist")
        self.put("p25", "title", W.get("title"))
        self.put("p25", "dek", W.get("dek"))
        self.put("p25", "kicker", W.get("label"))
        self.rows("p25", "stats", W.get("stats"), ("n", "l"))
        D = self.s("directory")
        self.put("p27", "checkTitle", D.get("checklistLabel"))
        self.put("p27", "checklist", D.get("checklist"))

    def lab(self):
        L = self.s("lab")
        for pid in ("p30", "p31"):
            self.put(pid, "title", L.get("title"))
            self.put(pid, "logoSub", L.get("subhead"))
            self.put(pid, "body", L.get("paragraphs"))
            self.put(pid, "stamp", L.get("stamp"))
            self.put(pid, "sig", L.get("scribble"))
            self.put(pid, "statusLabel", L.get("statusLabel"))
            self.put(pid, "statusTag", L.get("statusHd"))
            self.rows(pid, "status", L.get("status"), ("t", "s", "c"))
            self.put(pid, "whyTitle", L.get("whyTitle"))
            self.put(pid, "whyBody", L.get("why"))
            self.put(pid, "footNote", L.get("tourNote"))

    def listings(self):
        C, D, S = self.s("calendar"), self.s("directory"), self.s("submit")
        # p37 screenings
        self.rows("p37", "rows", C.get("screenings"), ("d", "f", "p"))
        self.put("p37", "kicker", C.get("screeningsLabel"))
        self.put("p37", "schedLabel", C.get("screeningsTitle"))
        self.put("p37", "schedTag", C.get("screeningsDoc"))
        self.put("p37", "schedFoot", C.get("screeningsNote"))
        self.put("p37", "voteTitle", C.get("voteTitle"))
        self.put("p37", "votes", C.get("voteFilms"))
        # p38 calendar
        self.rows("p38", "rows", C.get("events"), ("d", "t", "w"))
        self.put("p38", "title", C.get("title"))
        self.put("p38", "boxLabel", C.get("eventsRange"))
        self.put("p38", "boxTag", C.get("eventsDoc"))
        self.put("p38", "footNote", C.get("dek"))
        self.put("p38", "voteTitle", S.get("voteTitle"))
        self.put("p38", "votes", S.get("voteItems"))
        # p39 directory
        self.rows("p39", "rows", D.get("items"), ("t", "w"))
        self.put("p39", "boxLabel", D.get("boxTitle"))
        self.put("p39", "footNote", D.get("note"))
        self.put("p39", "dirKicker", D.get("label"))

    def colophon(self):
        F = self.s("footer")
        for pid in ("p44", "ibc"):
            self.put(pid, "colophon", F.get("colophon"))
            self.put(pid, "sig", F.get("seeYou"))


def apply(repo, issue, model, stage):
    """Merge `model` (the studio's edition JSON) into `issue`; images go to `stage`."""
    return Overlay(repo, issue, model, stage).apply()


def typeset(repo, edition, model, workdir):
    """content/<edition>.tex with the studio model laid over it -> booklet.pdf.
    Returns (booklet_path, info) where info has pages, sides and the touched ids."""
    repo, workdir = Path(repo), Path(workdir)
    tex_src = repo / "content" / f"{edition}.tex"
    if not tex_src.is_file():
        raise FileNotFoundError(f"no such edition: content/{edition}.tex")
    # The class resolves the kit's own art as \dbassets../tools/latex/assets/…, so
    # the staging dir mirrors the repo: root/db-render/ beside a link to tools/.
    root = workdir / "root"
    stage = root / KIT_ASSETS
    stage.mkdir(parents=True, exist_ok=True)
    for link, target in ((root / "tools", repo / "tools"),
                         (stage / "uploads", repo / KIT_ASSETS / "uploads")):
        if not link.exists():
            link.symlink_to(target)

    issue = read_tex(tex_src.read_text())
    n = len(issue["pages"])
    ov = Overlay(repo, issue, model, stage)
    issue = ov.apply()
    tex = workdir / "issue.tex"
    tex.write_text(write_tex(issue))

    one_up, booklet = press.build_pdfs(repo, tex, workdir / "build", assets=stage)
    pages, w, h = press.pdf_geometry(booklet)
    got = press.pdf_geometry(one_up)
    if got[0] != n:
        raise RuntimeError(f"overlay typeset to {got[0]} pages, the issue has {n}")
    # A field too long for its box does not add a page; it runs off the trim and
    # TeX says so in the log. Reported, not fatal: the proof shows where.
    overfull = press.overfull_boxes(workdir / "build" / "print.log")
    return booklet, {"pages": n, "sides": pages, "sheets": pages // 2,
                     "sheetWidthPt": round(w, 2), "sheetHeightPt": round(h, 2),
                     "overfull": overfull, "touched": sorted(ov.touched),
                     "palette": issue["meta"].get("palette", "")}
