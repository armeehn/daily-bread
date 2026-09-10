#!/usr/bin/env python3
"""Daily Bread merch, one edition at a time, from the edition's own model.

    python3 tools/merch/merch.py issue-02              # artwork + mockups + manifest
    python3 tools/merch/merch.py issue-02 --publish    # ...and upsert into Shopify

Reads content/<edition>.js (generated from the .tex, the source of truth) and
turns what the edition already contains into products:

    Cover      art  -> cover tee, cover crewneck        (front print, 10 x 15 in)
    The Wall   svg  -> poster (vector, 24 in wide) and a tee   (assets/wall-NN.svg)
    Peel Me    list -> A5 kiss-cut sticker sheet        (the Insert "stickers" page)

Output, under merch/<edition>/:

    print/    transparent PNG print files at 300 dpi
    pdf/      the same at true physical size, vector where the source is vector
    mockup/   flat renders for the shop
    products.json   everything --publish needs, so a human can read it first

Nothing here invents artwork.  If the edition has no wall file yet the poster
and wall tee are skipped and said so; the placeholder page is not merch.

Needs: python3 + Pillow, rsvg-convert, node (to read the model), IBM Plex Mono
installed, and the repo's own UnifrakturMaguntia (tools/latex/fonts) which this
script hands to fontconfig itself.  --publish needs SHOPIFY_ADMIN_TOKEN (or
`rl-secret shopify-admin-token`) and SHOPIFY_SHOP.
"""
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image

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
PRICE_TEE, PRICE_CREW, PRICE_POSTER, PRICE_STICKERS = "38.00", "68.00", "28.00", "8.00"
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

def cover_inner(model, tmp, name):
    """The cover art, upscaled, with the masthead set over it the way the
    Cover template does.  Returns inner SVG for the 12x16 sheet."""
    cover = page(model, "Cover", "front")
    art = REPO / "db-render" / cover["content"]["art"]
    img = Image.open(art).convert("RGB")
    # centre-crop to 2:3 then upscale; the art is posterised, Lanczos is kind to it
    w, h = img.size
    if w / h > ART_W / ART_H:
        nw = int(h * ART_W / ART_H)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w * ART_H / ART_W)
        img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    img = img.resize((ART_W, ART_H), Image.LANCZOS)
    # a sibling file, not a data URI: 20 MB inline trips libxml's buffer cap
    art_png = tmp / f"{name}-art.png"
    img.save(art_png, "PNG", optimize=True)

    x0, y0 = (PW - ART_W) / 2, (PH - ART_H) / 2
    tag = cover["content"]["issueTag"]
    edition = cover["content"]["edition"]
    cx = PW / 2
    return "\n".join([
        f'<image x="{x0}" y="{y0}" width="{ART_W}" height="{ART_H}" xlink:href="{art_png.name}"/>',
        # masthead over the art: ink with a bone keyline so it holds on any art
        f'<g font-family="{FRAKTUR}" font-size="640" text-anchor="middle" '
        f'stroke="{BONE}" stroke-width="28" stroke-linejoin="round" paint-order="stroke" fill="{INK}">'
        f'<text x="{cx}" y="{y0 + 1900}">Daily</text><text x="{cx}" y="{y0 + 2520}">Bread</text></g>',
        text(cx, y0 + 260, tag, 84, PLEX, 700, BONE, "0.3em"),
        text(cx, y0 + ART_H - 140, edition, 72, PLEX, 700, BONE, "0.3em"),
    ])


def wall_svg(model):
    """assets/wall-NN.svg, the rip-out poster as vector.  None if absent."""
    _, nn = issue_no(model)
    p = REPO / "assets" / f"wall-{nn}.svg"
    if not p.exists():
        return None, p
    return p.read_text(), p


def wall_title(svg):
    m = re.search(r'aria-label="([^"]+)"', svg)
    return m.group(1) if m else "The Wall"


def wall_viewbox(svg):
    m = re.search(r'viewBox="([\d.\s-]+)"', svg)
    x, y, w, h = (float(v) for v in m.group(1).split())
    return w, h


def wall_inner(svg, width):
    """Nest the poster on the sheet at `width` px, centred."""
    w, h = wall_viewbox(svg)
    ph = width * h / w
    x, y = (PW - width) / 2, (PH - ph) / 2
    body = svg[svg.index(">", svg.index("<svg")) + 1:svg.rindex("</svg>")]
    return (f'<svg x="{x}" y="{y}" width="{width}" height="{ph}" viewBox="0 0 {w} {h}">'
            f'{body}</svg>')


def stickers_svg(model):
    """The Peel Me page as an A5 kiss-cut sheet: 3x3, circle or square, the
    colours the page lists.  Die lines dashed on their own layer."""
    pg = page(model, "Insert", "stickers")
    if not pg:
        return None
    c = pg["content"]
    n, _ = issue_no(model)
    items = []
    for row in c["stickers"]:
        label, shape, bg, fg = [s.strip() for s in row.split("|")]
        items.append((label, shape, bg, fg))
    cell, size = 44, 38
    gx = (SHEET_W - 3 * cell) / 2
    gy = 30
    out = [f'<rect width="{SHEET_W}" height="{SHEET_H}" fill="{BONE}"/>',
           text(SHEET_W / 2, 14, c.get("brand", "Peel Me"), 12, FRAKTUR, 400, INK),
           text(SHEET_W / 2, 20, c.get("brandSub", ""), 2.4, PLEX, 600, MUTED, "0.25em")]
    cuts = []
    for i, (label, shape, bg, fg) in enumerate(items[:9]):
        cx = gx + (i % 3) * cell + cell / 2
        cy = gy + (i // 3) * cell + cell / 2
        if shape == "circle":
            out.append(f'<circle cx="{cx}" cy="{cy}" r="{size / 2}" fill="{bg}"/>')
            cuts.append(f'<circle cx="{cx}" cy="{cy}" r="{size / 2 + 1}"/>')
        else:
            out.append(f'<rect x="{cx - size / 2}" y="{cy - size / 2}" width="{size}" height="{size}" fill="{bg}"/>')
            cuts.append(f'<rect x="{cx - size / 2 - 1}" y="{cy - size / 2 - 1}" width="{size + 2}" height="{size + 2}"/>')
        lines = wrap(label, 12)
        fs = min(4.6, 30 / (0.62 * max(len(l) for l in lines)))
        lh = fs * 1.15
        y = cy - lh * (len(lines) - 1) / 2 + fs * 0.35
        for j, l in enumerate(lines):
            out.append(text(cx, y + j * lh, l, fs, PLEX, 700, fg, "0.02em"))
    out.append(f'<g fill="none" stroke="#b7ad9e" stroke-width="0.25" stroke-dasharray="1.2 1">{"".join(cuts)}</g>')
    out.append(text(SHEET_W / 2, SHEET_H - 12, f"DAILY BREAD №{n} · KISS-CUT · CUT LINES DASHED", 2.4, PLEX, 600, MUTED, "0.25em"))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SHEET_W}mm" height="{SHEET_H}mm" '
            f'viewBox="0 0 {SHEET_W} {SHEET_H}">{"".join(out)}</svg>')


def wrap(s, width):
    words, lines, cur = s.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    lines.append(cur)
    return lines[:3]


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

def apparel(handle, title, body, kind, sku, price, images):
    return {
        "handle": handle, "title": title, "descriptionHtml": body,
        "productType": "T-Shirt" if kind == "tee" else "Sweatshirt",
        "tags": ["apparel", kind if kind == "tee" else "crewneck", "daily-bread", "merch:auto"],
        "options": ["Size", "Colour"],
        "variants": [{"size": s, "colour": g, "sku": f"{sku}-{g.upper()}-{s}", "price": price,
                      "image": images[g]} for g in GARMENTS for s in SIZES],
        "images": images,
    }


def build(edition, out, publish):
    model = load_edition(edition)
    n, nn = issue_no(model)
    theme = model["meta"]["theme"]
    label = f"№{n} — {theme}"
    for d in ("print", "pdf", "mockup", "tmp"):
        (out / d).mkdir(parents=True, exist_ok=True)
    env = fontconfig(out / "tmp")
    products = []

    def emit(name, inner, kinds):
        """Print PNG + PDF once, a mockup per garment colour and kind."""
        svg = out / "tmp" / f"{name}.svg"
        svg.write_text(sheet(inner))
        rsvg(env, svg, out / "print" / f"{name}.png", width=PW)
        rsvg(env, svg, out / "pdf" / f"{name}.pdf", fmt="pdf")
        imgs = {}
        for kind in kinds:
            for g, fill in GARMENTS.items():
                m = out / "tmp" / f"{name}-{kind}-{g.lower()}.svg"
                m.write_text(garment_mockup(inner, fill, kind))
                png = out / "mockup" / f"{name}-{kind}-{g.lower()}.png"
                rsvg(env, m, png, width=MOCK)
                imgs.setdefault(kind, {})[g] = str(png.relative_to(out))
        return imgs

    # 1. the cover
    inner = cover_inner(model, out / "tmp", f"db-{nn}-cover")
    imgs = emit(f"db-{nn}-cover", inner, ("tee", "crew"))
    body = (f"<p>The cover of Daily Bread {label}, as printed, on a shirt. The art at 10 × 15 in, "
            f"the masthead over it.</p><p>Front print only. Unisex cut.</p>"
            f"<p>Funded by Riposte Laboratories Inc.</p>")
    products.append(apparel(f"db-{nn}-cover-tee", f"Daily Bread {label} · Cover Tee", body,
                            "tee", f"DB{nn}-CVT", PRICE_TEE, imgs["tee"]))
    products.append(apparel(f"db-{nn}-cover-crewneck", f"Daily Bread {label} · Cover Crewneck", body,
                            "crew", f"DB{nn}-CVC", PRICE_CREW, imgs["crew"]))
    print("cover:", "tee + crewneck")

    # 2. the wall
    svg, path = wall_svg(model)
    if svg is None:
        print(f"wall: no {path.name} yet, poster and wall tee skipped")
    else:
        title = wall_title(svg)
        vw, vh = wall_viewbox(svg)
        # poster: 24 in wide, vector
        poster = out / "tmp" / f"db-{nn}-wall-poster.svg"
        poster.write_text(svg.replace("<svg ", f'<svg width="24in" height="{24 * vh / vw:.3f}in" ', 1))
        rsvg(env, poster, out / "pdf" / f"db-{nn}-wall-poster.pdf", fmt="pdf")
        rsvg(env, poster, out / "print" / f"db-{nn}-wall-poster.png", width=24 * DPI)
        pm = out / "tmp" / f"db-{nn}-wall-poster-mock.svg"
        pm.write_text(flat_mockup(svg[svg.index(">", svg.index("<svg")) + 1:svg.rindex("</svg>")], vw, vh))
        pimg = out / "mockup" / f"db-{nn}-wall-poster.png"
        rsvg(env, pm, pimg, width=MOCK)
        products.append({
            "handle": f"db-{nn}-wall-poster", "title": f"The Wall {label} · {title} · Poster",
            "descriptionHtml": (f"<p>The rip-out centrefold of Daily Bread {label}, <em>{esc(title)}</em>, "
                                f"as a poster. 24 × {24 * vh / vw:.0f} in, printed from the vector.</p>"
                                f"<p>Funded by Riposte Laboratories Inc.</p>"),
            "productType": "Poster", "tags": ["poster", "the-wall", "daily-bread", "merch:auto"],
            "options": ["Title"],
            "variants": [{"size": "Default Title", "colour": None, "sku": f"DB{nn}-WALL-P",
                          "price": PRICE_POSTER, "image": str(pimg.relative_to(out))}],
            "images": {"Default": str(pimg.relative_to(out))},
        })
        imgs = emit(f"db-{nn}-wall", wall_inner(svg, 11 * DPI), ("tee",))
        products.append(apparel(f"db-{nn}-wall-tee", f"The Wall {label} · {title} · Tee",
                                f"<p>The centrefold poster of Daily Bread {label} across the chest, 11 in wide.</p>"
                                f"<p>Front print only. Unisex cut.</p><p>Funded by Riposte Laboratories Inc.</p>",
                                "tee", f"DB{nn}-WLT", PRICE_TEE, imgs["tee"]))
        print("wall:", title, "-> poster + tee")

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
        products.append({
            "handle": f"db-{nn}-stickers", "title": f"Peel Me {label} · Sticker Sheet",
            "descriptionHtml": (f"<p>The Peel Me page of Daily Bread {label} as a kiss-cut A5 sheet: "
                                f"nine stickers, {esc(pg.get('brandSub', '').lower())}.</p>"
                                f"<ul>{''.join('<li>' + esc(r.split('|')[0].strip()) + '</li>' for r in pg['stickers'])}</ul>"
                                f"<p>Funded by Riposte Laboratories Inc.</p>"),
            "productType": "Stickers", "tags": ["stickers", "peel-me", "daily-bread", "merch:auto"],
            "options": ["Title"],
            "variants": [{"size": "Default Title", "colour": None, "sku": f"DB{nn}-STK",
                          "price": PRICE_STICKERS, "image": str(simg.relative_to(out))}],
            "images": {"Default": str(simg.relative_to(out))},
        })
        print("stickers:", len(pg["stickers"]), "on one A5 sheet")

    manifest = {"edition": edition, "issue": n, "theme": theme, "vendor": VENDOR,
                "collection": f"db-{nn}", "collectionTitle": f"Daily Bread {label}",
                "products": products}
    (out / "products.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print("manifest:", out / "products.json", f"({len(products)} products)")

    if publish:
        publish_all(manifest, out)


# ── shopify ───────────────────────────────────────────────────────────────

API = "2025-07"


def token():
    t = os.environ.get("SHOPIFY_ADMIN_TOKEN")
    if t:
        return t
    try:
        return subprocess.check_output(["rl-secret", "shopify-admin-token"], text=True).strip()
    except Exception:
        sys.exit("--publish needs SHOPIFY_ADMIN_TOKEN (or rl-secret shopify-admin-token)")


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


def publish_all(manifest, out):
    shop = os.environ.get("SHOPIFY_SHOP", "h23y0x-fd.myshopify.com")
    tok = token()
    cols = [collection_id(shop, tok, manifest["collection"], manifest["collectionTitle"])]
    d = gql(shop, tok, 'query($q:String){collections(first:1,query:$q){nodes{id}}}', {"q": f"handle:{APPAREL_COLLECTION}"})
    apparel_col = d["collections"]["nodes"][0]["id"] if d["collections"]["nodes"] else None

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
        variants = []
        for v in p["variants"]:
            ov = [{"optionName": "Size", "name": v["size"]}] if v["colour"] else [{"optionName": "Title", "name": "Default Title"}]
            if v["colour"]:
                ov.append({"optionName": "Colour", "name": v["colour"]})
            variants.append({"optionValues": ov, "sku": v["sku"], "price": v["price"],
                             "inventoryItem": {"tracked": True},
                             "file": {"originalSource": urls[v["colour"] or "Default"], "contentType": "IMAGE"}})
        options = ([{"name": "Size", "values": [{"name": s} for s in SIZES]},
                    {"name": "Colour", "values": [{"name": g} for g in GARMENTS]}]
                   if p["options"] == ["Size", "Colour"] else
                   [{"name": "Title", "values": [{"name": "Default Title"}]}])
        inp = {"title": p["title"], "handle": p["handle"], "descriptionHtml": p["descriptionHtml"],
               "vendor": manifest["vendor"], "productType": p["productType"], "tags": p["tags"],
               "status": "DRAFT", "files": files, "productOptions": options, "variants": variants,
               "collections": cols + ([apparel_col] if apparel_col and p["options"] == ["Size", "Colour"] else [])}
        if existing:
            inp["id"] = existing[0]["id"]
        d = gql(shop, tok, """mutation($i:ProductSetInput!){productSet(synchronous:true,input:$i){
            product{id handle} userErrors{field message}}}""", {"i": inp})
        errs = d["productSet"]["userErrors"]
        if errs:
            sys.exit(f"{p['handle']}: {errs}")
        print("published:", d["productSet"]["product"]["handle"], "(updated)" if existing else "(new)")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    edition = args[0]
    out = Path(args[1]) if len(args) > 1 else REPO / "merch" / edition
    build(edition, out, "--publish" in sys.argv)
