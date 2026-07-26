#!/usr/bin/env bash
# Regenerate the pre-dithered cover art for assets/cover.jpg.
#
# Why bake the dither instead of leaving it to the device: the e-ink rendering is
# a web page seen on mixed hardware (real e-paper browsers AND ordinary screens).
# CSS grayscale() gives a continuous-tone image, which a 1-bit panel then hard-
# thresholds into blotches; and each controller's built-in dither is generic and
# gives no control over contrast. A baked screen is deterministic, art-directed,
# ~10x smaller than the JPEG, and passes cleanly through 1-bit panels (no double-
# dither moire). Text and the SVG logo stay vector and are left to the device.
# build.js swaps the eink asset in only for the eink variant.
#
# Technique — an AM (amplitude-modulated) halftone screen, i.e. a classic
# newsprint dot, rather than plain Floyd-Steinberg error diffusion. On this cover
# (a high-frequency photo of a dripping mouth) FS collapses the midtones into
# black blotches once you crush contrast for a 1-bit panel; an ordered halftone
# screen keeps the tongue texture, the teeth and the blackletter masthead all
# legible, reads unmistakably as *print* (fitting for a magazine), and survives a
# 1-bit panel without re-dithering. The tone prep (sigmoidal S-curve + a highlight
# level to keep newsprint whites clean) matters as much as the screen itself.
# Approach adapted from dead.garden, "How my images are dithered"
# (https://dead.garden/blog/how-my-images-are-dithered.html): grayscale, gentle
# contrast, an ordered AM screen, and — for the colour method — a duotone remap
# onto a brand palette instead of a neutral one.
#
# Needs ImageMagick 7 (`magick`). Run from anywhere:
#     tools/dither-cover.sh                 # halftone -> assets/cover-eink.png (default)
#     tools/dither-cover.sh halftone        # same
#     tools/dither-cover.sh pink            # pink duotone halftone -> assets/cover-pink.png
#     tools/dither-cover.sh fs              # legacy Floyd-Steinberg -> assets/cover-eink.png
set -euo pipefail

cd "$(dirname "$0")/.."
src="assets/cover.jpg"
method="${1:-halftone}"

command -v magick >/dev/null 2>&1 || { echo "need ImageMagick (magick) on PATH" >&2; exit 1; }

# Shared tone prep: 800px wide (keeps the dot fine on retina), grayscale, an
# S-curve for midtone punch, and a highlight/shadow level so paper whites stay
# clean and shadows read solid. The dot screen is applied per method.
prep=(-resize 800x -colorspace Gray -sigmoidal-contrast 4x45% -level 4%,96%)

case "$method" in
  halftone)
    out="assets/cover-eink.png"
    # h8x8a: an 8x8 ordered *halftone* threshold map — round dots that grow with
    # ink coverage. -monochrome collapses it to a true 1-bit PNG for the panel.
    magick "$src" "${prep[@]}" -ordered-dither h8x8a -monochrome "$out"
    ;;
  fs)
    out="assets/cover-eink.png"
    # Legacy path: Floyd-Steinberg error diffusion. Kept for comparison; blotchier
    # on this cover than the halftone screen above.
    magick "$src" -resize 800x -colorspace Gray -level 6%,94% -monochrome "$out"
    ;;
  pink)
    out="assets/cover-pink.png"
    # dead.garden's signature "pink palette": halftone the luminance, then paint
    # the dots in the Daily Bread brand pink over the bone paper stock. Riso-style
    # duotone that matches the site's pink/bone base. Not wired into the pages by
    # default; build a hero/social treatment from it if you want the printed look.
    pink="#f0477d"   # brand pink
    bone="#f6f1e7"   # paper base
    magick "$src" "${prep[@]}" -ordered-dither h8x8a -monochrome \
      -colorspace sRGB -type TrueColor \
      -fuzz 50% -fill "$pink" -opaque black -fill "$bone" -opaque white \
      "$out"
    ;;
  *)
    echo "unknown method '$method' (use: halftone | pink | fs)" >&2
    exit 2
    ;;
esac

printf 'wrote %s  (%s, %s bytes)\n' "$out" \
  "$(magick identify -format '%wx%h %[bit-depth]-bit %[colorspace]' "$out")" \
  "$(stat -c%s "$out")"
