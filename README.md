# Daily Bread

A queer magazine for the Okanagan, baked quarterly in Kelowna, BC.
Free where you found it; pay what you can where you can't.

**Issue №1 — Kelowna's Collapse** (Summer 2026). Funded by Riposte Laboratories Inc.

This repository is meant to be forked. The machinery is MIT; every name,
domain, place and mailbox it carries lives in [`magazine.env`](magazine.env),
and `python3 tools/rebrand.py` makes the tree follow it. [`FORKING.md`](FORKING.md)
is the checklist from fork to your first edition.

Read it at [db.ripostelabs.xyz](https://db.ripostelabs.xyz): blackletter
masthead, IBM Plex Mono spec-sheet chrome, checker bands, the pink/teal/orange
accent cascade over a bone/ink base, in sixteen languages.

## One magazine, one renderer

```
            studio.html  ──edits──►  the edition (a JSON model)
                                          │
                                   db.js  DB.render(model)       one HTML document, no runtime JS
                                          │
             ┌────────────────────────────┼─────────────────────────────┐
             ▼                            ▼                             ▼
      the page (Publish)      db-print.js lays it out on        tools/press/render.js:
                              sheets of the trim: Web PDF       the same sheets in headless
                                                                Chromium → booklet.pdf
                                                                and printer.pdf
```

The website, the Web PDF and the printed booklet are the same pages, drawn by
the same CSS in the same self-hosted fonts (`assets/fonts/`). Print differs
only where paper does: sections start on a fresh A5 page, a long section runs
on to the next page, a long piece carries on to a Continued page, and text
prints at one size throughout (0.8 of the web's, about 9.3 pt).
`tools/press/test-press.js` checks that the studio's Web PDF and the press lay
out the same sheets at the same scales.

## Repository map

| Path | What it is |
|---|---|
| [`studio.html`](studio.html) | The browser studio: edit, re-skin, preview and print an edition. Served at `/studio` |
| [`db.js`](db.js) | The engine: `DEFAULT_MODEL` (the whole of №1), theme presets, the form `SCHEMA`, and `DB.render(model)` |
| [`db-print.js`](db-print.js) | The pager: lays `DB.render` out on sheets, and measures each writer's word limit on them |
| [`tools/press/`](tools/press/) | The press: `render.js` (sheets → booklet, printer's PDF, proof), `test-press.js` |
| [`tools/press-server.py`](tools/press-server.py) | The press over HTTP, for the studio's Print menu (`--studio` also serves the studio) |
| [`tools/wireframe/`](tools/wireframe/) → [`wireframe/`](wireframe/) | The issue as a DTP wireframe: Scribus `.sla`, InDesign/Affinity `.idml`, proof PDF and fonts |
| [`press/`](press/) | Per edition: the published booklet, its manifest, and `limits.json` for the desk |
| [`assets/`](assets/) | Cover, logo and the magazine's fonts (`fonts/magazine.css`) |
| [`tools/build.js`](tools/build.js), [`tools/strings/`](tools/strings/), [`tools/assets/`](tools/assets/) | The multilingual site: 48 pages (16 languages × full, lite, e-ink) |
| `index.html`, `<lang>/`, `lite/`, `eink/` | The built pages, committed; CI fails if they differ from a rebuild |
| [`content/`](content/), [`tools/latex/`](tools/latex/) | The issues as `.tex`, which feed the site's shared strings; see [below](#the-tex-issues) |
| [`tools/newsproof/`](tools/newsproof/) + [`verify/`](verify/) | Tamper-evidence: every page is hashed, logged and signed |
| [`desk/`](desk/), [`STYLE.md`](STYLE.md) | The submissions desk: an email Worker that reads drafts against the house style and the word limits |
| [`shop/`](shop/), [`tools/merch/`](tools/merch/) | The shop pane and the merch artwork pipeline |
| [`db-render/`](db-render/) | The studio's browser tests, the logos and uploaded images |
| [`wrangler.jsonc`](wrangler.jsonc), [`CLOUDFLARE.md`](CLOUDFLARE.md) | Deploy: the repo root as Cloudflare Worker static assets |
| [`magazine.env`](magazine.env), [`FORKING.md`](FORKING.md), [`LICENSE`](LICENSE) | Make it yours |

## Quickstart

```sh
cd tools/press && npm install && cd ../..   # the press (Playwright + pdf-lib), once
python3 tools/press-server.py --studio      # the studio and the press, on this machine
# open http://localhost:8091/studio.html

node tools/build.js                         # rebuild the 48 site pages
node tools/check-site.js                    # read them back: links, hreflang, sitemap, headers
node tools/press/render.js --publish        # re-publish press/<edition>/ after changing the default edition
```

Tests: `cd tools/press && npm test` (the press), `npm run audit` (the print design), and
`node db-render/test-studio-{editor,design,editions,press,cutter}.mjs` (the studio, in
a real browser). CI (`.gitea/workflows/`) rebuilds and reads back the site,
checks the `.tex` round trip and the rebrand, and renders, tests and guards
the press booklet.

## The studio

`studio.html` edits the whole issue in the browser; nothing is saved anywhere
but your browser until you export or publish. It is served at `/studio` by the
same Worker as the magazine ([`CLOUDFLARE.md`](CLOUDFLARE.md) shows how to put
it behind a login), or from the press server on your own machine.

- **Design and All fields.** Click anything on the page to edit it there:
  double-click text to type on the page, drag rows to reorder, drop an image
  on a picture. All fields is every section as a form, with add, delete and
  reorder for every list.
- **Undo / Redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) covers every edit, per edition.
- **Find** (`Ctrl+K`) searches field names, sections, what each field says,
  and the studio's commands.
- **Formatting** — fields that print `<b>`, `<i>` and `<a>` get a B / I / Link
  strip. `?` lists the keyboard shortcuts.
- **Pictures** open in the image editor (crop, turn, flip, brightness,
  contrast, saturation, black and white) before they go in. A picture that has
  not been uploaded yet shows as a labelled slot on the page.
- **Themes** — colours, the three fonts and four presets. Editions (`⋯`): new,
  duplicate, rename, export and import JSON.
- **Word limits.** Each section shows its pieces' limits (`≤ 349 w`) and how
  many words each has. They are measured, not estimated, on the pages that
  print: each piece is grown with words of its own section until its sheet
  would overflow. A long piece (the letter, History, each Young Voices report,
  the Lab) holds its first page and a whole Continued page. The desk tells
  writers the same numbers, from `press/<edition>/limits.json`.

## Print

The **Print ▾** menu:

- **Web PDF** — the magazine's pages through your browser's print dialog
  (Save as PDF, Margins None, Background graphics on), at the trim set under
  Print & bleed (A5 by default). No crop marks: the copy you print yourself.
- **Magazine PDF** — the booklet for a desktop duplex printer: the same pages,
  two to a Letter-landscape side in saddle-stitch order, padded with blank
  pages to a multiple of four (spares go before the back cover) and clear of
  the band a laser cannot ink. Print two-sided, short-edge flip, actual size;
  fold and staple.
- **Printer PDF** — for a print shop: the same pages one per PDF page in
  reading order, each on trim + bleed + a 5 mm slug with crop marks, with
  `/TrimBox` and `/BleedBox` set. The bleed is real: each section's ground is
  laid out into it. The PDF is RGB; ask the shop whether they convert to CMYK.
- **Stickers for a cutter** — a transparent PNG of the sticker sheet at 300 dpi
  for Cricut Print Then Cut (6.75 × 9.25 in). In Design Space: *Upload*, *Print
  Then Cut image*, width 6.75 in, *Make It*.
- **Cut files for the appendix** — the appendix prints the sticker sheet once
  for each machine that cuts a page printed anywhere (a Cricut does not, so
  the sticker page and the PNG above stay its default): A1 Silhouette (Type 1
  marks: a 5 mm square and two 20 mm L-brackets, 0.5 mm thick, 10 mm in from
  the trim), A2 Brother ScanNCut (no marks, an outline round each sticker for
  its scanner), A3 crosshairs (a target 10 mm in from three corners). This
  button saves each page's cut file (`.svg` in mm, `.dxf` in inches), measured
  from the trim with the numbers the pages print with. Cut a page from a copy
  printed at 100 % (Printer PDF, or Web PDF at actual size), not the booklet.

The Magazine and Printer PDFs come from the press, which needs a headless
Chromium a web page cannot drive. The studio uses a press on this machine
(`python3 tools/press-server.py`, port 8091) first, then `press.hq`. With
neither, it says so and offers the booklet last published in `press/`, which
does not have your edits.

The press is deterministic: with `SOURCE_DATE_EPOCH` set, two renders are
byte-identical, and every face in the PDF is one the magazine declares.

The printed issue is set for reading, by rules with sources behind them (body
type, measure, contrast, wayfinding, the cover on a café rack):

- body copy at 10.5 pt, never under 10; captions and credits at 8 pt or more;
- one column of running text, 45–75 characters a line, ragged right, roman;
- muted text at 4.5:1 or better on its ground, light or dark;
- a folio on every inside page; the contents' page numbers set from where each
  section really prints, and the page count from the press;
- the cover art on page 1 with the price and the issue in its top-left third.

`cd tools/press && npm run audit` measures all of them on the laid-out issue;
CI runs it with `--strict`. A layout change that breaks one fails the press job.

To lay an issue out by hand in Scribus, InDesign or Affinity Publisher, start
from the [wireframe](wireframe/README.md): the same pages as frames, with the
house grid, styles, swatches and masters, rebuilt by
`sh tools/wireframe/build.sh`.

## The website

`tools/build.js` builds the published site from `tools/strings/` (English in
`en.js`, fifteen machine translations beside it, unreviewed), in sixteen
languages and three renderings: **full**, **lite** (no web fonts or heavy
decoration) and **e-ink** (monochrome, high contrast). `hreflang`, a JS-free
language picker, `dir="rtl"` for Arabic and Farsi and a `sitemap.xml` come
with it. The issue reads one section at a time from a contents rail, done with
CSS `:target` and no runtime JS; printing still gives the whole issue.
`node tools/check-site.js` reads every built page back and fails on dead
links, missing assets, bad `hreflang` and the like.

**Known gap.** The site's pages are drawn by `tools/build.js` and
`tools/assets/style.css`, a twin of `db.js` kept in step by hand, so the
multilingual site is not yet the one renderer the studio and the press share
(the studio's Publish writes `DB.render`'s page). Folding it in re-renders
every signed page, so it waits for a re-signing.

## Verified publishing

Every language edition is signed with a key kept off the web server, recorded
in an append-only [RFC 6962](https://www.rfc-editor.org/rfc/rfc6962)
transparency log, and pinned to a public anchor. [`/verify/`](verify/) checks
all sixteen in the browser; [`verify/verify_standalone.py`](verify/verify_standalone.py)
is the offline check against a fingerprint obtained elsewhere. It proves the
words are the ones published, not that they are true. To re-sign after a
rebuild:

```sh
node tools/build.js
cd tools && python3 -m newsproof.dbproof sign
python3 -m newsproof.dbproof anchor --via git --ref "git tag in <org>/daily-bread"
```

The signing keys stay in `tools/newsproof/store/` (git-ignored) and belong
offline. Read [`tools/newsproof/THREAT-MODEL.md`](tools/newsproof/THREAT-MODEL.md)
before trusting any of it.

## The .tex issues

`content/issue-01.tex` and `issue-02.tex` are the issues as LaTeX, from before
the studio printed. They still feed the site's shared facts (calendar,
directory, screenings, contents, ledger, lab status: `content/<slug>.js`,
read by `tools/strings/from-issue.js`), and `python3 tools/db-latex.py
{build,check}` keeps that round trip honest. **Issue №2 ("The Thaw") exists
only as `.tex`**: its pages use layouts №1 does not (an interview in Q&A, a
feature with stats), so it moves into the studio once the model has those
sections. Until then `db-latex.py build --print` typesets it as a proof. See
[tools/latex/README.md](tools/latex/README.md).

## Brand

Daily Bread is an independent publication **funded by** Riposte Laboratories Inc. — it is not
a Riposte-branded product and keeps its own masthead, type stack and voice on purpose.
<!-- rebrand:off -->
[`BRAND.md`](BRAND.md) records what the two share, what diverges deliberately, and which
parts of the [Riposte design system](https://github.com/armeehn/riposte-brand) still apply
(chiefly contrast and print rule weights). A fork owes it nothing.
<!-- rebrand:on -->

<table>
<tr>
<td><b>DOC NO. DB-100-A</b><br>REV. A &middot; EST. 2026</td>
<td align="right"><b>DAILY BREAD</b><br>Funded by Riposte Laboratories Inc.</td>
</tr>
</table>
