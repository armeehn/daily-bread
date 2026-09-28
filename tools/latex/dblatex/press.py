"""content/<edition>.tex -> print.pdf (A5 one-up) and booklet.pdf (Letter two-up),
and on request printer.pdf (A5 one-up with bleed and crop marks, for a print shop).

    print.pdf    48 pages  420 x 594.96 pt  (A5, the trim every template is drawn at)
    booklet.pdf  24 sides  792 x 612 pt     (Letter landscape, the paper in the printer)
    printer.pdf  48 pages  465.35 x 640.31 pt (A5 + 3 mm bleed + 5 mm slug; build_printer)
The A5 pages are typeset by lualatex + dailybread.cls; the booklet is those
pages re-imposed in saddle-stitch order (tools/print/imposition.js derives the
same pairing for the Chromium path), sized for a desktop duplex laser: print,
fold, staple. Nothing is trimmed.
"""
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ENGINE = os.environ.get("RIPOSTE_ENGINE", "lualatex")
# A whole edition typesets in ~8 s. lualatex in nonstopmode cannot wait for input,
# but a pathological page (a runaway macro, a font that will not load) can spin;
# the press serialises builds, so one that never ends would stall every request
# after it. Generous, and fatal.
TEX_TIMEOUT_S = int(os.environ.get("RIPOSTE_TEX_TIMEOUT", "150"))
TEXLIVE_BIN = "/opt/texlive/2026/bin/x86_64-linux"

MM_PT = 72 / 25.4

# Trim, in PostScript points: what the one-up PDF has always measured.
A5_PT = (420.0, 594.96)

# The sheet is the paper in the printer, not the trim doubled: Letter, landscape,
# two pages a side. A desktop laser (the estate Brother MFC-L2710DW) leaves the
# outer 4.2 mm of every sheet white whatever it is sent, and nothing is trimmed
# after folding, so each page is scaled to clear that band with slack and sits
# flush at the fold. What bleeds in the design ends at the band.
#
#   +---------------------------------------------+  ^
#   |   band                                      |  |
#   |  +------------------+------------------+    |  |
#   |  |                  |                  |    |  |
#   |  |     page 48      |     page 1       |    |  612 pt (Letter short edge)
#   |  |                  |                  |    |  |
#   |  +------------------+------------------+    |  |
#   |                    fold                     |  v
#   +---------------------------------------------+
#   <------------------- 792 pt ------------------>
SHEET_PT = (792.0, 612.0)
PAGES_PER_SIDE = 2
PRINTER_CLIP_MM = 4.2          # what the laser cannot ink; clipped_sides() measures it
BAND_PT = 5 * MM_PT            # what the pages clear: the clip, plus feed slack
FOOT_SLACK_PT = 1              # so a page exactly as tall as the text area still fits

# Duplex, short-edge flip: a landscape sheet folded down its centre reads that
# way, and the print dialog opens pre-set where the viewer honours the hint.
BOOKLET_TEX = r"""\documentclass{article}
\usepackage[paperwidth=%(w)sbp,paperheight=%(h)sbp,left=%(band)sbp,right=%(band)sbp,
  top=%(head)sbp,bottom=%(foot)sbp,noheadfoot,nomarginpar]{geometry}
\usepackage{graphicx}
\pagestyle{empty}
\setlength{\parindent}{0pt}\setlength{\parskip}{0pt}\setlength{\topskip}{0pt}
\pdfextension catalog{/ViewerPreferences<</Duplex/DuplexFlipShortEdge/PickTrayByPDFSize true>>}
\begin{document}
%(sides)s
\end{document}
"""
SIDE_TEX = (r"\makebox[0pt][l]{\includegraphics[page=%d,width=%s]{print.pdf}"
            r"\includegraphics[page=%d,width=%s]{print.pdf}}")


def page_fit():
    """(scale, width_pt, height_pt) of one A5 page on the sheet: the largest that
    clears the band at the outer edge, head and foot. Letter: 0.909, 381.8 x 540.9."""
    cell_w = SHEET_PT[0] / PAGES_PER_SIDE - BAND_PT
    cell_h = SHEET_PT[1] - 2 * BAND_PT
    scale = min(cell_w / A5_PT[0], cell_h / A5_PT[1])
    return scale, A5_PT[0] * scale, A5_PT[1] * scale


def riposte_dir(repo):
    """Where riposte-latex is: $RIPOSTE_LATEX, else the sibling checkout."""
    env = os.environ.get("RIPOSTE_LATEX")
    cand = Path(env) if env else repo.parent / "riposte-latex"
    return cand if (cand / "riposte.sty").exists() else None


def saddle_stitch(n):
    """Side s pairs page s with page n-s+1; even sides are sheet backs, flipped.
    48 pages -> [48,1], [2,47], [46,3], [4,45] ... (left, right)."""
    if n % 4:
        raise ValueError(f"a saddle-stitched booklet needs a multiple of 4 pages; got {n}")
    sides = []
    for s in range(1, n // 2 + 1):
        near, far = s, n - s + 1
        sides.append((near, far) if s % 2 == 0 else (far, near))
    return sides


def source_date_epoch():
    """The timestamp every PDF carries: $SOURCE_DATE_EPOCH, else 0. Fixed, so two
    typesettings of one .tex are byte-identical and a re-run changes nothing."""
    return os.environ.get("SOURCE_DATE_EPOCH", "0")


def engine_version(repo):
    """First line of `lualatex --version`: which TeX produced the bytes."""
    res = subprocess.run([ENGINE, "--version"], env=_env(repo, None),
                         capture_output=True, text=True)
    return res.stdout.splitlines()[0] if res.stdout else ENGINE


def _env(repo, build):
    env = dict(os.environ)
    env["PATH"] = TEXLIVE_BIN + os.pathsep + env.get("PATH", "")
    env["LC_ALL"] = "C.UTF-8"
    # luaotfload caches a parsed font under the ABSOLUTE path it was first seen
    # at, and the kit's faces are reached through ./dbfonts in the build dir. One
    # build dir deleted (a studio overlay is temporary) and every later build on
    # the box dies at font embedding with "cannot find file ''". So each build
    # keeps its own cache, inside itself, and takes it to the grave. ~1.5 s.
    if build is not None:
        env["TEXMFVAR"] = str(Path(build) / "texmf-var")
    env["SOURCE_DATE_EPOCH"] = source_date_epoch()
    env["FORCE_SOURCE_DATE"] = "1"
    inputs = [str(repo / "tools" / "latex")]
    rl = riposte_dir(repo)
    if rl:
        inputs.append(str(rl))
    env["TEXINPUTS"] = os.pathsep.join(inputs) + os.pathsep + env.get("TEXINPUTS", "")
    return env


def _stage_fonts(repo, build):
    # riposte.sty wants fontpath RELATIVE to the compile dir (an absolute path
    # yields no PDF and poisons the font cache), so the fonts appear as ./fonts.
    rl = riposte_dir(repo)
    link = build / "fonts"
    if rl and not link.exists():
        link.symlink_to(rl / "fonts")
    # The magazine's own display faces (UnifrakturMaguntia, Caveat; OFL) ride
    # in the repo and appear as ./dbfonts for the same reason.
    dbfonts = build / "dbfonts"
    if not dbfonts.exists():
        dbfonts.symlink_to(repo / "tools" / "latex" / "fonts")


def _run(cmd, cwd, env, log):
    try:
        res = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True,
                             timeout=TEX_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"{cmd[0]} exceeded {TEX_TIMEOUT_S} s and was killed "
                           f"(see {log.name})")
    if res.returncode:
        tail = "\n".join((log.read_text(errors="replace") if log.exists() else res.stdout).splitlines()[-30:])
        raise RuntimeError(f"{cmd[0]} failed:\n{tail}")


def build_pdfs(repo, tex, build, assets=None):
    build.mkdir(parents=True, exist_ok=True)
    _stage_fonts(repo, build)
    env = _env(repo, build)
    common = [ENGINE, "-interaction=nonstopmode", "-halt-on-error",
              f"-output-directory={build}"]

    # \dbassets is where the kit's image paths ("uploads/x.png") resolve: the
    # kit's own db-render/, or a staging dir the studio overlay put its images in.
    assets = str(Path(assets) if assets else repo / "db-render") + "/"
    _run(common + ["-jobname=print", r"\def\dbassets{%s}\input{%s}" % (assets, tex)],
         build, env, build / "print.log")

    pages = pdf_geometry(build / "print.pdf")[0]
    _, page_w, page_h = page_fit()
    width = "%.2fbp" % page_w
    head = (SHEET_PT[1] - page_h) / 2
    sides = "\n\\newpage\n".join(
        SIDE_TEX % (left, width, right, width) for left, right in saddle_stitch(pages))
    (build / "booklet.tex").write_text(
        BOOKLET_TEX % {"w": SHEET_PT[0], "h": SHEET_PT[1], "band": "%.2f" % BAND_PT,
                       "head": "%.2f" % head, "foot": "%.2f" % (head - FOOT_SLACK_PT),
                       "sides": sides})
    _run(common + ["-jobname=booklet", "booklet.tex"], build, env, build / "booklet.log")

    return build / "print.pdf", build / "booklet.pdf"


# The printer's PDF: for a print shop, not the desktop laser. Every page one-up
# in reading order (the shop imposes), on a sheet of trim + bleed + slug, with
# crop marks in the slug and /TrimBox and /BleedBox set so the shop's software
# knows where to cut. The pages are drawn at the trim, so the bleed is made by
# stretching each page's outermost half point out over it: a background, a
# strip or a picture that runs to the trim carries on past it in its own
# colour, and nothing inside the page (a strip's label a couple of mm from the
# edge) is copied out where a trim that drifts would show it.
BLEED_MM = 3.0                 # the default, as the studio's Print settings
SLUG_MM = 5.0                  # room for the crop marks, outside the bleed
MARK_PT = 0.25
EDGE_PT = 0.5                  # the slice of the page's edge stretched over the bleed

PRINTER_TEX = r"""\documentclass{article}
\usepackage[paperwidth=%(W).3fbp,paperheight=%(H).3fbp,margin=0pt,noheadfoot,nomarginpar]{geometry}
\usepackage{tikz}
\pagestyle{empty}
\pdfvariable pageattr{/TrimBox [%(o).3f %(o).3f %(ow).3f %(oh).3f] /BleedBox [%(s).3f %(s).3f %(bw).3f %(bh).3f]}
\newcommand\dbsheet[1]{%%
  \begin{tikzpicture}[x=1bp,y=1bp]
    \useasboundingbox (0,0) rectangle (%(W).3f,%(H).3f);
%(tiles)s
    \begin{scope}[line width=%(mark)sbp]
%(marks)s
    \end{scope}
  \end{tikzpicture}}
\newcommand\dbpage[1]{%%
  \saveimageresource page #1 {print.pdf}%%
  \edef\next{\noexpand\AddToHookNext{shipout/background}{\noexpand\put(0,-\noexpand\paperheight){\noexpand\dbsheet{\the\lastsavedimageresourceindex}}}}\next
  \null\newpage}
\begin{document}
%(pages)s
\end{document}
"""


def length_pt(v, default_mm):
    """A CSS-ish length ("3mm", "0.125in", "9pt") in points; the default if unreadable."""
    m = re.match(r"^\s*([\d.]+)\s*(mm|cm|in|pt|px)?\s*$", str(v or ""))
    if not m:
        return default_mm * MM_PT
    n, u = float(m.group(1)), m.group(2) or "mm"
    return n * {"mm": MM_PT, "cm": 10 * MM_PT, "in": 72.0, "pt": 1.0, "px": 0.75}[u]


def printer_geometry(bleed_pt=None):
    b = BLEED_MM * MM_PT if bleed_pt is None else max(0.0, min(bleed_pt, 12 * MM_PT))
    s = SLUG_MM * MM_PT
    w, h = A5_PT
    return {"b": b, "s": s, "o": s + b, "w": w, "h": h, "W": w + 2 * (s + b), "H": h + 2 * (s + b)}


def build_printer(repo, build, bleed_pt=None):
    """build/print.pdf -> build/printer.pdf: trim + bleed + slug, crop marks, boxes."""
    g = printer_geometry(bleed_pt)
    b, s, o, w, h, W, H = (g[k] for k in "bsowhWH")
    tiles = []
    # nine tiles: the page, then its outermost EDGE_PT stretched over the bleed
    # on each side and at each corner
    k = b / EDGE_PT if b > 0 else 1
    for dy in (0, -1, 1):
        for dx in (0, -1, 1):
            if (dx or dy) and b <= 0:
                continue
            xr = {0: (o, o + w), -1: (o - b, o), 1: (o + w, o + w + b)}[dx]
            yr = {0: (o, o + h), -1: (o - b, o), 1: (o + h, o + h + b)}[dy]
            # where the page's origin goes, and its scale, so that its edge slice lands on the band
            sx, xs = {0: (o, 1), -1: (o - b, k), 1: (o + w - (w - EDGE_PT) * k, k)}[dx]
            sy, ys = {0: (o, 1), -1: (o - b, k), 1: (o + h - (h - EDGE_PT) * k, k)}[dy]
            tiles.append(
                "    \\begin{scope}\\clip (%.3f,%.3f) rectangle (%.3f,%.3f);"
                "\\begin{scope}[shift={(%.4f,%.4f)},xscale=%.4f,yscale=%.4f]"
                "\\node[anchor=south west,inner sep=0pt,outer sep=0pt,transform shape] at (0,0) {\\useimageresource #1};"
                "\\end{scope}\\end{scope}" % (xr[0], yr[0], xr[1], yr[1], sx, sy, xs, ys))
    marks = []
    for x in (o, o + w):            # vertical marks, above and below the trim corners
        marks += ["      \\draw (%.3f,0) -- (%.3f,%.3f);" % (x, x, s),
                  "      \\draw (%.3f,%.3f) -- (%.3f,%.3f);" % (x, H - s, x, H)]
    for y in (o, o + h):            # horizontal marks, left and right
        marks += ["      \\draw (0,%.3f) -- (%.3f,%.3f);" % (y, s, y),
                  "      \\draw (%.3f,%.3f) -- (%.3f,%.3f);" % (W - s, y, W, y)]
    n = pdf_geometry(build / "print.pdf")[0]
    (build / "printer.tex").write_text(PRINTER_TEX % {
        "W": W, "H": H, "o": o, "ow": o + w, "oh": o + h, "s": s, "bw": W - s, "bh": H - s,
        "mark": MARK_PT, "tiles": "\n".join(tiles), "marks": "\n".join(marks),
        "pages": "\n".join("\\dbpage{%d}" % i for i in range(1, n + 1))})
    env = _env(repo, build)
    _run([ENGINE, "-interaction=nonstopmode", "-halt-on-error", f"-output-directory={build}",
          "-jobname=printer", "printer.tex"], build, env, build / "printer.log")
    return build / "printer.pdf"


def overfull_boxes(log):
    """Pages whose content did not fit its A5 box: one page, but text runs off it."""
    return len(re.findall(r"^Overfull \\vbox", log.read_text(errors="replace"), re.M))


def pdf_geometry(pdf):
    """(pages, width_pt, height_pt) as pdfinfo reports them."""
    if not shutil.which("pdfinfo"):
        raise RuntimeError("pdfinfo (poppler-utils) is required to check the PDFs")
    out = subprocess.run(["pdfinfo", str(pdf)], check=True, capture_output=True, text=True).stdout
    pages = int(re.search(r"^Pages:\s+(\d+)", out, re.M).group(1))
    w, h = re.search(r"^Page size:\s+([\d.]+) x ([\d.]+) pts", out, re.M).groups()
    return pages, float(w), float(h)


def _pgm_sides(pdf, dpi):
    """Every side of the PDF as (width, height, pixels): 8-bit grey, one byte a pixel."""
    if not shutil.which("pdftoppm"):
        raise RuntimeError("pdftoppm (poppler-utils) is required to check the booklet")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-gray", "-r", str(dpi), str(pdf), tmp + "/s"], check=True)
        for pgm in sorted(Path(tmp).glob("s-*.pgm")):
            _, dims, _, px = pgm.read_bytes().split(b"\n", 3)
            w, h = map(int, dims.split())
            yield w, h, px


def clipped_sides(booklet, dpi=72):
    """1-based sides with ink inside the printer's dead band: what the laser
    would cut off. Rasterises every side; [] means it prints as it looks."""
    band = int(-(-PRINTER_CLIP_MM * dpi // 25.4))     # ceil, in pixels
    paper = 250                                        # anti-aliasing counts as ink
    bad = []
    for n, (w, h, px) in enumerate(_pgm_sides(booklet, dpi), 1):
        rows = [px[y * w:(y + 1) * w] for y in range(h)]
        edges = rows[:band] + rows[-band:] + [r[:band] + r[-band:] for r in rows]
        if any(v < paper for r in edges for v in r):
            bad.append(n)
    return bad
