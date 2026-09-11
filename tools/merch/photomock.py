#!/usr/bin/env python3
"""Photographic mockups: a transparent print file laid onto a blank garment
photo. Pure Pillow (LXC 111 has no working numpy).

    photomock.compose(blank_name, print_png, out_png)

BLANKS maps a blank to its photo and the quad (TL, TR, BR, BL) where the
12 x 16 in print sheet sits, in the photo's pixels. The print is warped onto
the quad, multiplied by the fabric's own shading (blurred luminance, scaled
so the quad's average is neutral) so folds and the light show through, and
pasted with its own alpha. Dark garments simply have dark shading, which is
why one routine serves bone and ink.
"""
import os
import sys

from PIL import Image, ImageChops, ImageFilter

BLANK_DIR = os.environ.get("MERCH_BLANKS", "/home/user/blanks")

# quad = (TL, TR, BR, BL) of the print sheet on the photo
BLANKS = {
    "tee-bone":  ("tee-bone.jpg",  [(715, 570), (1305, 570), (1305, 1357), (715, 1357)]),
    "tee-ink":   ("tee-ink.jpg",   [(720, 540), (1320, 540), (1320, 1340), (720, 1340)]),
    "crew-bone": ("crew-bone.jpg", [(730, 600), (1290, 600), (1290, 1347), (730, 1347)]),
    "crew-ink":  ("crew-ink.jpg",  [(730, 590), (1310, 590), (1310, 1363), (730, 1363)]),
    "tote-bone": ("tote-bone.jpg", [(715, 820), (1405, 820), (1425, 1745), (695, 1745)]),
    "tote-ink":  ("tote-ink.jpg",  [(715, 820), (1405, 820), (1425, 1745), (695, 1745)]),
}
OUT_SIZE = 1600


def has_blank(name):
    return os.path.exists(os.path.join(BLANK_DIR, BLANKS[name][0]))


def _solve(a, b):
    """Gaussian elimination for the 8x8 perspective system."""
    n = len(a)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c and m[r][c]:
                f = m[r][c] / m[c][c]
                m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return [m[i][n] / m[i][i] for i in range(n)]


def perspective_coeffs(src, dst):
    """Coefficients for Image.transform(PERSPECTIVE) mapping dst quad -> src rect."""
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return _solve(a, b)


def compose(blank, print_png, out_png, size=OUT_SIZE):
    photo_name, quad = BLANKS[blank]
    photo = Image.open(os.path.join(BLANK_DIR, photo_name)).convert("RGB")
    W, H = photo.size
    art = Image.open(print_png).convert("RGBA")
    # the print sheet is 3600 x 4800; warp it onto the quad in photo space
    src = [(0, 0), (art.width, 0), (art.width, art.height), (0, art.height)]
    coeffs = perspective_coeffs(src, quad)
    warped = art.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    # ink sinks into cloth: a hair of blur and a touch less than full coverage
    warped = warped.filter(ImageFilter.GaussianBlur(0.7))
    r, g, b, a = warped.split()
    a = a.point(lambda v: int(v * 0.95))
    # shading from the fabric itself, neutral at the quad's mean brightness
    lum = photo.convert("L").filter(ImageFilter.GaussianBlur(2))
    xs = [p[0] for p in quad]; ys = [p[1] for p in quad]
    box = (min(xs), min(ys), max(xs), max(ys))
    mean = sum(lum.crop(box).resize((64, 64)).getdata()) / 4096
    shade = lum.point(lambda v: min(255, int(v * 255 / max(mean, 1))))
    rgb = ImageChops.multiply(Image.merge("RGB", (r, g, b)), Image.merge("RGB", (shade, shade, shade)))
    out = photo.copy()
    out.paste(rgb, (0, 0), a)
    out = out.resize((size, size), Image.LANCZOS)
    out.save(out_png, "PNG", optimize=True)
    return out_png


def make_black_tote(src_png, out_png):
    """A black canvas tote from the natural one: darken the bag (face quad
    plus the bright handles) and keep the weave. The concrete stays."""
    im = Image.open(src_png).convert("RGB")
    W, H = im.size
    lum = im.convert("L")
    from PIL import ImageDraw
    # the canvas is the bright thing in the frame; the concrete sits well below it
    mask = lum.point(lambda v: 255 if v > 178 else 0)
    mask = mask.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7))
    # nothing outside the bag's neighbourhood
    keep = Image.new("L", (W, H), 0)
    ImageDraw.Draw(keep).rectangle((420, 180, 1720, 1800), fill=255)
    mask = ImageChops.multiply(mask, keep)
    mask = mask.filter(ImageFilter.GaussianBlur(1.5))
    # black canvas: weave kept, levels crushed toward ink
    dark = lum.point(lambda v: int(14 + max(0, v - 120) * 0.22))
    dark = Image.merge("RGB", (dark, dark, dark))
    out = Image.composite(dark, im, mask)
    out.save(out_png, "JPEG", quality=92)
    return out_png


if __name__ == "__main__":
    blank, src, dst = sys.argv[1:4]
    print(compose(blank, src, dst))
