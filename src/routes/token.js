import { getAccessToken, readTokens, json } from '../../lib/tiktok.js';
import { isActions } from '../../lib/session.js';

// Used by the creator's own scheduled-publishing job (GitHub Actions), not by the
// browser UI. The creator queues a video they have approved; the job publishes it at
// the scheduled time through this same audited client. Returns a short-lived access
// token so the job never holds the refresh token -- Cloudflare KV stays the single
// owner of it (design decision 7).
export async function handle({ request, env }) {
  if (!isActions(request, env)) return json({ error: 'forbidden' }, 403);

  let openId = null;
  try {
    const body = await request.json();
    openId = body && body.open_id;
  } catch (_) {
    /* body is optional */
  }

  if (!openId) {
    const raw = await env.TOKENS.get('accounts');
    const idx = raw ? JSON.parse(raw) : [];
    if (idx.length === 1) openId = idx[0].open_id;
    else return json({ error: 'open_id is required', accounts: idx.length }, 400);
  }

  try {
    const accessToken = await getAccessToken(env, openId);
    const rec = await readTokens(env, openId);
    return json({
      access_token: accessToken,
      open_id: openId,
      // so the daily job can warn before the refresh token dies (FR-13)
      refresh_expires_at: rec.refresh_expires_at,
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
