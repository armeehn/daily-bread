#!/usr/bin/env python3
"""Daily Bread merch, one edition at a time, from the edition's own model.

    python3 tools/merch/merch.py issue-02              # artwork + mockups + manifest
    python3 tools/merch/merch.py issue-02 --publish    # ...and upsert into Shopify

Reads content/<edition>.js (generated from the .tex, the source of truth) and
turns what the edition already contains into products:

    Cover      art  -> cover tee, crewneck, tote (10 x 15 in print), 12 x 18 poster
    Outline    pdf  -> the line drawing on tee, crewneck, tote, poster (assets/outline-NN.pdf)
    quotes     list -> a tee per quote
    Peel Me    list -> A5 kiss-cut sticker sheet, and 3 in die-cut singles

Two products per edition: everything above the Peel Me line is ONE product
(db-NN, options Item / Colour / Size, prints at "One size"); Peel Me is the
other (db-NN-peel-me, the sheet and each single as a Design). The Wall was
retired 2026-09-12 and its code went with the one-product fold.

Output, under merch/<edition>/:

    print/    transparent PNG print files at 300 dpi
    pdf/      the same at true physical size, vector where the source is vector
    mockup/   flat renders for the shop
    products.json   everything --publish needs, so a human can read it first

Nothing here invents artwork.  If the edition has no outline file or Peel Me
page yet those items are skipped and said so; a placeholder page is not merch.

Needs: python3 + Pillow, rsvg-convert, node (to read the model), IBM Plex Mono
installed, and the repo's own UnifrakturMaguntia (tools/latex/fonts) which this
script hands to fontconfig itself.  --publish needs credentials: see token().
"""
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("MERCH_BLANKS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "blanks"))
import photomock  # noqa: E402  photographic mockups on the blank photos

REPO = Path(__file__).resolve().parents[2]
FONT_DIR = REPO / "tools" / "latex" / "fonts"

# 12 x 16 in print sheet at 300 dpi; art is placed 10 x 15 in on it
DPI = 300
PW, PH = 12 * DPI, 16 * DPI
ART_W, ART_H = 10 * DPI, 15 * DPI
MOCK = 1600

INK = "#1d1a17"
BONE = "#f6f1e7"
BONE_DIM = "#eae4d6"
PINK = "#f0477d"
MUTED = "#8d857a"
FRAKTUR = "UnifrakturMaguntia"
PLEX = "IBM Plex Mono"

SIZES = ["XS", "S", "M", "L", "XL", "2XL"]
GARMENTS = {"Bone": BONE, "Ink": INK}
PRICE_TEE, PRICE_CREW, PRICE_POSTER, PRICE_STICKERS = "28.00", "50.00", "20.00", "6.00"
PRICE_TOTE, PRICE_SINGLE = "18.00", "2.00"
ONE_SIZE = "One size"       # what a print answers to the Size option
FULL = "Full colour"        # what a full-bleed print answers to Colour
COLOURS = ["Bone", "Ink", "Natural", FULL]
POSTER_W, POSTER_H = 12 * DPI, 18 * DPI   # the cover as a print, full bleed
SINGLE_MM, SINGLE_BLEED = 76, 2           # 3 in die-cut, 2 mm bleed
VENDOR = "Daily Bread"
APPAREL_COLLECTION = "daily-bread-apparel"

# A5 sticker sheet, mm
SHEET_W, SHEET_H = 148, 210


# ── model ─────────────────────────────────────────────────────────────────

def load_edition(name):
    js = REPO / "content" / f"{name}.js"
    if not js.exists():
        sys.exit(f"no such edition: {js}")
    out = subprocess.check_output(
        ["node", "-e", f"console.log(JSON.stringify(require({json.dumps(str(js))})))"],
        text=True)
    return json.loads(out)


def page(model, template, variant=None):
    for p in model["pages"]:
        if p["template"] == template and (variant is None or p.get("variant") == variant):
            return p
    return None


def issue_no(model):
    """'№2' -> ('2', '02')"""
    n = re.sub(r"\D", "", model["meta"]["issue"])
    return n, n.zfill(2)


# ── rendering ─────────────────────────────────────────────────────────────

def fontconfig(tmp):
    """Point fontconfig at the system fonts plus the repo's own faces."""
    conf = tmp / "fonts.conf"
    conf.write_text(f"""<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>{FONT_DIR}</dir>
  <cachedir>{tmp}/fc-cache</cachedir>
</fontconfig>""")
    env = dict(os.environ)
    env["FONTCONFIG_FILE"] = str(conf)
    return env


def rsvg(env, svg, out, width=None, fmt=None):
    cmd = ["rsvg-convert", "-o", str(out)]
    if width:
        cmd += ["-w", str(width)]
    if fmt:
        cmd += ["-f", fmt]
    subprocess.run(cmd + [str(svg)], check=True, env=env)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size, family, weight=400, fill=INK, tracking="0", anchor="middle"):
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" '
            f'letter-spacing="{tracking}">{esc(s)}</text>')


def sheet(inner, w_in=12, h_in=16, vw=PW, vh=PH):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{w_in}in" height="{h_in}in" viewBox="0 0 {vw} {vh}">\n{inner}\n</svg>')


# ── the three sources ─────────────────────────────────────────────────────

def cover_inner(model, tmp, name, sw=PW, sh=PH, aw=ART_W, ah=ART_H):
    """The cover art, upscaled, with the masthead set over it the way the
    Cover template does.  Returns inner SVG for a sheet of sw x sh with the
    art aw x ah centred on it (the tee print, or the full-bleed poster)."""
    cover = page(model, "Cover", "front")
    art = REPO / "db-render" / cover["content"]["art"]
    img = Image.open(art).convert("RGB")
    # centre-crop to 2:3 then upscale; the art is posterised, Lanczos is kind to it
    w, h = img.size
    if w / h > aw / ah:
        nw = int(h * aw / ah)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w * ah / aw)
        img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    img = img.resize((aw, ah), Image.LANCZOS)
    # a sibling file, not a data URI: 20 MB inline trips libxml's buffer cap
    art_png = tmp / f"{name}-art.png"
    img.save(art_png, "PNG", optimize=True)

    x0, y0 = (sw - aw) / 2, (sh - ah) / 2
    tag = cover["content"]["issueTag"]
    edition = cover["content"]["edition"]
    cx = sw / 2
    k = aw / ART_W  # type scales with the art
    return "\n".join([
        f'<image x="{x0}" y="{y0}" width="{aw}" height="{ah}" xlink:href="{art_png.name}"/>',
        # the masthead over the tongue, as on the printed cover: the original
        # blackletter, ink with a bone keyline so it holds on the art
        f'<g font-family="{FRAKTUR}" font-size="{640 * k:.0f}" text-anchor="middle" '
        f'stroke="{BONE}" stroke-width="{28 * k:.0f}" stroke-linejoin="round" paint-order="stroke" fill="{INK}">'
        f'<text x="{cx}" y="{y0 + 1900 * k:.0f}">Daily</text><text x="{cx}" y="{y0 + 2520 * k:.0f}">Bread</text></g>',
        text(cx, y0 + 260 * k, tag, 84 * k, PLEX, 700, BONE, "0.3em"),
        text(cx, y0 + ah - 120 * k, edition, 64 * k, PLEX, 700, BONE, "0.3em"),
    ])


def outline_pdf(model):
    """assets/outline-NN.pdf: the edition's line drawing as delivered for DTF.
    Printed as-is at its own size; black on bone, white on ink."""
    _, nn = issue_no(model)
    p = REPO / "assets" / f"outline-{nn}.pdf"
    return p if p.exists() else None


def outline_pngs(pdf, tmp, name):
    """Render the PDF transparent at 300 dpi, centred on the 12 x 16 sheet;
    return {'Bone': png of black lines, 'Ink': png of white lines}."""
    subprocess.run(["pdftocairo", "-png", "-transp", "-r", str(DPI), "-singlefile", str(pdf), str(tmp / f"{name}-raw")], check=True)
    raw = Image.open(tmp / f"{name}-raw.png").convert("RGBA")
    # fit on the sheet if the page is bigger than the print area; never enlarge
    k = min(1.0, ART_W / raw.width, ART_H / raw.height)
    if k < 1.0:
        raw = raw.resize((int(raw.width * k), int(raw.height * k)), Image.LANCZOS)
    out = {}
    for ground, colour in (("Bone", (29, 26, 23)), ("Ink", (246, 241, 231))):
        sheet_img = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
        alpha = raw.split()[3]
        ink = Image.new("RGBA", raw.size, colour + (0,))
        ink.putalpha(alpha)
        sheet_img.paste(ink, ((PW - raw.width) // 2, (PH - raw.height) // 2), ink)
        path = tmp / f"{name}-{ground.lower()}.png"
        sheet_img.save(path, "PNG", optimize=True)
        out[ground] = path
    return out


def sticker_items(model):
    pg = page(model, "Insert", "stickers")
    if not pg:
        return None, []
    items = []
    for row in pg["content"]["stickers"]:
        label, shape, bg, fg = [t.strip() for t in row.split("|")]
        items.append((label, shape, bg, fg))
    return pg, items


def sticker(cx, cy, size, label, shape, bg, fg, cut=True):
    """One sticker at (cx, cy) in mm: the shape, the label wrapped and fitted,
    a dashed die line 1 mm outside if `cut`."""
    out, cuts = [], []
    if shape == "circle":
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{size / 2}" fill="{bg}"/>')
        cuts.append(f'<circle cx="{cx}" cy="{cy}" r="{size / 2 + 1}"/>')
    else:
        out.append(f'<rect x="{cx - size / 2}" y="{cy - size / 2}" width="{size}" height="{size}" fill="{bg}"/>')
        cuts.append(f'<rect x="{cx - size / 2 - 1}" y="{cy - size / 2 - 1}" width="{size + 2}" height="{size + 2}"/>')
    lines = wrap(label, 12)
    fs = min(size * 0.121, size * 0.79 / (0.62 * max(len(l) for l in lines)))
    lh = fs * 1.15
    y = cy - lh * (len(lines) - 1) / 2 + fs * 0.35
    for j, l in enumerate(lines):
        out.append(text(cx, y + j * lh, l, fs, PLEX, 700, fg, "0.02em"))
    if cut:
        out.append(f'<g fill="none" stroke="#b7ad9e" stroke-width="0.25" stroke-dasharray="1.2 1">{"".join(cuts)}</g>')
    return "".join(out)


def single_svg(label, shape, bg, fg):
    """A 3 in die-cut single with 2 mm bleed on an 80 mm square."""
    side = SINGLE_MM + 2 * SINGLE_BLEED
    c = side / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{side}mm" height="{side}mm" '
            f'viewBox="0 0 {side} {side}">'
            f'{sticker(c, c, SINGLE_MM + 2 * SINGLE_BLEED, label, shape, bg, fg, cut=False)}'
            f'<g fill="none" stroke="#b7ad9e" stroke-width="0.25" stroke-dasharray="1.2 1">'
            + (f'<circle cx="{c}" cy="{c}" r="{SINGLE_MM / 2}"/>' if shape == "circle" else
               f'<rect x="{SINGLE_BLEED}" y="{SINGLE_BLEED}" width="{SINGLE_MM}" height="{SINGLE_MM}"/>')
            + '</g></svg>')


def quotes(model):
    """Every quotes list in the edition, first occurrence of each."""
    seen, out = set(), []
    for p in model["pages"]:
        for q in p.get("content", {}).get("quotes", []) or []:
            if q not in seen:
                seen.add(q)
                out.append(q)
    return out


def quote_inner(model, q, ink):
    """One quote, set large in Plex, the masthead small above, the edition
    beneath.  Ink is the print colour for the garment."""
    n, _ = issue_no(model)
    theme = model["meta"]["theme"]
    body = q.strip("\u201c\u201d\"")
    lines = wrap(body, 19, max_lines=6)
    fs = min(250, 2800 / (0.6 * max(len(l) for l in lines)))
    lh = fs * 1.25
    y0 = 1750 - lh * (len(lines) - 1) / 2
    out = [text(PW / 2, 620, "Daily Bread", 220, FRAKTUR, 400, ink)]
    out.append(text(PW / 2, y0 - lh * 0.55, "\u201c", fs * 1.6, PLEX, 700, PINK))
    for i, l in enumerate(lines):
        out.append(text(PW / 2, y0 + i * lh, l, fs, PLEX, 700, ink, "-0.01em"))
    out.append(text(PW / 2, y0 + len(lines) * lh + 60, f"DAILY BREAD NO. {n} \u00b7 {theme.upper()}", 64, PLEX, 600, ink, "0.3em"))
    return "\n".join(out)


def stickers_svg(model):
    """The Peel Me page as an A5 kiss-cut sheet: 3x3, circle or square, the
    colours the page lists.  Die lines dashed on their own layer."""
    pg = page(model, "Insert", "stickers")
    if not pg:
        return None
    c = pg["content"]
    n, _ = issue_no(model)
    pg, items = sticker_items(model)
    cell, size = 44, 38
    gx = (SHEET_W - 3 * cell) / 2
    gy = 30
    out = [f'<rect width="{SHEET_W}" height="{SHEET_H}" fill="{BONE}"/>',
           text(SHEET_W / 2, 14, c.get("brand", "Peel Me"), 12, FRAKTUR, 400, INK),
           text(SHEET_W / 2, 20, c.get("brandSub", ""), 2.4, PLEX, 600, MUTED, "0.25em")]
    for i, (label, shape, bg, fg) in enumerate(items[:9]):
        cx = gx + (i % 3) * cell + cell / 2
        cy = gy + (i // 3) * cell + cell / 2
        out.append(sticker(cx, cy, size, label, shape, bg, fg))
    out.append(text(SHEET_W / 2, SHEET_H - 12, f"DAILY BREAD №{n} · KISS-CUT · CUT LINES DASHED", 2.4, PLEX, 600, MUTED, "0.25em"))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SHEET_W}mm" height="{SHEET_H}mm" '
            f'viewBox="0 0 {SHEET_W} {SHEET_H}">{"".join(out)}</svg>')


def wrap(s, width, max_lines=3):
    words, lines, cur = s.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    lines.append(cur)
    return lines[:max_lines]


# ── mockups ───────────────────────────────────────────────────────────────

TEE = ("M380 190 C 420 235 580 235 620 190 L 760 230 L 850 420 L 730 460 "
       "L 730 900 L 270 900 L 270 460 L 150 420 L 240 230 Z")
CREW = ("M380 190 C 420 235 580 235 620 190 L 770 228 L 842 622 L 730 652 "
        "L 730 900 L 270 900 L 270 652 L 158 622 L 230 228 Z")
CREW_SEAMS = ('<path d="M730 330 L 730 652 M270 330 L 270 652 M270 862 L 730 862 '
              'M158 622 L 270 652 M842 622 L 730 652" fill="none" stroke="#00000033" stroke-width="3"/>')
COLLAR = '<ellipse cx="500" cy="192" rx="122" ry="34"/>'
PRINT_X, PRINT_Y, PRINT_W = 330, 300, 340


def garment_mockup(design_inner, fill, kind):
    body = TEE if kind == "tee" else CREW
    seams = "" if kind == "tee" else CREW_SEAMS
    ph = PRINT_W * PH / PW
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{MOCK}" height="{MOCK}" viewBox="80 110 840 840">
<rect x="80" y="110" width="840" height="840" fill="{BONE_DIM}"/>
<g fill="{fill}" stroke="#00000044" stroke-width="3">{COLLAR}</g>
<path d="{body}" fill="{fill}" stroke="#00000033" stroke-width="3"/>
{seams}
<svg x="{PRINT_X}" y="{PRINT_Y}" width="{PRINT_W}" height="{ph:.1f}" viewBox="0 0 {PW} {PH}">{design_inner}</svg>
</svg>'''


TOTE = ("M 300 330 L 300 900 L 700 900 L 700 330 Z")
TOTE_HANDLES = ('<path d="M 380 330 C 380 120 620 120 620 330" fill="none" stroke-width="26" stroke-linecap="round"/>')


def tote_mockup(design_inner, fill):
    """A canvas tote, print 12 x 14 in centred on the face."""
    pw = 300
    ph = pw * PH / PW
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{MOCK}" height="{MOCK}" viewBox="80 110 840 840">
<rect x="80" y="110" width="840" height="840" fill="{BONE_DIM}"/>
<g stroke="{fill}" fill="none">{TOTE_HANDLES}</g>
<g stroke="#00000044" fill="none">{TOTE_HANDLES}</g>
<path d="{TOTE}" fill="{fill}" stroke="#00000033" stroke-width="3"/>
<svg x="{500 - pw / 2}" y="{430}" width="{pw}" height="{ph:.1f}" viewBox="0 0 {PW} {PH}">{design_inner}</svg>
</svg>'''


def flat_mockup(inner_svg, vw, vh):
    """A sheet on the wall with the site's hard pink offset."""
    k = 700 / max(vw, vh)
    w, h = vw * k, vh * k
    x, y = (1000 - w) / 2, (1000 - h) / 2
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{MOCK}" height="{MOCK}" viewBox="0 0 1000 1000">
<rect width="1000" height="1000" fill="{BONE_DIM}"/>
<rect x="{x + 14}" y="{y + 14}" width="{w}" height="{h}" fill="{PINK}"/>
<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{BONE}"/>
<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="0 0 {vw} {vh}">{inner_svg}</svg>
<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="{INK}" stroke-width="3"/>
</svg>'''


# ── products ──────────────────────────────────────────────────────────────

def item(name, images, price, sku, sized=True):
    """One item of the edition product. images: {colour: mockup path}."""
    return {"name": name, "images": images, "price": price, "sku": sku, "sized": sized}


def edition_product(nn, label, body, items):
    """The whole edition as ONE product: options Item / Colour / Size, a
    variant per cell with its own price and mockup; prints answer ONE_SIZE.
    Shopify allows three options, so the cover, outline and quotes ride in Item."""
    images, variants = {}, []
    for it in items:
        for colour, path in it["images"].items():
            key = f"{it['name']}, {colour}"
            images[key] = path
            for sz in (SIZES if it["sized"] else [ONE_SIZE]):
                variants.append({"item": it["name"], "colour": colour, "size": sz, "image": key, "price": it["price"],
                                 "sku": it["sku"] + ("" if colour == FULL else f"-{colour.upper()}")
                                 + (f"-{sz}" if it["sized"] else "")})
    sizes = ([*SIZES] if any(it["sized"] for it in items) else []) + ([ONE_SIZE] if any(not it["sized"] for it in items) else [])
    return {"handle": f"db-{nn}", "title": f"Daily Bread {label}", "descriptionHtml": body, "productType": "Merch",
            "tags": ["apparel", "tee", "crewneck", "poster", "tote", "daily-bread", "merch:auto"],
            "options": ["Item", "Colour", "Size"], "items": [it["name"] for it in items],
            "colours": sorted({c for it in items for c in it["images"]}, key=COLOURS.index), "sizes": sizes,
            "variants": variants, "images": images}


def build(edition, out, publish):
    model = load_edition(edition)
    n, nn = issue_no(model)
    theme = model["meta"]["theme"]
    label = f"№{n} — {theme}"
    for d in ("print", "pdf", "mockup", "tmp"):
        (out / d).mkdir(parents=True, exist_ok=True)
    env = fontconfig(out / "tmp")
    products, items, body = [], [], []     # items + body paragraphs of the edition product

    def emit(name, inner, kinds):
        """Print PNG + PDF once, a mockup per garment colour and kind."""
        svg = out / "tmp" / f"{name}.svg"
        svg.write_text(sheet(inner))
        rsvg(env, svg, out / "print" / f"{name}.png", width=PW)
        rsvg(env, svg, out / "pdf" / f"{name}.pdf", fmt="pdf")
        imgs = {}
        for kind in kinds:
            for g, fill in GARMENTS.items():
                png = out / "mockup" / f"{name}-{kind}-{g.lower()}.png"
                photomock.compose(f"{kind}-{g.lower()}", str(out / "print" / f"{name}.png"), str(png))
                imgs.setdefault(kind, {})[g] = str(png.relative_to(out))
        return imgs

    # 1. the cover
    inner = cover_inner(model, out / "tmp", f"db-{nn}-cover")
    imgs = emit(f"db-{nn}-cover", inner, ("tee", "crew"))
    body.append(f"<p>The cover of Daily Bread {label}, as printed. On a shirt the art sits at 10 × 15 in with "
                f"the masthead over it, front print only, unisex cut. As a 12 × 18 in print it runs full bleed, "
                f"masthead and all. On a natural canvas tote it carries a stack of the magazine, which is the point.</p>")
    items.append(item("Cover Tee", imgs["tee"], PRICE_TEE, f"DB{nn}-CVT"))
    items.append(item("Cover Crewneck", imgs["crew"], PRICE_CREW, f"DB{nn}-CVC"))
    # the tote shares the tee's print file; natural canvas only
    timg = out / "mockup" / f"db-{nn}-cover-tote.png"
    photomock.compose("tote-bone", str(out / "print" / f"db-{nn}-cover.png"), str(timg))
    items.append(item("Cover Tote", {"Natural": str(timg.relative_to(out))}, PRICE_TOTE, f"DB{nn}-CVB", sized=False))
    # the cover as a 12 x 18 print, full bleed
    pinner = cover_inner(model, out / "tmp", f"db-{nn}-cover-poster", POSTER_W, POSTER_H, POSTER_W, POSTER_H)
    ps = out / "tmp" / f"db-{nn}-cover-poster.svg"
    ps.write_text(sheet(pinner, 12, 18, POSTER_W, POSTER_H))
    rsvg(env, ps, out / "print" / f"db-{nn}-cover-poster.png", width=POSTER_W)
    rsvg(env, ps, out / "pdf" / f"db-{nn}-cover-poster.pdf", fmt="pdf")
    pm = out / "tmp" / f"db-{nn}-cover-poster-mock.svg"
    pm.write_text(flat_mockup(pinner, POSTER_W, POSTER_H))
    pimg = out / "mockup" / f"db-{nn}-cover-poster.png"
    rsvg(env, pm, pimg, width=MOCK)
    items.append(item("Cover Poster", {FULL: str(pimg.relative_to(out))}, PRICE_POSTER, f"DB{nn}-CVP", sized=False))
    print("cover:", "tee + crewneck + tote + poster")

    # 1a. the outline: DTF line drawing, tee / crewneck / tote / poster
    opdf = outline_pdf(model)
    if opdf:
        pngs = outline_pngs(opdf, out / "tmp", f"db-{nn}-outline")
        imgs = {"tee": {}, "crew": {}}
        for ground, src in pngs.items():
            g = ground.lower()
            shutil.copy(src, out / "print" / f"db-{nn}-outline-{g}.png")
            for kind in ("tee", "crew"):
                png = out / "mockup" / f"db-{nn}-outline-{kind}-{g}.png"
                photomock.compose(f"{kind}-{g}", str(src), str(png), line_boost=3)
                imgs[kind][ground] = str(png.relative_to(out))
        body.append(f"<p>Outline: the №{n} cover as a line drawing, the DTF print as delivered, black on bone, "
                    f"white on ink, 11 × 14 in on the front. The poster sets the drawing 12 × 18 in on bone paper; "
                    f"the tote carries it in black on natural canvas.</p>")
        items.append(item("Outline Tee", imgs["tee"], PRICE_TEE, f"DB{nn}-OLT"))
        items.append(item("Outline Crewneck", imgs["crew"], PRICE_CREW, f"DB{nn}-OLC"))
        # tote, natural canvas, black lines
        timg = out / "mockup" / f"db-{nn}-outline-tote.png"
        photomock.compose("tote-bone", str(pngs["Bone"]), str(timg), line_boost=3)
        items.append(item("Outline Tote", {"Natural": str(timg.relative_to(out))}, PRICE_TOTE, f"DB{nn}-OLB", sized=False))
        # poster: the drawing on bone, 12 x 18, one inch off the edges
        ob = Image.open(pngs["Bone"])
        bb = ob.getbbox()
        pw_, ph_ = POSTER_W, POSTER_H
        kk = min((pw_ - 2 * DPI) / (bb[2] - bb[0]), (ph_ - 2 * DPI) / (bb[3] - bb[1]))
        crop = ob.crop(bb).resize((int((bb[2] - bb[0]) * kk), int((bb[3] - bb[1]) * kk)), Image.LANCZOS)
        poster = Image.new("RGB", (pw_, ph_), (246, 241, 231))
        poster.paste(crop, ((pw_ - crop.width) // 2, (ph_ - crop.height) // 2), crop)
        poster.save(out / "print" / f"db-{nn}-outline-poster.png", "PNG", optimize=True)
        poster.save(out / "pdf" / f"db-{nn}-outline-poster.pdf", "PDF", resolution=DPI)
        pimg = out / "mockup" / f"db-{nn}-outline-poster.png"
        photomock.poster_mockup(str(out / "print" / f"db-{nn}-outline-poster.png"), str(pimg))
        items.append(item("Outline Poster", {"Bone": str(pimg.relative_to(out))}, PRICE_POSTER, f"DB{nn}-OLP", sized=False))
        print("outline:", opdf.name, "-> tee + crewneck + tote + poster")

    # 1b. the quotes, one tee item per quote
    qs = quotes(model)
    if qs:
        for qi, q in enumerate(qs, 1):
            imgs = {}
            for g, fill in GARMENTS.items():
                ink = INK if g == "Bone" else BONE
                name = f"db-{nn}-quote-{qi}-{g.lower()}"
                svg = out / "tmp" / f"{name}.svg"
                svg.write_text(sheet(quote_inner(model, q, ink)))
                rsvg(env, svg, out / "print" / f"{name}.png", width=PW)
                rsvg(env, svg, out / "pdf" / f"{name}.pdf", fmt="pdf")
                png = out / "mockup" / f"{name}.png"
                photomock.compose(f"tee-{g.lower()}", str(out / "print" / f"{name}.png"), str(png))
                imgs[g] = str(png.relative_to(out))
            items.append(item(f"Quote Tee {qi}", imgs, PRICE_TEE, f"DB{nn}-QT{qi}"))
        body.append("<p>Quote tees, what people said, on a shirt. Front print, unisex cut, ink on bone or bone on ink:</p><ol>"
                    + "".join(f"<li>{esc(q)}</li>" for q in qs) + "</ol>")
        print("quotes:", len(qs), "tee items")

    body.append("<p>Funded by Riposte Laboratories Inc.</p>")
    products.append(edition_product(nn, label, "".join(body), items))
    print("edition product:", len(items), "items")

    # 3. the stickers
    ssvg = stickers_svg(model)
    if ssvg is None:
        print("stickers: no Peel Me page, skipped")
    else:
        sp = out / "tmp" / f"db-{nn}-stickers.svg"
        sp.write_text(ssvg)
        rsvg(env, sp, out / "pdf" / f"db-{nn}-stickers.pdf", fmt="pdf")
        rsvg(env, sp, out / "print" / f"db-{nn}-stickers.png", width=int(SHEET_W / 25.4 * DPI))
        sm = out / "tmp" / f"db-{nn}-stickers-mock.svg"
        sm.write_text(flat_mockup(ssvg[ssvg.index(">", ssvg.index("<svg")) + 1:ssvg.rindex("</svg>")], SHEET_W, SHEET_H))
        simg = out / "mockup" / f"db-{nn}-stickers.png"
        rsvg(env, sm, simg, width=MOCK)
        pg = page(model, "Insert", "stickers")["content"]
        # one product: the A5 sheet, then a variant per single, 3 in die-cut
        _, singles = sticker_items(model)
        sheet_key = "Sheet of nine"
        imgs, variants = {sheet_key: str(simg.relative_to(out))}, [
            {"size": sheet_key, "colour": None, "sku": f"DB{nn}-STK", "price": PRICE_STICKERS, "image": sheet_key}]
        for i, (caption, shape, bg, fg) in enumerate(singles, 1):
            name = f"db-{nn}-sticker-{i}"
            sv = out / "tmp" / f"{name}.svg"
            sv.write_text(single_svg(caption, shape, bg, fg))
            rsvg(env, sv, out / "pdf" / f"{name}.pdf", fmt="pdf")
            rsvg(env, sv, out / "print" / f"{name}.png", width=int((SINGLE_MM + 2 * SINGLE_BLEED) / 25.4 * DPI))
            mm_ = out / "tmp" / f"{name}-mock.svg"
            side = SINGLE_MM + 2 * SINGLE_BLEED
            body = single_svg(caption, shape, bg, fg)
            mm_.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{MOCK}" height="{MOCK}" viewBox="0 0 1000 1000">'
                           f'<rect width="1000" height="1000" fill="{BONE_DIM}"/>'
                           f'<svg x="200" y="200" width="600" height="600" viewBox="0 0 {side} {side}">'
                           f'{body[body.index(">", body.index("<svg")) + 1:body.rindex("</svg>")]}</svg></svg>')
            png = out / "mockup" / f"{name}.png"
            rsvg(env, mm_, png, width=MOCK)
            key = f"{i:02d} {caption}"
            imgs[key] = str(png.relative_to(out))
            variants.append({"size": key, "colour": None, "sku": f"DB{nn}-STK-{i:02d}", "price": PRICE_SINGLE, "image": key})
        products.append({
            "handle": f"db-{nn}-peel-me", "title": f"Peel Me {label}",
            "descriptionHtml": (f"<p>The Peel Me page of Daily Bread {label}: the whole page as a kiss-cut A5 sheet "
                                f"of nine, {esc(pg.get('brandSub', '').lower())}, or any one sticker die-cut at 3 in.</p>"
                                f"<ul>{''.join('<li>' + esc(r.split('|')[0].strip()) + '</li>' for r in pg['stickers'])}</ul>"
                                f"<p>Funded by Riposte Laboratories Inc.</p>"),
            "productType": "Stickers", "tags": ["stickers", "peel-me", "daily-bread", "merch:auto"],
            "options": ["Design"],
            "variants": variants, "images": imgs,
        })
        print("peel me: sheet +", len(singles), "singles")

    manifest = {"edition": edition, "issue": n, "theme": theme, "vendor": VENDOR,
                "collection": f"db-{nn}", "collectionTitle": f"Daily Bread {label}",
                "products": products}
    (out / "products.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print("manifest:", out / "products.json", f"({len(products)} products)")

    if publish:
        publish_all(manifest, out)
        archive(RETIRED(nn))


# ── shopify ───────────────────────────────────────────────────────────────

API = "2025-07"


HELD = Path("/etc/rl-secrets")


def held(name):
    """A root-only file on x, the estate's one-copy convention; else None."""
    p = HELD / name
    return p.read_text().strip() if p.exists() else None


def token(shop):
    """An Admin API token, in order of preference:

    1. SHOPIFY_ADMIN_TOKEN, a token somebody already holds;
    2. a client-credentials grant from the store's own app (client id +
       secret, env or /etc/rl-secrets/shopify-client-{id,secret}), which
       mints a 24-hour token at call time so none is stored anywhere;
    3. /etc/rl-secrets/shopify-admin-token."""
    t = os.environ.get("SHOPIFY_ADMIN_TOKEN")
    if t:
        return t
    cid = os.environ.get("SHOPIFY_CLIENT_ID") or held("shopify-client-id")
    sec = os.environ.get("SHOPIFY_CLIENT_SECRET") or held("shopify-client-secret")
    if cid and sec:
        req = urllib.request.Request(
            f"https://{shop}/admin/oauth/access_token",
            data=json.dumps({"client_id": cid, "client_secret": sec,
                             "grant_type": "client_credentials"}).encode(),
            headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as r:
                return json.loads(r.read())["access_token"]
        except urllib.error.HTTPError as e:
            # Shopify answers 400 with an HTML page whose title names the fault
            body = e.read().decode(errors="replace")
            m = re.search(r"<title>(.*?)</title>", body)
            sys.exit(f"token exchange failed: {m.group(1) if m else e}"
                     " (is the app installed on the store, with write_products and write_files?)")
    t = held("shopify-admin-token")
    if t:
        return t
    sys.exit("--publish needs SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET, "
             "or the same under /etc/rl-secrets/")


def gql(shop, tok, query, variables=None):
    req = urllib.request.Request(
        f"https://{shop}/admin/api/{API}/graphql.json",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"Content-Type": "application/json", "X-Shopify-Access-Token": tok})
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    if data.get("errors"):
        sys.exit(f"graphql: {data['errors']}")
    return data["data"]


def staged_upload(shop, tok, path):
    """One file up to Shopify's bucket; returns the resourceUrl productSet accepts."""
    size = os.path.getsize(path)
    d = gql(shop, tok, """mutation($i:[StagedUploadInput!]!){stagedUploadsCreate(input:$i){
        stagedTargets{url resourceUrl parameters{name value}} userErrors{message}}}""",
        {"i": [{"resource": "IMAGE", "filename": os.path.basename(path), "mimeType": "image/png",
                "httpMethod": "POST", "fileSize": str(size)}]})
    t = d["stagedUploadsCreate"]["stagedTargets"][0]
    cmd = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}"]
    for p in t["parameters"]:
        cmd += ["-F", f"{p['name']}={p['value']}"]
    cmd += ["-F", f"file=@{path};type=image/png", t["url"]]
    code = subprocess.run(cmd, capture_output=True, text=True).stdout
    if code != "201":
        sys.exit(f"upload of {path} returned {code}")
    return t["resourceUrl"]


def collection_id(shop, tok, handle, title):
    d = gql(shop, tok, 'query($q:String){collections(first:1,query:$q){nodes{id}}}', {"q": f"handle:{handle}"})
    nodes = d["collections"]["nodes"]
    if nodes:
        return nodes[0]["id"]
    d = gql(shop, tok, """mutation($i:CollectionInput!){collectionCreate(input:$i){collection{id} userErrors{message}}}""",
            {"i": {"title": title, "handle": handle}})
    return d["collectionCreate"]["collection"]["id"]


def variant_inputs(p, urls):
    """productSet's option and variant lists for a manifest product.  Three
    shapes: Item x Colour x Size (the edition), Design (Peel Me), and a
    single default variant (the wall poster)."""
    opts = p["options"]
    variants = []
    for v in p["variants"]:
        if opts == ["Title"]:
            ov = [{"optionName": "Title", "name": "Default Title"}]
            img = urls["Default"]
        elif opts == ["Design"]:
            ov = [{"optionName": "Design", "name": v["size"]}]
            img = urls[v["image"]]
        else:
            ov = [{"optionName": "Item", "name": v["item"]},
                  {"optionName": "Colour", "name": v["colour"]},
                  {"optionName": "Size", "name": v["size"]}]
            img = urls[v["image"]]
        variants.append({"optionValues": ov, "sku": v["sku"], "price": v["price"],
                         "inventoryItem": {"tracked": True},
                         "file": {"originalSource": img, "contentType": "IMAGE"}})
    values = lambda names: [{"name": n} for n in names]  # noqa: E731
    if opts == ["Title"]:
        options = [{"name": "Title", "values": values(["Default Title"])}]
    elif opts == ["Design"]:
        options = [{"name": "Design", "values": values([v["size"] for v in p["variants"]])}]
    else:
        options = [{"name": "Item", "values": values(p["items"])},
                   {"name": "Colour", "values": values(p["colours"])},
                   {"name": "Size", "values": values(p["sizes"])}]
    return variants, options


def online_store_id(shop, tok):
    """The Online Store publication id, or None if the app's grant lacks
    read_publications: products then go up but stay off the channel, and
    the run says so instead of dying."""
    try:
        d = gql(shop, tok, 'query{publications(first:10){nodes{id name}}}')
    except SystemExit:
        print("note: no read_publications scope; put new products on the Online Store channel by hand")
        return None
    return next((n["id"] for n in d["publications"]["nodes"] if n["name"] == "Online Store"), None)


# the split rack, one product per kind, folded into the edition product 2026-09-13
RETIRED = lambda nn: [f"db-{nn}-{k}" for k in (   # noqa: E731
    "cover-tee", "cover-crewneck", "cover-tote", "cover-poster", "outline-tee", "outline-crewneck",
    "outline-tote", "outline-poster", "quotes-tee", "stickers", "sticker-singles")]


def archive(handles):
    """Archived, not deleted: orders keep their lines, and it reverses."""
    shop = os.environ.get("SHOPIFY_SHOP", "h23y0x-fd.myshopify.com")
    tok = token(shop)
    for h in handles:
        d = gql(shop, tok, 'query($q:String){products(first:1,query:$q){nodes{id status}}}', {"q": f"handle:{h}"})
        nodes = d["products"]["nodes"]
        if not nodes or nodes[0]["status"] == "ARCHIVED":
            continue
        d = gql(shop, tok, """mutation($p:ProductUpdateInput!){productUpdate(product:$p){product{id} userErrors{message}}}""",
                {"p": {"id": nodes[0]["id"], "status": "ARCHIVED"}})
        if d["productUpdate"]["userErrors"]:
            sys.exit(f"archive {h}: {d['productUpdate']['userErrors']}")
        print("archived:", h)


def publish_all(manifest, out):
    shop = os.environ.get("SHOPIFY_SHOP", "h23y0x-fd.myshopify.com")
    tok = token(shop)
    cols = [collection_id(shop, tok, manifest["collection"], manifest["collectionTitle"])]
    d = gql(shop, tok, 'query($q:String){collections(first:1,query:$q){nodes{id}}}', {"q": f"handle:{APPAREL_COLLECTION}"})
    apparel_col = d["collections"]["nodes"][0]["id"] if d["collections"]["nodes"] else None
    online_store = online_store_id(shop, tok)
    for c in cols:
        if online_store:
            gql(shop, tok, """mutation($id:ID!,$pub:ID!){publishablePublish(id:$id,input:[{publicationId:$pub}]){userErrors{message}}}""",
                {"id": c, "pub": online_store})

    for p in manifest["products"]:
        # idempotent by handle: an existing product is updated in place
        d = gql(shop, tok, 'query($q:String){products(first:1,query:$q){nodes{id}}}', {"q": f"handle:{p['handle']}"})
        existing = d["products"]["nodes"]
        files, urls = [], {}
        for key, rel in p["images"].items():
            urls[key] = staged_upload(shop, tok, str(out / rel))
            # REPLACE keeps re-runs from piling up copies; it needs the filename
            files.append({"originalSource": urls[key], "contentType": "IMAGE",
                          "filename": os.path.basename(rel), "alt": f"{p['title']}, {key.lower()}",
                          "duplicateResolutionMode": "REPLACE"})
        variants, options = variant_inputs(p, urls)
        inp = {"title": p["title"], "handle": p["handle"], "descriptionHtml": p["descriptionHtml"],
               "vendor": manifest["vendor"], "productType": p["productType"], "tags": p["tags"],
               "files": files, "productOptions": options, "variants": variants,
               "collections": cols + ([apparel_col] if apparel_col and "apparel" in p["tags"] else [])}
        # a new product starts as a draft; a re-run must not demote a live one
        if existing:
            inp["id"] = existing[0]["id"]
        else:
            inp["status"] = "DRAFT"
        d = gql(shop, tok, """mutation($i:ProductSetInput!){productSet(synchronous:true,input:$i){
            product{id handle} userErrors{field message}}}""", {"i": inp})
        errs = d["productSet"]["userErrors"]
        if errs:
            sys.exit(f"{p['handle']}: {errs}")
        pid = d["productSet"]["product"]["id"]
        # on the Online Store channel from the start, so flipping ACTIVE is the only step left
        if online_store:
            gql(shop, tok, """mutation($id:ID!,$pub:ID!){publishablePublish(id:$id,input:[{publicationId:$pub}]){userErrors{message}}}""",
                {"id": pid, "pub": online_store})
        print("published:", d["productSet"]["product"]["handle"], "(updated)" if existing else "(new)")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    edition = args[0]
    out = Path(args[1]) if len(args) > 1 else REPO / "merch" / edition
    build(edition, out, "--publish" in sys.argv)
