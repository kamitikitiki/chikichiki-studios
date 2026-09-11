import { TIKTOK, SCOPES } from '../../lib/tiktok.js';
import { cookie } from '../../lib/session.js';

export function onRequestGet({ request, env }) {
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
