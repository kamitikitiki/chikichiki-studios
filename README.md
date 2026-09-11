# Chikichiki Studios

A small publishing tool that posts a creator's own generated videos to their own TikTok
account, using the TikTok Content Posting API (Direct Post).

Deployed as a Cloudflare Worker with static assets. The static pages and the server-side
code live on the same domain on purpose: the TikTok audit rejects apps whose app name,
website URL and redirect URI do not point at the same brand.

## Layout

```
public/          static assets -- served directly, the Worker never sees these requests
  index.html       posting UI  (the screen the audit reviews)
  privacy.html     privacy policy   -- must stay reachable
  terms.html       terms of service -- must stay reachable
  page.css
src/index.js     Worker entry point; routes everything that is not a static asset
src/routes/      one handler per route
  auth-start.js       GET  /auth/start          begin OAuth
  auth-callback.js    GET  /auth/callback       exchange code, store tokens
  auth-logout.js      GET  /auth/logout         clear the session cookie
  creator-info.js     GET  /api/creator-info    proxy creator_info/query
  publish-init.js     POST /api/publish/init    proxy video/init
  publish-upload.js   PUT  /api/publish/upload  forward the file to TikTok
  publish-status.js   GET  /api/publish/status  proxy status/fetch
  token.js            POST /api/token           scheduled job only
  accounts.js         GET  /api/accounts        scheduled job only (setup helper)
lib/             shared code
wrangler.jsonc   Worker config: assets directory + KV binding
```

## Deploy settings (Cloudflare dashboard, Git import)

| Setting | Value |
| --- | --- |
| Project name | `chikichiki-studios` |
| Build command | *(leave empty)* |
| Deploy command | `npx wrangler deploy` |

Everything else comes from `wrangler.jsonc`. Before the first deploy, create a KV
namespace in the dashboard and paste its id into `kv_namespaces[0].id`.

## Configuration

Cloudflare dashboard → the Worker → Settings → Variables and Secrets (add each as a **Secret**):

| Name | Type | Value |
| --- | --- | --- |
| `TIKTOK_CLIENT_KEY` | Secret | from the TikTok app |
| `TIKTOK_CLIENT_SECRET` | Secret | from the TikTok app — **never commit this** |
| `SESSION_SECRET` | Secret | any long random string |
| `ACTIONS_SHARED_SECRET` | Secret | any long random string, shared with GitHub Actions |

KV: the namespace is already declared in `wrangler.jsonc` (binding `TOKENS`). It is
declared in the config rather than the dashboard because `wrangler deploy` treats the
config file as the source of truth for bindings. Secrets are not affected -- those stay
in the dashboard.

TikTok app settings:

- Website URL: `https://chikichiki-studios.kamitikitiki.workers.dev`
- Redirect URI: `https://chikichiki-studios.kamitikitiki.workers.dev/auth/callback`
- Terms of Service URL: `https://chikichiki-studios.kamitikitiki.workers.dev/terms.html`
- Privacy Policy URL: `https://chikichiki-studios.kamitikitiki.workers.dev/privacy.html`
- Scopes: `user.info.basic`, `video.publish`

## Design notes

- The refresh token lives in Cloudflare KV and nowhere else. TikTok rotates refresh tokens,
  so a second copy would inevitably go stale. `POST /api/token` hands GitHub Actions a
  short-lived access token instead.
- `creator_info` is fetched on every page load and never cached. Reusing a cached response
  is a documented audit rejection reason.
- The privacy dropdown has no default value and is populated only from
  `privacy_level_options`. Both of these are documented rejection reasons.
- Uploads are proxied through `/api/publish/upload` rather than PUT directly from the
  browser, so the flow does not depend on CORS headers we do not control.
- Videos pass through memory during upload and are never stored.
- Requests that match a file in `public/` never reach the Worker, so the router in
  `src/index.js` only handles `/auth/*` and `/api/*`.
- The OAuth redirect URI is derived from the request origin. Only the production URL
  (`https://chikichiki-studios.kamitikitiki.workers.dev/auth/callback`) is registered with TikTok, so sign-in will not
  work on Cloudflare preview deployments (preview aliases). That is expected.
