# Forking this magazine

The machinery here (a static multilingual web edition, a browser studio, a
LaTeX press, tamper-evident publishing, a merch pipeline) is MIT and runs
for any magazine. The editions are not; you write your own. This is the
checklist from fork to your first issue.

## 1. Fork and clone

Fork on GitHub (or import into your own Gitea) and clone it. The build is
`node tools/build.js` with the Node standard library only; nothing to
install for the web edition.

## 2. Give it a name

Every name, domain, place, funder and mailbox the tree carries is listed in
[`magazine.env`](magazine.env), with the upstream value beside a one-line
description. Edit it, then:

```sh
python3 tools/rebrand.py --dry-run   # what would change
python3 tools/rebrand.py             # do it
node tools/build.js                  # regenerate the 48 pages from the renamed sources
```

The tool rewrites whole tokens only, longest first, and renames the files
that carry the slug (the systemd units). It records what it applied in
`.magazine.applied`, so you can change your mind and run it again.
`python3 tools/test_rebrand.py` proves the round trip on a scratch copy; CI
runs it on every push.

Rebuild after every rebrand and commit the result: CI requires the
committed pages to match `tools/build.js` byte for byte.

What the tool leaves alone, and where to go instead:

| Left as upstream | Where it lives |
|---|---|
| Type, colours, the checker bands | `tools/assets/style.css`, the theme presets in `db.js` |
| The funder's logo | `assets/riposte-logo.svg`, referenced from `tools/build.js` and `db.js`; swap or remove |
| `localStorage` keys, the `dailybread` LaTeX class name | harmless; rename by hand if you must |
| The published proofs under `.well-known/newsproof/` | they sign the upstream's pages under the upstream's key; see §4 |
| The pressed booklets under `press/` | typeset from `content/`; re-press yours (§5) |

## 3. Write your edition

`content/issue-01.tex` is the whole of №1: one LaTeX file with every page,
in order. Copy it, keep the page macros, replace the words. Then:

- `python3 tools/db-latex.py build` emits `content/<edition>.js`, the
  web-build input, and proves the `.tex` to `.js` round trip.
- `tools/strings/en.js` is the English copy of the web chrome; the other 15
  languages are `tools/strings/<code>.json`, machine-translated per
  [`tools/strings/TRANSLATE.md`](tools/strings/TRANSLATE.md). Drop
  languages by editing `LANGS` in `tools/build.js`.
- `tools/strings/from-issue.js` names the edition the web build reads;
  point it at yours.
- `shop/catalogue.json` is a Shopify export the build reads for the shop
  pane; leave it as is or export your own with `tools/merch/catalogue.py`.

## 4. Verified publishing (optional)

The badge on every page checks a signed proof of the page's bytes. Your
pages need your key: `cd tools && python3 -m newsproof.dbproof init`, keep
the private half offline, then `sign` after every build and commit the
`.well-known/newsproof/` it writes. The anchor line names your repository
and tag. [`tools/newsproof/README.md`](tools/newsproof/README.md) has the
full procedure; delete the badge from `tools/build.js` if you would rather
not run it.

## 5. The press (optional)

`press/<edition>/booklet.pdf` is the saddle-stitch print file, typeset by
`.gitea/workflows/press-booklet.yml` in a TeX Live container and required
to be byte-identical to what is committed. A fork's first press differs by
definition: run the workflow with `commit = true` once, or press locally with
`python3 tools/db-latex.py press`, and commit.

`tools/press-server.py` typesets the studio's edition on demand. It needs
TeX Live at the path in `tools/latex/dblatex/press.py` and the upstream's
`riposte-latex` package beside the checkout (the class falls back to a
shim without it). The systemd units and Caddy site in `tools/` are the
upstream's own deployment, kept as a worked example.

## 6. Publish

`wrangler.jsonc` serves the repository root as a Cloudflare Worker's static
assets; connect the repo in the dashboard and add your `SITE_DOMAIN`.
[`CLOUDFLARE.md`](CLOUDFLARE.md) covers the cache and bot-fight settings the
full edition needs. `.assetsignore` keeps the tooling and the legacy kit out
of the served site.

## 7. Continuous integration

- `.gitea/workflows/verify-editions.yml` rebuilds and checks the site, the
  round trips and, daily, the live origin from `magazine.env`. It runs on
  Gitea Actions; on GitHub, copy it to `.github/workflows/` and swap the
  artifact action.
- `.gitea/workflows/mirror-to-github.yml` pushes a Gitea repo to a GitHub
  twin. It is inert until the `MIRROR_REMOTE` repository variable and the
  `MIRROR_SSH_KEY` secret exist. Delete it if you only use GitHub.
- `.gitea/workflows/merch.yml` needs Shopify secrets; ignore it until you
  sell something.

## 8. Licence

Machinery MIT; editions, art and names reserved. See [`LICENSE`](LICENSE).
