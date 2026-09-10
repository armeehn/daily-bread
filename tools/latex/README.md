# Daily Bread from one LaTeX source

`content/issue-01.tex` is the issue. Everything else is derived.

```
                     content/<edition>.tex            (source of truth)
                               |
                 tools/latex/dblatex/reader.py         (documented macros only)
                               |
                          issue dict
             {meta, pages:[{id, template, variant, slug, chrome, content}]}
                    /                          \
        dblatex/web.py                     dblatex/press.py
               |                                   |
   content/<edition>.js  (generated)     lualatex + dailybread.cls
               |                                   |
  tools/strings/from-issue.js            build/latex/<edition>/print.pdf
               |                          48 x A5, 420 x 594.96 pt
   tools/build.js  (unchanged)                     |
               |                         graphicx, saddle-stitch order
   48 pages, newsproof proofs                      |
   (bytes identical, still signed)       build/latex/<edition>/booklet.pdf
                                          24 x Letter landscape, 792 x 612 pt
```

Layers talk only to their neighbour: `cli` -> `web` / `press` -> `reader` /
`writer` -> `model`. Nothing below `web` knows node exists; nothing below
`press` knows lualatex exists. `db.js` and its `@media print` are untouched:
the A5 booklet the studio prints is a different renderer and stays so.

## Commands

```
python3 tools/db-latex.py build --edition issue-01          # web + print
python3 tools/db-latex.py build --edition issue-01 --web    # only the site
python3 tools/db-latex.py build --edition issue-01 --print  # only the PDFs
python3 tools/db-latex.py check --edition issue-01          # the round-trip (CI)
python3 tools/db-latex.py press --edition issue-01          # publish press/issue-01/
python3 tools/db-latex.py import --edition issue-01         # old .js -> .tex, once
```

`press` typesets, runs the print checks, and copies `booklet.pdf` to
`press/<edition>/` with a `booklet.json` beside it (source, geometry, sha256,
engine). That directory is the studio's **Magazine PDF** fallback when
`press.hq` is out of reach, and it is tracked: `.gitea/workflows/press-booklet.yml`
typesets it twice, requires the tracked copy to match, and only commits on a
manual `commit = true` run. Do not typeset it on a workstation and commit that:
a different TeX Live and font set give the same pages and different bytes.

`press --model <studio.json> --out <pdf>` lays the studio's edition over the
`.tex` first (`dblatex/overlay.py`): the theme becomes `\palette{…}` in the
preamble, and every studio field with a print counterpart replaces it, cased
like the print copy; the other pages are typeset untouched. This is exactly
what `tools/press-server.py` does for the studio's button, on demand, as
`daily-bread-press.service` in LXC 111 behind `press.hq`.

`check` proves, in order: tex -> issue -> tex loses nothing; the issue equals
the committed `content/<edition>.js`; rebuilding the site from the .tex
changes no file (so every newsproof signature still verifies, checked with
`check_live.py --offline`); both PDFs have the page count and page size
`press.py` declares (`pdfinfo`), and no side of the booklet has ink in the
4.2 mm a desktop laser cannot print (`pdftoppm`, every side). It is the
`latex` and `latex-print`
jobs of `.gitea/workflows/verify-editions.yml`, and both run on pull
requests.

Print needs `/opt/texlive` (lualatex) and poppler-utils. It finds riposte-latex
at `$RIPOSTE_LATEX` or the sibling checkout `../riposte-latex`; without it
the class shims the brand layer (same geometry, plainer page).

## The macro set

The reader accepts exactly these and errors on anything else, so a page
cannot pick up LaTeX the web never sees.

| Macro | Meaning |
| --- | --- |
| `\issue{} \theme{} \edition{} \trim{}` | issue metadata |
| `\begin{page}{id}{Template}[variant]` … `\end{page}` | one A5 page; `id` is stable across reordering |
| `\slug{}` | the kit's page slug |
| `\chrome{key}{value}` | running head, accent, doc number, folio |
| `\field{name}{value}` | any string prop of the template |
| `\headline{}` `\kicker{}` `\standfirst{}` `\byline{}` `\pullquote{}` | sugar for `title` `kicker` `dek` `byline` `quote` |
| `\begin{seq}{name}` `\block{…}` … `\end{seq}` | a block sequence (paragraphs, rows, panels, poems) |
| `\begin{body}` … `\end{body}` | sugar for `seq{body}` |

Values are verbatim strings. Inside them the issue's own notation applies:
`a | b | c` are fields of one row, ` / ` is a line break in a poem, `Q:` /
`A:` prefix speakers, a trailing `#hex` field pins a row's accent, `none`
hides an optional element. TeX specials are escaped (`\# \$ \% \& \_ \{ \}
\textbackslash{}`) and unescaped by the reader; write `\#f0477d`.

Templates and their props are the fifteen `db-render/DB *.dc.html` kits
(Cover, Letter, Contents, Feature, Body, Photo Essay, Opinion, Comic,
Interview, Poetry, Insert, Lab, Review, Listings, Colophon). Two pages that
share one content bag (Letter masthead/letter, Contents, Interview, Lab,
Colophon) carry it twice in the .tex; the class lays out the half its variant
owns.

## Printing the booklet

`booklet.pdf` is made for the estate's Brother MFC-L2710DW and any desktop
duplex laser like it: Letter, landscape, two A5 pages a side, saddle-stitch
order. Print it at **actual size (100%), two-sided, flip on the short
edge**; the file carries that as its viewer preference, so a dialog that
honours it opens pre-set. Fold the stack down the middle, staple the spine.

The pages are scaled to 0.909 and sit flush at the fold, leaving 5 mm at the
outer edge and 12.5 mm head and foot: a laser leaves the outer 4.2 mm of a
sheet white whatever it is sent, and nothing is trimmed after folding, so
what bleeds in the design ends at that band. Every side has a white frame.
A true bleed (ink to the paper's edge) needs oversize stock and a guillotine,
which this pipeline does not target.

## Print layout

`dailybread.cls` stores every prop at `\field`/`\block` time and typesets
at `\end{page}` through a per-template order list. Each page is one
fixed-height box, so the page count is the number of `\begin{page}`s
whatever the content does; content that does not fit shows up as an
`Overfull \vbox` in the log and `check` reports it. Anything a template does
not place is still printed small under a dashed rule, so nothing in the
source is silently absent from paper.

The face is IBM Plex Mono (the kit's); riposte-latex supplies the palette,
rules and the JetBrains fallback. The kit's Caveat and UnifrakturMaguntia
are web fonts only and are not used on paper.

## The look

`dailybread.cls` v0.2 draws the page furniture of the `db-render/*.dc.html`
kit in TeX, so a press PDF reads as Daily Bread without the browser:

- running heads over the page's accent rule; `DOC NO.` and folio over a
  full-bleed footer strip (`footer=mono` checkerboard, `footer=duo` diamonds),
  painted from the shipout hook so one `lualatex` pass is enough;
- ink-framed row tables with dashed rules, numbered chips and a right-hand
  label; a `#hex` last field pins the chip colour;
- dashed photo slots sized by the kit's `imgH` (`px` = 1/96 in), accent-barred
  pull quotes, kiss-cut sticker die-lines, hatched comic panels;
- UnifrakturMaguntia on the brands and the wordmark, Caveat on the sign-offs
  (`tools/latex/fonts/`, OFL); IBM Plex Mono for everything else;
- body copy justified and hyphenated with microtype protrusion.

Front and back covers are full bleed; `art` paths resolve against
`db-render/` (press.py passes `\dbassets`). Pixel identity with the Chromium
kit is not a goal; the same 48 pages, chrome and imposition are.

`content/issue-02.tex` (№2, "The Thaw") is the second edition and the proof
the class generalises: `python3 tools/db-latex.py build --edition issue-02`.
