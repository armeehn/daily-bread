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
the whole issue. No backend, no build server: it runs entirely in the browser.

**It is deliberately NOT deployed to the public site** — the studio lets anyone
rewrite the magazine, so it must not be world-readable on a static host (there is
no server to check a password). It lives on the **`studio` branch** instead:

```
git switch studio        # or: git worktree add ../db-studio studio
# then open studio.html in a browser (double-click, or a local server)
```

Everything works from `file://`: autosave, import/export, and Publish. To put it
online behind a login, see **Private online access** below.

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

### Private online access

GitHub Pages has no server, so it can't check a password — a client-side gate is
theatre (the source ships to the browser). To use the studio online you need a
real auth layer in front of it. Two routes:

**A · Cloudflare Access on `ourdailybre.ad` (one domain, needs migration).**
1. Add `ourdailybre.ad` to a Cloudflare account; change the nameservers at your
   registrar to the pair Cloudflare gives you (the domain is currently pointed
   straight at GitHub Pages, so this is a real migration; allow time to propagate).
2. In Cloudflare DNS, recreate the GitHub Pages records **proxied** (orange
   cloud). Set SSL/TLS mode to **Full** to avoid a redirect loop with Pages.
3. Redeploy the studio under a single folder — `studio/index.html` + `studio/db.js`
   (off the `studio` branch) — so one policy covers it.
4. Zero Trust → Access → Add a **self-hosted application** for
   `ourdailybre.ad/studio/*`; policy: Allow → emails = you. Done: the magazine at
   the root stays public; `/studio/*` prompts for a login.

**B · Cloudflare Pages + Access (no nameserver change, separate URL).**
Deploy just the studio to a Cloudflare Pages project (free) from the `studio`
branch; you get `daily-bread-studio.pages.dev`. Protect that project with
Cloudflare Access (Pages integrates with Zero Trust natively). The apex domain
stays on GitHub Pages untouched; the studio lives at a gated `*.pages.dev` URL.
Fastest path if you don't want to move `ourdailybre.ad`.
