import { TIKTOK, saveTokens } from '../../lib/tiktok.js';
import { cookie, readCookie, sessionValue } from '../../lib/session.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fail(reason) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Sign-in failed</title>
     <body style="font-family:system-ui;background:#121418;color:#e8eaed;padding:40px">
     <h1>Sign-in failed</h1><p>${esc(reason)}</p><p><a style="color:#7aa2ff" href="/">Back</a></p>`,
    { status: 400, headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
  );
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = readCookie(request, 'cs_state');

  if (url.searchParams.get('error')) {
    return fail(`TikTok returned: ${url.searchParams.get('error_description') || url.searchParams.get('error')}`);
  }
  if (!code) return fail('No authorization code was returned.');
  if (!state || !expected || state !== expected) return fail('State mismatch. Please start again.');

  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: `${url.origin}/auth/callback`,
  });

  const res = await fetch(TIKTOK.TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const t = await res.json();
  if (!t.access_token || !t.open_id) {
    return fail('Token exchange failed: ' + JSON.stringify(t));
  }

  await saveTokens(env, t.open_id, t);
  const session = await sessionValue(t.open_id, env.SESSION_SECRET);

  const headers = new Headers({ Location: '/', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie('cs_session', session, 60 * 60 * 24 * 30));
  headers.append('Set-Cookie', cookie('cs_state', '', 0));
  return new Response(null, { status: 302, headers });
}
