# Daily Bread

A queer magazine for the Okanagan, baked quarterly in Kelowna, BC.
Free where you found it; pay what you can where you can't.

**Issue №1 — Kelowna's Collapse** (Summer 2026). Funded by Riposte Laboratories Inc.

`index.html` is a single-page, responsive web edition of №1, styled from the
Daily Bread print design: UnifrakturMaguntia blackletter masthead, IBM Plex Mono
spec-sheet chrome, checker/harlequin bands, and the pink/teal/orange accent
cascade over a bone/ink base. Assets live in `assets/`.

## Daily Bread Studio — edit & configure the magazine

`studio.html` is a bespoke, self-contained editor for building and re-skinning
the whole issue. No backend, no build server: it runs entirely in the browser
and fits GitHub Pages alongside the magazine. Open it at
[`/studio.html`](studio.html) (locally, just open the file).

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
  `index.html`. Drop it in the repo root and commit; GitHub Pages serves the new
  edition. (If you embedded a cover via upload, it travels inside the file as a
  data URL; if you referenced `assets/cover.jpg`, keep that file in `assets/`.)

### How it's wired

- **`db.js`** is the engine: one `DEFAULT_MODEL` (the full text of №1), the theme
  presets, a form `SCHEMA` that the studio builds its UI from, and
  `DB.render(model)` — a pure function that turns the model into the finished,
  static magazine HTML (no runtime JS in the output). The studio's live preview
  and its "Publish" button both call `render()`, so what you see is what ships.
- **`build.js`** regenerates `index.html` from `db.js`'s default model on the
  command line: `node build.js`. Handy for CI or a quick rebuild; produces the
  same output as the studio's Publish button.
- **`index.html`** is the published edition. It currently holds the hand-built
  №1; the studio's model reproduces it exactly, so you can adopt the
  studio-driven workflow whenever you like by clicking Publish.

Editing model: plain-text fields accept `<a>`, `<b>`, `<i>`, and `<br>` for
links and emphasis; everything else is escaped, so copy is safe to paste.
Newlines in masthead/headline fields become line breaks.
