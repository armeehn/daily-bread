# The Daily Bread №1 — layout wireframe

The whole issue as a desktop-publishing file: every page of the printed
magazine, with each text and image frame where the press puts it, labelled,
styled and empty of copy. Lay the issue out from here in Scribus, InDesign or
Affinity Publisher; the house grid, styles, swatches and masters are already in
the document.

| File | Open with |
| --- | --- |
| `daily-bread-issue-01.sla` | Scribus 1.6 (the native file; start here in Scribus) |
| `daily-bread-issue-01.idml` | InDesign CS4 or later, Affinity Publisher 2 (File → Open) |
| `daily-bread-issue-01-proof.pdf` | any PDF viewer: the wireframe as printed, with bleed and crop marks |
| `fonts/` | the issue's fonts and their licences (SIL OFL 1.1) |

The frames are measured from the press (`tools/press/`), so the wireframe is the
same layout as the website, the web PDF and the printed booklet. It is generated:
see [Rebuilding](#rebuilding) before editing it by hand.

## Before you open it

Install the fonts in `fonts/` (double-click each file, or copy them to
`~/.fonts`, `~/Library/Fonts` or `C:\Windows\Fonts`), then restart the layout
program. Without them Scribus asks to substitute and InDesign marks the text
pink.

| Family | Used for |
| --- | --- |
| IBM Plex Mono (Regular, Italic, Medium, SemiBold, Bold and italics) | everything else |
| UnifrakturMaguntia Book | the wordmark and Fraktur headlines |
| Caveat | script pull quotes and sign-offs |

## The document

| | |
| --- | --- |
| Trim | A5, 148 × 210 mm, portrait |
| Pages | 36, facing pages, page 1 a right-hand page |
| Binding | saddle stitch (36 = 9 sheets folded) |
| Bleed | 3 mm on every outside edge, never across the spine |
| Margins | top 12, bottom 15, inside 15, outside 12 mm |
| Columns | 2, 5 mm gutter |
| Baseline grid | 15 pt (body leading) |
| Colour | CMYK swatches named `DB …` |

Page 1 is the front cover: the cover art alone, bled on every edge, with the
price stamp. Page 2 is the masthead and page 36 the back cover. The issue fills
all 36 pages, a multiple of four, so there is no spare; when an issue runs
short, the press puts the blanks before the back cover.

### Layers

| Layer | Holds |
| --- | --- |
| Ground | page and panel colour, bled where the page bleeds |
| Art | image frames (empty) and card shadows |
| Text | every text frame |
| Notes | what goes in each image frame; **does not print** |

### Masters

| Master | Pages | Carries |
| --- | --- | --- |
| A (light) | pages on bone/paper grounds | folio and running foot in ink, mirrored left/right |
| B (dark) | pages on ink/dark grounds | the same, reversed in bone |
| none | covers (1 and 36) and the masthead (2) | nothing: no folio on a cover |

### Paragraph styles

One per role (and face, where a role comes in more than one), plus a
`· reversed` twin of each for dark grounds. Sizes are those the issue prints at;
a frame on a page the press set tighter or looser carries its own size on top
of the style.

| Style | Font | Size / leading |
| --- | --- | --- |
| Wordmark | UnifrakturMaguntia Book | 83.4 / 68.4 pt |
| Headline · Mono | IBM Plex Mono Bold, caps | 26.4 / 25.3 pt |
| Headline · Fraktur | UnifrakturMaguntia Book | 25.2 / 23.9 pt |
| Pull quote · Script | Caveat Regular | 20.4 / 34.7 pt |
| Pull quote · Mono | IBM Plex Mono SemiBold Italic | 11.4 / 14.8 pt |
| Dek | IBM Plex Mono Regular | 9.3 / 15.8 pt |
| Body | IBM Plex Mono Regular | 9.3 / 15.1 pt |
| Card body | IBM Plex Mono Regular | 8.4 / 12.2 pt |
| Section head | IBM Plex Mono Regular | 7.2 / 12.2 pt |
| Stamp | IBM Plex Mono Bold, caps | 6.6 / 11.2 pt |
| Caption | IBM Plex Mono Regular, caps | 6.3 / 10.1 pt |
| Card head | IBM Plex Mono Bold, caps | 6.3 / 10.7 pt |
| Kicker | IBM Plex Mono Regular, caps | 6.0 / 10.8 pt |
| Stat | IBM Plex Mono Regular, caps | 6.0 / 9.0 pt |
| Folio, Folio · reversed | IBM Plex Mono | running foot and page number |
| Note | IBM Plex Mono | the Notes layer |

### Frames

Each frame holds a label instead of copy:

- **headlines, kickers, stamps, stats**: the current issue's words, so a frame
  can be told from its neighbours;
- **body, dek and card text**: the role, the word count of what is there now,
  and its opening words;
- **a contributor's piece**: its path and its word budget, e.g.
  `BODY — letters/… · 240 words fit here (520 for the whole piece)`. These are
  the same limits the studio and the submissions desk enforce.

Select all the text in a frame and paste or place the copy over it; the
paragraph style stays. Image frames are empty and sized to the press layout;
the Notes layer says what goes in each.

## Colour

The swatches are the website's theme converted to CMYK with a plain formula,
not through a press profile. They are close, not matched. **Proof on the
printer's stock before a run**, and adjust the swatches (every frame uses them
by name) rather than individual frames.

| Swatch | Screen | C M Y K |
| --- | --- | --- |
| DB ink | #1d1a17 | 0 10.3 20.7 88.6 |
| DB bone | #f6f1e7 | 0 2 6.1 3.5 |
| DB panel | #eae4d6 | 0 2.6 8.5 8.2 |
| DB paper2 | #efe9db | 0 2.5 8.4 6.3 |
| DB dark | #2a2723 | 0 7.1 16.7 83.5 |
| DB muted | #8d857a | 0 5.7 13.5 44.7 |
| DB pink | #f0477d | 0 70.4 47.9 5.9 |
| DB teal | #12b795 | 90.2 0 18.6 28.2 |
| DB orange | #fe9a0d | 0 39.4 94.9 0.4 |
| DB extra #b7ad9e, #cfc6b6 | | rules and hairlines off the theme |

Large ink areas print as a single-colour black of about 89% K with a warm tint.
If the printer wants a rich black for the covers, change `DB ink` once.

## Sending it to press

Export a PDF/X-1a (or PDF/X-4 if the printer asks for it) of single pages, not
spreads:

- **Scribus**: File → Export → Save as PDF. In *General* choose PDF/X-1a or
  PDF/X-4; in *Pre-press* tick *Use document bleeds* and *Crop marks*. Scribus's
  preflight runs first and lists any overflowing text or missing image.
- **InDesign**: File → Export → Adobe PDF (Print), preset *PDF/X-1a:2001*. In
  *Marks and Bleeds* tick *Crop marks* and *Use document bleed settings*.
- **Affinity Publisher**: File → Export → PDF, preset *PDF/X-1a*. Under *More*
  tick *Include bleed* and *Include printer marks*.

Leave imposition (page order on the sheets) to the printer, who imposes from
single pages. For a desktop proof the repository's press makes its own 2-up
booklet (`tools/press/`).

## Known limits

- **Scribus reading the IDML** is partial: it imports pages, frames, styles and
  swatches, but drops the items on right-hand master pages (the folio on odd
  pages). Scribus users should open the `.sla`, which is complete.
- Text is live but not linked between frames: a piece continued on another page
  is two stories. Link them in your layout program if you want copy to flow.
- Image frames are empty. Place the art from `db-render/` and `assets/`, or the
  photographer's files, and fit to frame proportionally.

## Rebuilding

The wireframe is generated from the issue the studio has published, so it moves
when the issue does:

```
sh tools/wireframe/build.sh
```

That measures the press layout (`tools/wireframe/extract.js` →
`build/wireframe/spec.json`), writes the IDML (`build_idml.py`) and checks it
(`check_idml.py`), then runs Scribus headless (`build_sla.py`, under `xvfb-run`
when there is no display) for the `.sla` and the proof. It needs Node 22 with
the press's dependencies, Python 3, Scribus 1.6 and the fonts above installed.
The build fails if any frame's text still overflows.

Edits made by hand in this folder are overwritten by the next build. Once an
issue is being laid out by hand, copy its file somewhere else and work there.
