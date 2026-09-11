# Chikichiki Studios

A small publishing tool that posts a creator's own generated videos to their own TikTok
account, using the TikTok Content Posting API (Direct Post).

Deployed on Cloudflare Pages. The static pages and the server-side code live on the same
domain on purpose: the TikTok audit rejects apps whose app name, website URL and redirect
URI do not point at the same brand.

## Layout

```
public/          static pages
  index.html       posting UI  (the screen the audit reviews)
  privacy.html     privacy policy   -- must stay reachable
  terms.html       terms of service -- must stay reachable
  page.css
functions/       Cloudflare Pages Functions (server side)
  auth/start.js          -> GET  /auth/start        begin OAuth
  auth/callback.js       -> GET  /auth/callback     exchange code, store tokens
  auth/logout.js         -> GET  /auth/logout       clear the session cookie
  api/creator-info.js    -> GET  /api/creator-info  proxy creator_info/query
  api/publish/init.js    -> POST /api/publish/init  proxy video/init
  api/publish/upload.js  -> PUT  /api/publish/upload stream file to TikTok
  api/publish/status.js  -> GET  /api/publish/status proxy status/fetch
  api/token.js           -> POST /api/token         GitHub Actions only
  api/accounts.js        -> GET  /api/accounts      GitHub Actions only (setup helper)
lib/             shared code, not routed
```

## Cloudflare Pages build settings

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `public` |

`functions/` is picked up automatically because it sits at the repository root.

## Configuration

Cloudflare Pages → Settings → Variables and Secrets:

| Name | Type | Value |
| --- | --- | --- |
| `TIKTOK_CLIENT_KEY` | Secret | from the TikTok app |
| `TIKTOK_CLIENT_SECRET` | Secret | from the TikTok app — **never commit this** |
| `SESSION_SECRET` | Secret | any long random string |
| `ACTIONS_SHARED_SECRET` | Secret | any long random string, shared with GitHub Actions |

Cloudflare Pages → Settings → Bindings → KV namespace:

| Variable name | Namespace |
| --- | --- |
| `TOKENS` | create one, any name |

TikTok app settings:

- Website URL: `https://<your-project>.pages.dev`
- Redirect URI: `https://<your-project>.pages.dev/auth/callback`
- Terms of Service URL: `https://<your-project>.pages.dev/terms.html`
- Privacy Policy URL: `https://<your-project>.pages.dev/privacy.html`
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
- The OAuth redirect URI is derived from the request origin. Only the production URL
  (`https://<project>.pages.dev/auth/callback`) is registered with TikTok, so sign-in will not
  work on Cloudflare preview deployments (`<hash>.<project>.pages.dev`). That is expected.
