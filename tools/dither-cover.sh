#!/usr/bin/env bash
# Regenerate the e-ink cover: a pre-dithered 1-bit version of assets/cover.jpg.
#
# Why bake it instead of leaving it to the device: the e-ink rendering is a web
# page seen on mixed hardware (real e-paper browsers AND ordinary screens). CSS
# grayscale() gives a continuous-tone image, which a 1-bit panel then hard-
# thresholds into blotches; and each controller's built-in dither is generic and
# gives no control over contrast. A Floyd–Steinberg 1-bit source is deterministic,
# art-directed, ~10x smaller than the JPEG, and passes cleanly through 1-bit
# panels (no double-dither moire). Text and the SVG logo stay vector and are left
# to the device. build.js swaps this asset in only for the eink variant.
#
# Needs ImageMagick (`magick`). Run from the repo root:  tools/dither-cover.sh
# For a newsprint halftone-dot look instead of Floyd–Steinberg, swap the last
# stage for:  -ordered-dither h6x6a
set -euo pipefail

cd "$(dirname "$0")/.."
src="assets/cover.jpg"
out="assets/cover-eink.png"

command -v magick >/dev/null 2>&1 || { echo "need ImageMagick (magick) on PATH" >&2; exit 1; }

magick "$src" \
  -resize 800x \
  -colorspace Gray \
  -level 6%,94% \
  -monochrome \
  "$out"

printf 'wrote %s  (%s, %s bytes)\n' "$out" \
  "$(magick identify -format '%wx%h %[bit-depth]-bit' "$out")" \
  "$(stat -c%s "$out")"
