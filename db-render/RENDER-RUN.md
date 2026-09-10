# db-render — actual run notes (this machine)

`render_dc_print.js` + `PRINT-SPEC.md` are the portable pipeline. This file records
the two environment-specific tweaks needed to run it on *this* box, plus the exact
commands that produced `out/booklet.pdf` and `out/print.pdf` (verified 2026-07-26).

## Two environment tweaks

1. **playwright version must match the cached Chromium.** The browser cache holds
   Chromium build **1228** (Chrome-for-Testing 149). Only `playwright@1.61.0` maps
   to 1228, so install that exact version (any other version tries to download a
   different build, which the sandbox blocks):
   ```
   cd db-render && npm install playwright@1.61.0
   ```
2. **Chromium needs the vendored system libs** (this Arch box lacks nspr/nss/gbm/…).
   They live at `~/.local/pwlibs`; put them on the linker path when running:
   ```
   LD_LIBRARY_PATH=~/.local/pwlibs/usr/lib:~/.local/pwlibs/usr/lib64
   ```

## Serving: use the in-process runner

A detached `python3 -m http.server` (as in PRINT-SPEC §1) gets reaped between shell
calls in this sandbox. `serve-and-render.js` avoids that by serving the folder and
spawning `render_dc_print.js` in one process tree.

```bash
cd db-render
OUT=./out; mkdir -p $OUT
LD_LIBRARY_PATH=~/.local/pwlibs/usr/lib:~/.local/pwlibs/usr/lib64 \
  node serve-and-render.js "$PWD" "Daily Bread Issue 01 v2-booklet.dc.html" "$OUT/booklet.pdf"
LD_LIBRARY_PATH=~/.local/pwlibs/usr/lib:~/.local/pwlibs/usr/lib64 \
  node serve-and-render.js "$PWD" "Daily Bread Issue 01 v2-print.dc.html"  "$OUT/print.pdf"
```

`serve-and-render.js` passes `VENDOR=<kit>/vendor` automatically, so the bundled
CDN assets in `vendor/` are used (no network). Pass a 4th arg = expected sheet
count to assert completeness (booklet 24, print 48).

## Verify (no poppler here; ghostscript works)

```bash
# page count + MediaBox (points)
gs -q -dNOSAFER -dNODISPLAY -c "(out/booklet.pdf)(r) file runpdfbegin pdfpagecount == 1 pdfgetpage /MediaBox get {==} forall quit"
# rasterize a page to eyeball it
gs -q -dSAFER -sDEVICE=png16m -r72 -dFirstPage=1 -dLastPage=1 -o pg.png out/booklet.pdf
```

Verified output: **booklet** 24pp @ 841.92×594.96pt (A4 landscape), **print** 48pp
@ 420×594.96pt (A5); fonts embedded (14 FontFile objects each); backgrounds print;
no collapsed/blank pages.
