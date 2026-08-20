#!/usr/bin/env python3
"""
make-symbol-font.py — build assets/fonts/db-symbols.woff2

A handful of characters in the magazine (bullets, marks, one arrow) are not in
IBM Plex Mono, so the browser silently reaches for whatever the *rendering
machine* has — DejaVu here, something else on a CI runner, nothing at all on a
box with neither. That is the same unpinned-face problem that made the print PDF
unreproducible before; it just applies to the decorative marks rather than the
body text.

This subsets DejaVu Sans down to exactly those characters and renames the family
to "DB Symbols", so db.js can name it explicitly in every font stack and the PDF
embeds it like any other declared face. Regenerate with:

    python3 tools/make-symbol-font.py [path/to/DejaVuSans.ttf]

DejaVu Sans is Bitstream Vera / Arev licensed (permissive, notice required) —
see assets/fonts/LICENSE-DejaVu.txt, which must travel with the .woff2.
"""
import os
import subprocess
import sys
import tempfile

from fontTools.ttLib import TTFont

# Every character the magazine uses that IBM Plex Mono does not carry. Keep this
# list in step with what db-render/render-studio-pdf.js reports as unpinned: if it
# names a new face, a new glyph has crept into the model and belongs here.
GLYPHS = [0x2192, 0x2318, 0x25B8, 0x25E6, 0x2610, 0x2665, 0x2702, 0x2715, 0x2726]

FAMILY = "DB Symbols"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "fonts", "db-symbols.woff2")

DEFAULT_SRC = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    os.path.expanduser("~/.local/share/fonts/TTF/DejaVuSans.ttf"),
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
]


def find_source(argv):
    if len(argv) > 1:
        return argv[1]
    for p in DEFAULT_SRC:
        if os.path.exists(p):
            return p
    sys.exit("DejaVuSans.ttf not found — pass its path as an argument")


def main():
    src = find_source(sys.argv)
    missing = [cp for cp in GLYPHS if cp not in TTFont(src).getBestCmap()]
    if missing:
        sys.exit("source font lacks: " + " ".join("U+%04X" % c for c in missing))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        sub = os.path.join(tmp, "sub.ttf")
        subprocess.run([
            "pyftsubset", src,
            "--output-file=" + sub,
            "--unicodes=" + ",".join("U+%04X" % c for c in GLYPHS),
            "--layout-features=",
            "--no-hinting",
            "--desubroutinize",
            "--drop-tables+=DSIG",
            "--name-IDs=*",
        ], check=True)

        f = TTFont(sub)
        # Rename so the face is unmistakably ours: db.js names "DB Symbols" in its
        # font stacks, and the renderer's font audit treats it as a declared family
        # rather than a system fallback.
        name = f["name"]
        for rec in list(name.names):
            if rec.nameID in (1, 3, 4, 6, 16):
                value = FAMILY if rec.nameID != 6 else FAMILY.replace(" ", "")
                if rec.nameID == 3:
                    value = FAMILY + " (subset of DejaVu Sans)"
                name.setName(value, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        # Fixed timestamps so rebuilding the font twice gives the same bytes.
        f["head"].created = f["head"].modified = 3820000000
        f.flavor = "woff2"
        f.save(OUT)

    print("wrote %s (%d bytes, %d glyphs)" % (
        os.path.relpath(OUT, ROOT), os.path.getsize(OUT), len(GLYPHS)))


if __name__ == "__main__":
    main()
