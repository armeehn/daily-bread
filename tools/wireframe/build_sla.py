# build_sla.py — the page plan (spec.json) as a Scribus document.
#
#   xvfb-run -a scribus -g -ns -py tools/wireframe/build_sla.py <spec.json> <out.sla> [<proof.pdf>]
#
# Runs inside Scribus (its scripting API, so the file is Scribus's own): A5
# facing pages from a right-hand page 1, 3 mm bleed, the magazine's margins and
# columns as guides, a baseline grid, CMYK swatches from the theme, paragraph and
# character styles measured off the CSS at print scale, left and right master
# pages with a running foot and an automatic folio, and on every page the
# section's ground, its pictures as empty image frames and its text as labelled
# text frames, each in its own layer. With a third argument it also exports a
# proof PDF with bleed and crop marks.
import json
import os
import sys

import scribus

sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))
from plan import PT, ROLE_NAMES, KEEP_BREAKS, cmyk, dark_swatches, font, styles, style_for, label, text_lines, foot, master_for  # noqa: E402

SPEC, OUT = sys.argv[1], sys.argv[2]
PROOF = sys.argv[3] if len(sys.argv) > 3 else None
spec = json.load(open(SPEC, encoding="utf-8"))
W, H = spec["trimMm"]
BLEED = spec["bleedMm"]
M = spec["marginsMm"]
N = len(spec["pages"])

# ---- the document --------------------------------------------------------
scribus.newDocument((W, H), (M["inside"], M["outside"], M["top"], M["bottom"]), scribus.PORTRAIT, 1,
                    scribus.UNIT_MILLIMETERS, scribus.PAGE_2, 1, N)
scribus.setBleeds(BLEED, BLEED, BLEED, BLEED)
scribus.setBaseLine(spec["baselinePt"] * PT, M["top"])
scribus.setInfo("Daily Bread", spec["title"] + " — production wireframe", "A5 saddle-stitched, " + str(N) + " pages")
scribus.setRedraw(False)

# ---- swatches: the theme, as CMYK (a plain conversion; proof before press) --
SW = {}
for s in spec["swatches"]:
    name = "DB " + s["name"]
    scribus.defineColorCMYKFloat(name, *cmyk(s["hex"]))
    SW[s["name"]] = name
DARK = dark_swatches(spec)

# ---- type: one style per role and face (plan.styles) ------------------------
ALIGN = {"left": 0, "start": 0, "center": 1, "right": 2, "end": 2, "justify": 3}
TABLE = styles(spec)

def scribus_font(st):
    fam_, sty = font(st)
    return fam_ + " " + sty

for (role, fc, rev), (name, st) in TABLE.items():
    feats = ["inherit"] + (["allcaps"] if st.get("caps") else [])
    scribus.createCharStyle(name=name, font=scribus_font(st), fontsize=max(4.0, st["sizePt"]),
                            features=",".join(feats), fillcolor=SW.get("bone" if rev else "ink"),
                            tracking=round((st.get("trackingEm") or 0) * 1000))
    scribus.createParagraphStyle(name=name, linespacingmode=0, linespacing=st["leadingPt"],
                                 alignment=ALIGN.get(st.get("align"), 0), charstyle=name)
# the folio and running foot
scribus.createCharStyle(name="Folio", font="IBM Plex Mono Bold", fontsize=6.5, features="inherit,allcaps",
                        fillcolor=SW.get("ink"), tracking=140)
scribus.createParagraphStyle(name="Folio left", linespacingmode=0, linespacing=8, alignment=0, charstyle="Folio")
scribus.createParagraphStyle(name="Folio right", linespacingmode=0, linespacing=8, alignment=2, charstyle="Folio")
scribus.createCharStyle(name="Folio · reversed", font="IBM Plex Mono Bold", fontsize=6.5, features="inherit,allcaps",
                        fillcolor=SW.get("bone"), tracking=140)
scribus.createParagraphStyle(name="Folio left · reversed", linespacingmode=0, linespacing=8, alignment=0, charstyle="Folio · reversed")
scribus.createParagraphStyle(name="Folio right · reversed", linespacingmode=0, linespacing=8, alignment=2, charstyle="Folio · reversed")
scribus.createCharStyle(name="Note", font="IBM Plex Mono Regular", fontsize=6, features="inherit",
                        fillcolor=SW.get("pink"))
scribus.createParagraphStyle(name="Note", linespacingmode=0, linespacing=7.5, alignment=1, charstyle="Note")

# ---- layers: ground at the back, notes on top and never printed ------------
for name in ("Ground", "Art", "Text", "Notes"):
    scribus.createLayer(name)
scribus.setLayerPrintable("Notes", False)
scribus.setActiveLayer("Text")                    # a new layer becomes the active one: the masters' text goes on Text

# ---- master pages: a running foot and the folio, mirrored ------------------
FOOT = foot(spec)
def folio_master(name, left, rev=False):
    sfx = " · reversed" if rev else ""
    scribus.createMasterPage(name)
    scribus.closeMasterPage()
    scribus.editMasterPage(name)                   # drawing goes on the master only while it is being edited
    scribus.setActiveLayer("Text")
    y = H - M["bottom"] + 4
    outer_x = M["outside"] if left else M["inside"]
    frame_w = W - M["inside"] - M["outside"]
    f = scribus.createText(outer_x, y, frame_w, 5, name + " folio")
    scribus.setText(chr(30) if left else FOOT, f)      # chr(30): Scribus's page-number character
    scribus.setParagraphStyle("Folio left" + sfx, f)
    g = scribus.createText(outer_x, y, frame_w, 5, name + " foot")
    scribus.setText(FOOT if left else chr(30), g)
    scribus.setParagraphStyle("Folio right" + sfx, g)
    for item in (f, g):
        scribus.setTextDistances(0, 0, 0, 0, item)
    scribus.setVGuides([M["outside"] if left else M["inside"], W - (M["inside"] if left else M["outside"])])
    scribus.closeMasterPage()
folio_master("A-Left", True)
folio_master("A-Right", False)
folio_master("B-Left", True, rev=True)            # for dark grounds: the foot in bone
folio_master("B-Right", False, rev=True)

# ---- the pages --------------------------------------------------------------
seq = 0
def name_for(page, f, kind):
    global seq
    seq += 1
    return "p%02d %s %s %d" % (page["n"], page["key"], kind, seq)

for page in spec["pages"]:
    n = page["n"]
    scribus.gotoPage(n)
    # page 1 is a right-hand page: odd pages right, even left
    mp = master_for(page, spec)
    side = "Right" if n % 2 else "Left"
    # no master on the covers: Scribus's own empty "Normal" masters
    scribus.applyMasterPage(("%s-%s" % (mp, side)) if mp else ("Normal " + side), n)
    scribus.setActiveLayer("Ground")
    # the ground bleeds off the outer edge, the head and the foot, never across the spine
    right = n % 2 == 1
    g = scribus.createRect(0 if right else -BLEED, -BLEED, W + BLEED, H + 2 * BLEED, "p%02d ground" % n)
    scribus.setFillColor(SW.get(page["ground"] or "bone", SW["bone"]), g)
    scribus.setLineColor("None", g)
    dark = (page["ground"] in DARK)
    for f in page["frames"]:
        x, y, w, h = f["x"], f["y"], f["w"], f["h"]
        role = f["role"]
        if role in ("image",):
            scribus.setActiveLayer("Art")
            nm = name_for(page, f, "image")
            im = scribus.createImage(x, y, w, h, nm)
            scribus.setFillColor(SW.get("panel", SW["bone"]), im)
            scribus.setLineColor(SW.get("muted", SW["ink"]), im)
            scribus.setLineWidth(0.5, im)
            scribus.setActiveLayer("Notes")
            note = scribus.createText(x + 2, y + max(0, h / 2 - 6), max(4, w - 4), min(12, h), nm + " note")
            scribus.setText("IMAGE — " + (f.get("alt") or "picture")[:120], note)
            scribus.setParagraphStyle("Note", note)
            continue
        if role in ("card", "stat"):
            scribus.setActiveLayer("Art")
            if f.get("shadow") or role == "stat":
                s = scribus.createRect(x + 1.27, y + 1.27, w, h, name_for(page, f, "card shadow"))
                scribus.setFillColor(SW.get("ink"), s)
                scribus.setLineColor("None", s)
            c = scribus.createRect(x, y, w, h, name_for(page, f, role))
            scribus.setFillColor(SW.get(f.get("fill") or ("dark" if dark else "bone"), SW["bone"]), c)
            scribus.setLineColor(SW.get(f.get("stroke") or "ink", SW["ink"]), c)
            scribus.setLineWidth(1.2, c)
            if role == "card":
                continue
        if role == "cardhead" and f.get("fill"):
            scribus.setActiveLayer("Art")
            b = scribus.createRect(x, y, w, h, name_for(page, f, "card bar"))
            scribus.setFillColor(SW.get(f["fill"], SW["ink"]), b)
            scribus.setLineColor("None", b)
        if role not in ROLE_NAMES:
            continue
        scribus.setActiveLayer("Text")
        st0 = f.get("style") or {}
        # room for the last line's descenders: a browser's line box holds them, a frame's height must
        pad = (0.6 if role in ("headline", "wordmark", "pull") else 0.35) * (st0.get("leadingPt") or 10) * PT
        # and a little width: Scribus and Chromium track and kern a hair differently
        t = scribus.createText(x, y, max(w, 2) * 1.04, max(h, 2) + pad, name_for(page, f, ROLE_NAMES[role].lower()))
        text = "\r".join(text_lines(f))
        scribus.setText(text, t)
        # the first baseline one line down, as a browser stacks lines (not at the font's ascent)
        scribus.setFirstLineOffset(scribus.FLOP_LINESPACING, t)
        st = f.get("style") or {}
        sty, own = style_for(f, page, spec, TABLE)
        if sty:
            scribus.setParagraphStyle(sty[0], t)
            # this page prints at another scale than the style's: size and leading follow it
            if own:
                scribus.setFontSize(max(4.0, st["sizePt"]), t)
                scribus.setLineSpacing(st["leadingPt"], t)
        if role == "stat" and "\r" not in text and " " in text:
            pass
        if role == "stat":
            # the number big, its label small beneath it (.stat .n and .stat .l)
            first = label(f).split("\n")[0]
            rest = len(scribus.getAllText(t)) - len(first)
            if rest > 0:
                scribus.selectText(len(first), rest, t)
                scribus.setFont("IBM Plex Mono Regular", t)
                scribus.setFontSize(max(4.0, (st.get("sizePt") or 26) * 0.23), t)
                scribus.setLineSpacing(max(5.0, (st.get("sizePt") or 26) * 0.36), t)
        scribus.setTextDistances(0, 0, 0, 0, t)
        if role in ("cardhead",):
            scribus.setTextDistances(3, 3, 2, 1, t)
        if role == "cardbody":                         # .card > .bd's padding: 16px 18px at print scale
            scribus.setTextDistances(3.4, 3.4, 3.0, 3.0, t)

scribus.setRedraw(True)
# frames whose text does not fit: reported, so the wireframe's labels can be checked
# A frame the browser's wrapping just fitted may be a line short in Scribus's
# (justification and hyphenation differ): it is deepened until its copy fits,
# by up to half again, as a designer would; anything still over is reported.
over, grown = [], []
for page in range(1, N + 1):
    scribus.gotoPage(page)
    for item in scribus.getPageItems():
        if item[1] != 4 or item[0].endswith(" note") or "folio" in item[0] or " foot" in item[0]:
            continue
        try:
            scribus.layoutText(item[0])
            if not scribus.textOverflows(item[0]):
                continue
            w0, h0 = scribus.getSize(item[0])
            h = h0
            while scribus.textOverflows(item[0]) and h < h0 * 1.5:
                h += 0.5
                scribus.sizeObject(w0, h, item[0])
                scribus.layoutText(item[0])
            (over if scribus.textOverflows(item[0]) else grown).append("%s  %.1f -> %.1f mm" % (item[0], h0, h))
        except Exception as e:
            over.append("%s  (%s)" % (item[0], e))
open(OUT + ".overflow.txt", "w", encoding="utf-8").write(
    "still over:\n" + "".join(x + "\n" for x in over) + "deepened to fit:\n" + "".join(x + "\n" for x in grown))
scribus.gotoPage(1)
scribus.saveDocAs(OUT)

if PROOF:
    pdf = scribus.PDFfile()
    pdf.file = PROOF
    pdf.useDocBleeds = True
    pdf.cropMarks = True
    pdf.bleedMarks = False
    pdf.markLength = 5 / PT
    pdf.markOffset = BLEED / PT
    pdf.fontEmbedding = 0
    pdf.save()
