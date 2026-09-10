"""content/<edition>.tex -> print.pdf (A5 one-up) and booklet.pdf (A4 two-up).

Same page geometry the Chromium pipeline yields (db-render/out/*.pdf):
    print.pdf    48 pages  420 x 594.96 pt  (A5)
    booklet.pdf  24 sides  841.92 x 594.96 pt  (A4 landscape)
The A5 pages are typeset by lualatex + dailybread.cls; the booklet is those
pages re-imposed with pdfpages in saddle-stitch order (tools/print/imposition.js
derives the same pairing for the Chromium path).
"""
import os
import re
import shutil
import subprocess
from pathlib import Path

ENGINE = os.environ.get("RIPOSTE_ENGINE", "lualatex")
TEXLIVE_BIN = "/opt/texlive/2026/bin/x86_64-linux"

# Trim and sheet, in PostScript points: what the existing PDFs measure.
A5_PT = (420.0, 594.96)
SHEET_PT = (841.92, 594.96)
PAGES_PER_SIDE = 2

BOOKLET_TEX = r"""\documentclass{article}
\usepackage[paperwidth=%(w)sbp,paperheight=%(h)sbp,margin=0pt]{geometry}
\usepackage{pdfpages}
\pagestyle{empty}
\begin{document}
%(sides)s
\end{document}
"""


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
    res = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True)
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
    sides = "\n".join(
        r"\includepdf[pages={%d,%d},nup=2x1,noautoscale=true,delta=0pt 0pt]{print.pdf}" % lr
        for lr in saddle_stitch(pages))
    (build / "booklet.tex").write_text(
        BOOKLET_TEX % {"w": SHEET_PT[0], "h": SHEET_PT[1], "sides": sides})
    _run(common + ["-jobname=booklet", "booklet.tex"], build, env, build / "booklet.log")

    return build / "print.pdf", build / "booklet.pdf"


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
