# The .tex issues

The magazine prints from the studio's model now (`db.js` → `db-print.js` →
`tools/press/`; see the [README](../../README.md#print)). What is left here is
the issue as LaTeX, from before that, for two jobs:

1. **The site's shared facts.** `content/<edition>.tex` is read into
   `content/<edition>.js`, and `tools/strings/from-issue.js` takes the facts the
   website and the issue must agree on (calendar, directory, screenings,
   contents, ledger, lab status) from it rather than writing them twice.
2. **Issue №2.** `content/issue-02.tex` ("The Thaw") has not moved into the
   studio yet: its pages use layouts №1 does not (an interview in Q&A, a feature
   opener with stats). Until the model has those sections, `build --print`
   typesets it as a proof.

```
                     content/<edition>.tex
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
  tools/strings/from-issue.js            build/latex/<edition>/print.pdf  (48 x A5)
               |                         build/latex/<edition>/booklet.pdf (Letter, 2-up)
   tools/build.js -> 48 site pages
```

## Commands

```
python3 tools/db-latex.py build --edition issue-01          # web + print proof
python3 tools/db-latex.py build --edition issue-01 --web    # only content/<edition>.js and the site
python3 tools/db-latex.py build --edition issue-02 --print  # only the proof PDFs
python3 tools/db-latex.py check --edition issue-01          # the round trip (CI)
python3 tools/db-latex.py import --edition issue-01         # old .js -> .tex, once
```

`check` proves, in order: tex -> issue -> tex loses nothing; the issue equals
the committed `content/<edition>.js`; rebuilding the site from the .tex changes
no file (so every newsproof signature still verifies); and, with `--print`,
both PDFs have the page count and size the issue implies and no side of the
booklet has ink in the 4.2 mm a desktop laser cannot print. These are the
`latex` and `latex-print` jobs of `.gitea/workflows/verify-editions.yml`.

Printing needs TeX Live (lualatex, fontspec, TikZ) and poppler-utils. The class
finds riposte-latex at `$RIPOSTE_LATEX` or `../riposte-latex`; without it it
shims the brand layer (same geometry, plainer page).

## The macro set

The reader accepts exactly these and errors on anything else.

| Macro | Meaning |
| --- | --- |
| `\issue{} \theme{} \edition{} \trim{}` | issue metadata |
| `\begin{page}{id}{Template}[variant]` … `\end{page}` | one A5 page; `id` is stable across reordering |
| `\slug{}` | the page slug |
| `\chrome{key}{value}` | running head, accent, doc number, folio |
| `\field{name}{value}` | any string prop of the template |
| `\headline{}` `\kicker{}` `\standfirst{}` `\byline{}` `\pullquote{}` | sugar for `title` `kicker` `dek` `byline` `quote` |
| `\begin{seq}{name}` `\block{…}` … `\end{seq}` | a block sequence (paragraphs, rows, panels, poems) |
| `\begin{body}` … `\end{body}` | sugar for `seq{body}` |

Values are verbatim strings: `a | b | c` are fields of one row, ` / ` is a line
break in a poem, `Q:` / `A:` prefix speakers, a trailing `#hex` field pins a
row's accent, `none` hides an optional element. TeX specials are escaped
(`\# \$ \% \& \_ \{ \} \textbackslash{}`); write `\#f0477d`.

Fifteen templates (Cover, Letter, Contents, Feature, Body, Photo Essay,
Opinion, Comic, Interview, Poetry, Insert, Lab, Review, Listings, Colophon),
each with variants; a page carries every prop of its template, and the class
prints the ones its variant owns (`dailybread.cls`, `% TEMPLATES`).

## The class

`dailybread.cls` draws each page as one fixed-height A5 box, so the page count
is the number of `\begin{page}`s; content that does not fit shows up as an
`Overfull \vbox` that `check` reports. The furniture follows the retired HTML
print kit (in git history): running heads over an accent rule, `DOC NO.` and
folio over a full-bleed footer strip, ink-framed row tables, dashed photo
slots, UnifrakturMaguntia on brands and the wordmark, Caveat on sign-offs, IBM
Plex Mono for the rest. `art` paths resolve against `db-render/`.

The booklet is made for a desktop duplex laser: Letter, landscape, two A5 pages
a side, saddle-stitch order, scaled to 0.909 and flush at the fold, clear of the
4.2 mm band a laser leaves white. Print at actual size, two-sided, flip on the
short edge.
