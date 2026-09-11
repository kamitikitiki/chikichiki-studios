import { TIKTOK, SCOPES } from '../../lib/tiktok.js';
import { cookie } from '../../lib/session.js';

function misconfigured(missing) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Not configured</title>
     <body style="font-family:system-ui;background:#121418;color:#e8eaed;padding:40px;line-height:1.7">
     <h1 style="font-size:20px">Sign-in is not configured yet</h1>
     <p>The server is missing: <code>${missing.join('</code>, <code>')}</code></p>
     <p style="color:#9aa3af;font-size:14px">Set these as secrets and deploy a new version.
        <a style="color:#7aa2ff" href="/api/health">/api/health</a> shows the current state.</p>
     <p><a style="color:#7aa2ff" href="/">Back</a></p>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } }
  );
}

export function handle({ request, env }) {
  // Without these we would redirect to TikTok with client_key=undefined, which comes
  // back as an opaque "unauthorized_client" error. Fail here instead, and say why.
  const missing = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'SESSION_SECRET'].filter((k) => !env[k]);
  if (missing.length) return misconfigured(missing);

  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/auth/callback`;

  const authorize = new URL(TIKTOK.AUTHORIZE);
  authorize.searchParams.set('client_key', env.TIKTOK_CLIENT_KEY);
  authorize.searchParams.set('scope', SCOPES);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': cookie('cs_state', state, 600),
      'Cache-Control': 'no-store',
    },
  });
}
