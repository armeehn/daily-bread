#!/bin/sh
# The production wireframe of the edition, for Scribus and for InDesign/Affinity.
#
#   sh tools/wireframe/build.sh [model.json]
#
# 1. extract.js   lays the edition out with the press and measures every page
# 2. build_sla.py builds the Scribus document inside Scribus, and a proof PDF
# 3. build_idml.py writes the same document as IDML; check_idml.py checks it
# Writes wireframe/daily-bread-<edition>.{sla,idml} and -proof.pdf, and copies
# the fonts the documents use into wireframe/fonts/.
#
# Needs: Node and tools/press installed; Scribus 1.6 (and xvfb-run, without a
# display) for the .sla and the proof; Python 3 for the IDML.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT="$ROOT/wireframe"
SPEC="$ROOT/build/wireframe/spec.json"
mkdir -p "$OUT/fonts" "$(dirname "$SPEC")"

if [ $# -gt 0 ]; then node "$ROOT/tools/wireframe/extract.js" --model "$1" --out "$SPEC"
else node "$ROOT/tools/wireframe/extract.js" --out "$SPEC"; fi
ED=$(node -e 'const s=require(process.argv[1]); const n=String(s.issue).match(/\d+/); console.log(n ? "issue-" + n[0].padStart(2, "0") : "edition")' "$SPEC")
BASE="$OUT/daily-bread-$ED"

python3 "$ROOT/tools/wireframe/build_idml.py" "$SPEC" "$BASE.idml"
python3 "$ROOT/tools/wireframe/check_idml.py" "$BASE.idml"

if command -v scribus >/dev/null 2>&1; then
  RUN=""; [ -n "${DISPLAY:-}" ] || RUN="xvfb-run -a"
  rm -f "$BASE.sla" "$BASE-proof.pdf"
  $RUN scribus -g -ns -py "$ROOT/tools/wireframe/build_sla.py" "$SPEC" "$BASE.sla" "$BASE-proof.pdf" >/dev/null 2>&1
  [ -s "$BASE.sla" ] || { echo "Scribus did not write $BASE.sla" >&2; exit 1; }
  mv "$BASE.sla.overflow.txt" "$ROOT/build/wireframe/overflow.txt"
  if grep -q "^still over:$" "$ROOT/build/wireframe/overflow.txt" && \
     [ "$(sed -n '/^still over:$/,/^deepened/p' "$ROOT/build/wireframe/overflow.txt" | wc -l)" -gt 2 ]; then
    echo "text frames still overflow:" >&2; cat "$ROOT/build/wireframe/overflow.txt" >&2; exit 1
  fi
  echo "$BASE.sla, $BASE-proof.pdf"
else
  echo "no Scribus: skipped the .sla and the proof (pacman -S scribus / apt install scribus)" >&2
fi

# the fonts the documents set type in (OFL), from the system and the repo
PLEX=$(fc-list -f '%{file}\n' 'IBM Plex Mono' 2>/dev/null | grep -E 'IBMPlexMono-(Regular|Italic|Medium|MediumItalic|SemiBold|SemiBoldItalic|Bold|BoldItalic)\.ttf$' || true)
[ -n "$PLEX" ] && for f in $PLEX; do cp "$f" "$OUT/fonts/"; done
# (wireframe/fonts/OFL-IBMPlexMono.txt is IBM Plex's licence, kept beside them)
cp "$ROOT/tools/latex/fonts/Caveat[wght].ttf" "$ROOT/tools/latex/fonts/UnifrakturMaguntia-Book.ttf" \
   "$ROOT/tools/latex/fonts/OFL-Caveat.txt" "$ROOT/tools/latex/fonts/OFL-UnifrakturMaguntia.txt" "$OUT/fonts/"
ls "$OUT"
