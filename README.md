# Daily Bread

A queer magazine for the Okanagan, baked quarterly in Kelowna, BC.
Free where you found it; pay what you can where you can't.

**Issue №1 — Kelowna's Collapse** (Summer 2026). Funded by Riposte Laboratories Inc.

This repository is meant to be forked. The machinery is MIT; every name,
domain, place and mailbox it carries lives in [`magazine.env`](magazine.env),
and `python3 tools/rebrand.py` makes the tree follow it. [`FORKING.md`](FORKING.md)
is the checklist from fork to your first edition.

Read it at [db.ripostelabs.xyz](https://db.ripostelabs.xyz). The web edition is
static HTML in sixteen languages, styled from the print design: blackletter
masthead, IBM Plex Mono spec-sheet chrome, checker bands, the pink/teal/orange
accent cascade over a bone/ink base. The same source typesets the print run.

## Repository map

| Path | What it is |
|---|---|
| [`content/`](content/) | The issues. One LaTeX file each (`issue-01.tex`) and its generated `.js` twin, which the web build reads |
| [`tools/build.js`](tools/build.js) | The web build: 48 pages (16 languages × full, lite, e-ink) from `content/`, `tools/strings/` and `tools/assets/` |
| `index.html`, `<lang>/`, `lite/`, `eink/` | The built pages, committed; CI fails if they differ from a rebuild |
| [`studio.html`](studio.html) + [`db.js`](db.js) | The browser studio: edit, re-skin and preview an edition, typeset it through the press. Served at `/studio` |
| [`tools/latex/`](tools/latex/) | The press: `dailybread.cls`, the `.tex` ⇄ `.js` round trip, the saddle-stitch booklet imposition |
| [`press/`](press/) | The pressed booklets, one per issue, byte-checked by CI |
| [`tools/newsproof/`](tools/newsproof/) + [`verify/`](verify/) | Tamper-evidence: every page is hashed, logged and signed; the badge on the page checks it |
| [`tools/strings/`](tools/strings/) | The web chrome in English (`en.js`) and fifteen translations |
| [`shop/`](shop/), [`tools/merch/`](tools/merch/) | The shop pane and the merch artwork pipeline |
| [`wrangler.jsonc`](wrangler.jsonc), [`CLOUDFLARE.md`](CLOUDFLARE.md) | Deploy: the repo root served as Cloudflare Worker static assets |
| [`magazine.env`](magazine.env), [`FORKING.md`](FORKING.md), [`LICENSE`](LICENSE) | Make it yours |
| [`db-render/`](db-render/) | The original hand-laid-out kit, kept for reference; not served |

## Quickstart

```sh
node tools/build.js               # rebuild the 48 pages (Node standard library only)
node tools/check-site.js          # read them back: links, hreflang, sitemap, headers
python3 tools/db-latex.py build   # .tex → .js round trip and both press PDFs (needs TeX Live)
python3 tools/db-latex.py check   # prove the round trip
open studio.html                  # the studio works from file://
```

CI (`.gitea/workflows/verify-editions.yml`) runs the rebuild, the read-back,
the round trip, the press geometry and the rebrand round trip on every push.

## Reading — the contents rail and the section tabs

The issue is read **one section at a time**, not as a single long scroll. A
contents rail lists all eleven sections with their `Sec.` numbers — a sticky,
independently scrolling column down the left at desktop widths, and a
horizontally scrolling strip pinned under the top bar on narrow screens. Picking
one shows that section on its own.

It is still **one document with the same markup and no runtime JS**: each tab is
a `.pane` wrapper carrying the section's existing anchor (`#letter`, `#comics`,
…), revealed by CSS `:target`. So deep links keep working (`/#calendar` opens
straight onto that tab), the browser's back button steps through tabs, `hreflang`
and the sitemap are untouched, and **printing still yields the whole issue in
document order** — the tabs are a screen affordance only.

The rules live in `tools/assets/style.css` behind `@supports selector(:has(*))`,
because the landing state ("nothing targeted yet, so show the first tab") can
only be written as `body:not(:has(.pane:target))`. A browser without `:has()`
never applies any of it and gets exactly the continuous scroll the site had
before, with the top bar's section list back as its navigation — the failure mode
is the old page, never a blank one.

Two sections have no tab of their own and ride inside the pane they follow —
WAITLIST STATS and the INTERVIEW QUOTE both sit in **Voices** — so a tab costs no
new string in sixteen languages. The tab table is `TABS` in `tools/build.js`; it
feeds the rail, the top-bar list and the pane wrappers. `style.css` needs one
`a[href="#<id>"]` selector per tab for the current-tab highlight, which CSS
cannot derive from the target, so `checkTabs()` **fails the build** if a tab is
added without one.

## Languages — the multilingual build

The site ships in **16 languages** (English plus the 12 the Government of BC
officially supports, plus Italian, Polish and Latin), matching the language set of
the sibling ripostelabs.xyz site. English lives at the root (`/`); every other
language is a fully static page under `/<lang>/` (`/fr/`, `/es/`, `/ar/`, …), with
a JS-free language picker in the top bar, `hreflang` alternates, a `sitemap.xml`,
`dir="rtl"` for Arabic and Farsi, and a machine-translation notice on non-English
pages.

Each language is emitted in **three renderings**, chosen with the Full / Lite /
E-ink switch in the top bar (and the footer):

- **Full** — the rich, web-font, colour edition, at the language root (`/`, `/fr/`).
- **Lite** — the same content with the web fonts and heavy decoration (glows, hard
  offset shadows, checker/harlequin bands) stripped for low-bandwidth reading;
  colour kept. Under `/lite/`, `/<lang>/lite/`.
- **E-ink** — Lite plus a pure-monochrome, high-contrast, motion-free treatment for
  e-readers; colour art is rendered greyscale. Under `/eink/`, `/<lang>/eink/`.

Full pages advertise the lighter renderings to data-saver and monochrome clients
via `<link rel="alternate" media="(prefers-reduced-data: reduce)|(monochrome)">`
hints; every rendering carries the full set of `hreflang` alternates and is listed
in `sitemap.xml` (16 languages × 3 renderings = 48 pages).

It is generated by a committed build system under `tools/`:

- `tools/strings/en.js` — the English strings (source of truth; one key = one
  unit). `tools/strings/en.json` is the same content as flat JSON, for handing to
  translators alongside `tools/strings/TRANSLATE.md`.
- `tools/strings/<lang>.json` — machine translations (same keys; any missing key
  falls back to English).
- `tools/assets/style.css` — the page stylesheet, inlined into each Full page.
- `tools/assets/alt.css` — a small override layer inlined *after* `style.css` on
  the Lite and E-ink pages (which reuse the same markup); it strips the decoration
  and, for E-ink, collapses the accent tokens to black/white.
- `tools/build.js` — renders every language × rendering from the strings. Run
  `node tools/build.js` (everything), `node tools/build.js fr` (one language, all
  renderings), `node tools/build.js eink` (one rendering, all languages), or
  `node tools/build.js fr eink` (both); add `--clean` to remove the generated
  language and `lite/`/`eink/` dirs first. It also writes `sitemap.xml`. The
  generated pages are static (no runtime JS); editing shared content means editing
  `tools/strings/en.js` and re-running the build.
- `tools/check-site.js` — reads the 48 built pages back and complains: dead
  internal links and `#anchors`, missing assets, raw `&`, duplicate ids, `<img>`
  without `alt`, `<html lang>`/`dir` against the directory it sits in, the full
  `hreflang` set + `x-default` (each pointing at a page that exists), the
  canonical URL, unnamed `<nav>` landmarks, and sitemap ↔ disk agreement. Run
  `node tools/check-site.js` after a build; it exits non-zero on any finding and
  installs nothing.

The non-English strings are **unreviewed machine output**; a native pass is
recommended before any official use. To (re)translate a language, hand an agent
`tools/strings/en.json` + `tools/strings/TRANSLATE.md` and the target code.

## Verified publishing — tamper-evidence

Every language edition is signed with a key kept off the web server, recorded in
an append-only [RFC 6962](https://www.rfc-editor.org/rfc/rfc6962) transparency
log, and pinned to a public anchor. Readers can confirm — cryptographically —
that the issue they are reading is the exact one Daily Bread published, and that
the correction history is complete. It cannot make an article *true*; it proves
only that the words are the ones that were published.

- **[`/verify/`](verify/)** — a self-contained page that checks all sixteen
  editions live in the browser (WebCrypto, no dependencies), plus a small
  "Verified publishing ✓" link in every edition's footer that points to it.
- **`.well-known/newsproof/`** — the public proof material: `publisher-key.json`,
  `log-key.json`, `leaves.jsonl` (the full log), `sth.json`, `anchors.jsonl`,
  `consistency.json`, `manifest.json`, and `proofs/<lang>.proof.json` per edition.
- **[`verify/verify_standalone.py`](verify/verify_standalone.py)** — the real
  check: a one-file offline verifier (standard library only, no `pip`) run against
  a publisher fingerprint you obtained somewhere other than this site.

The toolchain lives in [`tools/newsproof/`](tools/newsproof/) and is pure Python
(Ed25519 is the RFC 8032 reference implementation — no packages to install). To
re-sign after editing the issue:

```sh
node tools/build.js
cd tools && python3 -m newsproof.dbproof sign
python3 -m newsproof.dbproof anchor --via git --ref "git tag in <org>/daily-bread"
```

The private signing keys stay in `tools/newsproof/store/` (git-ignored) and must
be moved offline for a real deployment. Read
[`tools/newsproof/THREAT-MODEL.md`](tools/newsproof/THREAT-MODEL.md) before
trusting any of it: the in-browser badge is convenience against third parties and
accidents; the offline verifier is what holds against the publisher.

## Daily Bread Studio — edit & configure the magazine

`studio.html` is a bespoke, self-contained editor for building and re-skinning
the whole issue. No backend, no build server: it runs entirely in the browser.

It lives on `main` and is served at `/studio` by the same Worker as the
magazine. The studio lets anyone rewrite the edition in their own browser and
nothing else: publishing is a commit, so the page is safe to expose, and
[`CLOUDFLARE.md`](CLOUDFLARE.md) shows how to put it behind a login anyway.
Locally, open `studio.html` from `file://`; autosave, import/export and Publish
all work there.

**Two ways to edit.** The left pane has a **Design** tab and an **All fields** tab.

- **Design** — click anything on the page and it opens in the panel. A contents
  line brings its page number, title, kicker *and* chip colour, none of which the
  page itself gives you a handle for. Double-click a line of text to type straight
  onto the page. Drag a row — a TOC line, a badge, a calendar event — to a new
  position, with a drop line showing where it lands. Drop an image file on a
  picture to replace it. A selected row also gets Up / Down / Duplicate / Add
  below / Delete.
- **All fields** — the section-by-section accordion below, every field in the
  schema, with a `⠿` grip on each list row for dragging.

Design mode works out which element on the page came from which model field on
its own. It renders a second, invisible copy of the model with a marker appended
to every text value, notes which element each marker landed in, and replays that
address against the live preview; tag names are checked on the way and a node is
dropped rather than guessed at when the two disagree. So `db.js` gains no editing
hooks and none of this reaches the published `index.html`.

`node db-render/test-studio-design.mjs` asserts that last point along with the
click, type, drag and drop behaviour, in a real browser. It needs playwright in
`db-render/node_modules` (gitignored, as for the other scripts there) and is not
wired into CI.

**Arrange** (in the preview bar) is still there for free positioning, and takes
over from Design while it is on.

**What you can edit** — every section is a form: masthead & issue metadata, the
cover (upload an image or point at a path), the editor's letter, contents/TOC,
the collapse ledger, young-voices reports, the waitlist stats, the interview
band, calendar events and screenings, the mutual-aid directory, submissions, the
Riposte disclosure, and the back cover. List sections (TOC rows, events, ledger,
reports, …) let you **add, delete, and reorder** rows inline.

**What you can configure** — theme colours (ink / bone / panel / pink / teal /
orange / muted), the display / body / script fonts, and the page width. Four
theme presets ship in the toolbar (Kelowna's Collapse, The Thaw, Night Shift,
Orchard Bust); pick one or hand-tune every swatch. A live preview on the right
shows exactly what will publish, at full / tablet / phone widths.

**How it saves & publishes**

- **Autosave** — every change is written to your browser (`localStorage`), so
  the studio reopens where you left off.
- **Export / Import JSON** — download the whole issue as a portable
  `daily-bread-№1.json` you can commit, back up, or move between machines; import
  it to pick up where you left off.
- **Publish → `index.html`** — downloads a complete, self-contained
  `index.html`. Drop it in the repo root and commit; Cloudflare deploys the new
  edition on push. (If you embedded a cover via upload, it travels inside the file as a
  data URL; if you referenced `assets/cover.jpg`, keep that file in `assets/`.)

### How it's wired

- **`db.js`** is the engine: one `DEFAULT_MODEL` (the full text of №1), the theme
  presets, a form `SCHEMA` that the studio builds its UI from, and
  `DB.render(model)` — a pure function that turns the model into the finished,
  static magazine HTML (no runtime JS in the output). The studio's live preview
  and its "Publish" button both call `render()`, so what you see is what ships.
- **`tools/build.js`** builds the published pages from `content/<edition>.js`
  and `tools/strings/`, all sixteen languages and three variants, on the command
  line: `node tools/build.js`. CI requires the committed pages to match.
- **`index.html`** is the published English edition; `db.js`'s default model
  reproduces it, so the studio's Publish button and the build agree.
- **`db-render/render-studio-pdf.js`** renders the print magazine PDF from that
  same `DB.render(model)` output — the document in the studio's preview — so the
  studio view and the printer's file are one thing. Page size, bleed, safe area
  and crop marks all come from the model's **Print & bleed** panel; nothing in the
  renderer hardcodes a paper size, and it refuses to write a PDF whose sheets do
  not match the size that document's own `@page` rule declares.

  ```bash
  cd db-render && npm install playwright@1.61.0 --no-save
  SOURCE_DATE_EPOCH=$(git log -1 --pretty=%ct) \
    node render-studio-pdf.js "out/Daily Bread №1 — print.pdf"
  ```

  It resolves the model in this order: `--model <file>`, `$MAGAZINE_MODEL`,
  `magazine.model.json` in the repo root, then `DB.DEFAULT_MODEL`. Alongside the
  PDF it writes `out/magazine-render.json` with the model's fingerprint. This is
  the studio document on paper, a proof of the web edition; it is not what the
  printer gets.

  **The studio's "Magazine PDF" button typesets the edition in view as the TeX
  press booklet**: the model is laid over `content/<edition>.tex`
  (`tools/latex/dblatex/overlay.py` — theme, cover, letter, contents, voices,
  interview, waitlist, lab, listings, colophon; pages the studio has no field for
  stay as the `.tex` has them), typeset by lualatex into A5 pages and imposed two
  to an A4-landscape side in saddle-stitch order. The edition maps to its `.tex`
  by issue number (№1 → `issue-01`). The typesetting runs on `press.hq`
  (`tools/press-server.py`, LXC 111), about ten seconds. Off the estate the
  button falls back to `press/<edition>/booklet.pdf`, the CI typesetting of the
  plain `.tex`, and says so. `python3 tools/db-latex.py press --model <json>` is
  the same path from the command line; see `tools/latex/README.md`.

  The render is reproducible: fonts are served from `db-render/vendor/`, and the
  script rewrites the PDF's `/CreationDate` and `/ModDate` from `SOURCE_DATE_EPOCH`
  (Chromium stamps wall-clock time and ignores that variable itself, which is the
  only reason two runs of an identical document ever differed). It also reads the
  faces back out of the finished PDF and reports any that arrived by *system*
  fallback; `STRICT_FONTS=1` turns that into a failure. The magazine currently
  passes under `STRICT_FONTS=1` — the only faces in the file are the four the
  document declares.

  The older `render-print-pdf.js` and the `*.dc.html` kit beside it built a
  separate, hand-laid-out 24-page magazine that no studio edit could reach. They are
  kept for reference only. `db-render/out/` is not tracked.

- **`assets/fonts/db-symbols.woff2`** is a 9-glyph subset of DejaVu Sans (rebuild:
  `python3 tools/make-symbol-font.py`) carrying `→ ⌘ ▸ ◦ ☐ ♥ ✂ ✕ ✦`, the marks none
  of the three Google families provide. `db.js` names it second in every font stack,
  bounded by `unicode-range` so it can never step in front of a family that owns the
  character. Without it those glyphs came from whatever the rendering machine had,
  which is what kept the PDF from being reproducible across machines. Its licence
  (Bitstream Vera / Arev, notice required) is in `assets/fonts/LICENSE-DejaVu.txt`
  and must travel with the font.

Editing model: plain-text fields accept `<a>`, `<b>`, `<i>`, and `<br>` for
links and emphasis; everything else is escaped, so copy is safe to paste.
Newlines in masthead/headline fields become line breaks.

### Private online access

The deploy is a Cloudflare Worker, so a real login can sit in front of `/studio`:
Cloudflare Access, a policy of your own e-mail addresses, nothing in the repo.
[`CLOUDFLARE.md`](CLOUDFLARE.md) is the click-by-click.

---

## Source — the issue is one LaTeX file

`content/issue-01.tex` is the issue; `content/issue-01.js` is generated from
it and is what the web build reads. `python3 tools/db-latex.py build` produces
the site and both press PDFs (48 x A5, 24 x A4 landscape) from that one file;
`check` proves the round-trip and runs in CI on every pull request. See
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
