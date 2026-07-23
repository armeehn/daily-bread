# Hosting the studio privately on Cloudflare Workers + Access

Goal: the **editor** lives at a private Workers URL that asks for a login. The
whole deploy is gated by Cloudflare Access, so every file (studio + engine) is
protected before it loads.

The site is served as **static assets** straight from the repo root (an
"assets-only" Worker; there is no server script). `studio.html` loads `db.js` and
`assets/` by relative path, and `_redirects` sends the project root (`/`) to
`/studio.html`, so the landing page is the editor. Config lives in
[`wrangler.jsonc`](./wrangler.jsonc); `.assetsignore` keeps repo-only files
(docs, `tools/`) out of the upload.

Everything below is done in the Cloudflare dashboard with your own account — no
secrets live in this repo.

## 1. Create the Worker (git integration)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Workers** →
   **Connect to Git** → authorize GitHub → pick **`armeehn/daily-bread`**.
2. Set up the build:
   - **Production branch:** `main`
   - **Build command:** *(leave empty — the site is prebuilt static assets)*
   - **Deploy command:** `npx wrangler deploy`
3. **Save and Deploy.** You get a `*.workers.dev` URL (open it → it redirects to
   the studio). It is **public until step 2 gates it**, so do step 2 right away.

> CLI alternative: `npx wrangler deploy` from a checkout of `main` (uses
> `wrangler.jsonc`). The dashboard git flow is simpler and auto-deploys on push.

## 2. Put it behind a login (Cloudflare Access)

1. Dashboard → **Zero Trust** (start the free plan if prompted; pick a team name,
   e.g. `dailybread` → your team domain is `dailybread.cloudflareaccess.com`).
2. **Access → Applications → Add an application → Self-hosted.**
   - **Application name:** Daily Bread Studio
   - **Session duration:** your choice (e.g. 24h)
   - **Application domain:** select the Worker's `daily-bread-studio.workers.dev`
     hostname (Cloudflare lists it automatically). Leave the path blank to
     protect the whole Worker.
3. **Add a policy:**
   - **Policy name:** Editors
   - **Action:** Allow
   - **Include → Emails →** your email address(es). (Or **Emails ending in** a
     domain, or a One-time PIN / Google / GitHub identity provider.)
4. **Save.** Now visiting the Worker URL shows a Cloudflare login; only allowed
   identities get in. Everyone else is blocked before any file loads.

## 3. Publishing changes to the magazine

Editing happens in the studio; **Publish → index.html** downloads a complete,
self-contained page. Commit that file to the **`main`** branch root; the next
deploy serves the new edition. (The old top-level `build.js` was removed when the
studio moved to `main`; regenerate `index.html` from `db.js` via the studio's
Publish button, or use the multilingual `tools/build.js`.)

## Keeping the studio deployed

Any push to `main` triggers a new Workers deploy automatically (git integration).
Future engine/studio changes just land on `main` and redeploy.
