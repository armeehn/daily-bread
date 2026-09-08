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
               |                         pdfpages, saddle-stitch order
   48 pages, newsproof proofs                      |
   (bytes identical, still signed)       build/latex/<edition>/booklet.pdf
                                          24 x A4 landscape, 841.92 x 594.96 pt
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
python3 tools/db-latex.py import --edition issue-01         # old .js -> .tex, once
```

`check` proves, in order: tex -> issue -> tex loses nothing; the issue equals
the committed `content/<edition>.js`; rebuilding the site from the .tex
changes no file (so every newsproof signature still verifies, checked with
`check_live.py --offline`); both PDFs have the page count and page size the
Chromium pipeline yields (`pdfinfo`). It is the `latex` and `latex-print`
jobs of `.github/workflows/verify-editions.yml`, and both run on pull
requests.

Print needs `/opt/texlive` (lualatex) and `pdfinfo`. It finds riposte-latex
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
