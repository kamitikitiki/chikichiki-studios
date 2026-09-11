// TikTok API endpoints and shared helpers.
// Docs verified 2026-09-11.

export const TIKTOK = {
  AUTHORIZE: 'https://www.tiktok.com/v2/auth/authorize/',
  TOKEN: 'https://open.tiktokapis.com/v2/oauth/token/',
  CREATOR_INFO: 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
  VIDEO_INIT: 'https://open.tiktokapis.com/v2/post/publish/video/init/',
  STATUS: 'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
};

// Only the scopes the demo actually exercises.
// "Requesting more than the demo shows" is a documented audit rejection reason.
export const SCOPES = 'user.info.basic,video.publish';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
  });
}

export function tokenKey(openId) {
  return `tokens:${openId}`;
}

/**
 * Persist a token response. Always call this BEFORE using the new access token:
 * if the KV write fails we must not proceed on a refresh_token we cannot store,
 * because TikTok rotates refresh tokens and the old one may already be dead.
 */
export async function saveTokens(env, openId, t, prev = null) {
  const rec = {
    open_id: openId,
    access_token: t.access_token,
    // expires_in is seconds; keep a 60s safety margin
    expires_at: Date.now() + (Number(t.expires_in || 86400) - 60) * 1000,
    // TikTok normally returns a refresh_token on every refresh; if it ever omits one,
    // keep the previous value rather than storing undefined and bricking the account.
    refresh_token: t.refresh_token || (prev && prev.refresh_token),
    refresh_expires_at: t.refresh_expires_in
      ? Date.now() + (Number(t.refresh_expires_in) - 60) * 1000
      : (prev && prev.refresh_expires_at) || Date.now() + (31536000 - 60) * 1000,
    scope: t.scope || '',
    updated_at: Date.now(),
  };
  await env.TOKENS.put(tokenKey(openId), JSON.stringify(rec));

  const raw = await env.TOKENS.get('accounts');
  const idx = raw ? JSON.parse(raw) : [];
  if (!idx.some((a) => a.open_id === openId)) {
    idx.push({ open_id: openId, added_at: Date.now() });
    await env.TOKENS.put('accounts', JSON.stringify(idx));
  }
  return rec;
}

export async function readTokens(env, openId) {
  const raw = await env.TOKENS.get(tokenKey(openId));
  return raw ? JSON.parse(raw) : null;
}

/** Returns a valid access token, refreshing (and persisting rotation) when needed. */
export async function getAccessToken(env, openId) {
  const rec = await readTokens(env, openId);
  if (!rec) throw new Error('not_authorized');
  if (rec.expires_at > Date.now()) return rec.access_token;

  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: rec.refresh_token,
  });
  const res = await fetch(TIKTOK.TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const t = await res.json();
  if (!t.access_token) {
    throw new Error('refresh_failed: ' + JSON.stringify(t));
  }
  // The returned refresh_token may differ from the one we sent. Store it first.
  const saved = await saveTokens(env, openId, t, rec);
  return saved.access_token;
}

export async function tiktokPost(url, accessToken, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(payload || {}),
  });
  return res.json();
}
