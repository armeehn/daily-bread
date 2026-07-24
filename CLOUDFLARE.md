# Hosting the studio privately on Cloudflare Pages + Access

Goal: the **editor** lives at a private `*.pages.dev` URL that asks for a login,
while the **magazine** stays public on `ourdailybre.ad` (GitHub Pages, untouched).

`main` is the deploy source. The root (`/`) serves the public magazine
(`index.html`); the studio editor is served at `/studio` (Cloudflare Pages maps
`studio.html` to the clean `/studio` URL, and `_redirects` makes it explicit).
`studio.html` loads `db.js` and `assets/` by relative path, so it works from
either URL. Gate the studio with Access on the `/studio` path (step 2).

Everything below is done in the Cloudflare dashboard with your own account — no
secrets live in this repo.

## 1. Create the Pages project (git integration)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → authorize GitHub → pick **`armeehn/daily-bread`**.
2. Set up the build:
   - **Production branch:** `studio`
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
3. **Save and Deploy.** You get a URL like `https://daily-bread-studio.pages.dev`
   (open it → it redirects to the studio). It is **public until step 2 gates it**,
   so do step 2 right away.

> CLI alternative: `npx wrangler pages deploy .` from this branch (uses
> `wrangler.toml`). The dashboard git flow is simpler and auto-deploys on push.

## 2. Put it behind a login (Cloudflare Access)

1. Dashboard → **Zero Trust** (start the free plan if prompted; pick a team name,
   e.g. `dailybread` → your team domain is `dailybread.cloudflareaccess.com`).
2. **Access → Applications → Add an application → Self-hosted.**
   - **Application name:** Daily Bread Studio
   - **Session duration:** your choice (e.g. 24h)
   - **Application domain:** select the Pages project
     `daily-bread-studio.pages.dev` (Cloudflare lists it automatically). Leave the
     path blank to protect the whole project.
3. **Add a policy:**
   - **Policy name:** Editors
   - **Action:** Allow
   - **Include → Emails →** your email address(es). (Or **Emails ending in** a
     domain, or a One-time PIN / Google / GitHub identity provider.)
4. **Save.** Now visiting the `.pages.dev` URL shows a Cloudflare login; only
   allowed identities get in. Everyone else is blocked before any file loads.

Tip: under the Pages project → **Settings → General**, you can also enable
"**Access Policy** for preview deployments" so preview URLs are gated too.

## 3. Publishing changes to the magazine

Editing happens in the studio; **Publish → index.html** downloads a complete,
self-contained page. Commit that file to the **`main`** branch root and GitHub
Pages serves the new public edition at `ourdailybre.ad`. The studio itself does
not touch the public site.

## Keeping the studio updated

Any push to this `studio` branch triggers a new Pages deploy automatically (git
integration). To pull in future engine/studio changes, merge or cherry-pick them
onto `studio` and push.
