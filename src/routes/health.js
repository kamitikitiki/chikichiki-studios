import { json } from '../../lib/tiktok.js';

// Reports whether configuration is present, never what it is. Safe to call publicly:
// booleans only, no values, no partial values.
export async function handle({ env }) {
  let kv = 'missing';
  if (env.TOKENS) {
    try {
      await env.TOKENS.get('__healthcheck__');
      kv = 'ok';
    } catch (e) {
      kv = 'error';
    }
  }
  return json({
    client_key: Boolean(env.TIKTOK_CLIENT_KEY),
    client_secret: Boolean(env.TIKTOK_CLIENT_SECRET),
    session_secret: Boolean(env.SESSION_SECRET),
    actions_secret: Boolean(env.ACTIONS_SHARED_SECRET),
    kv,
  });
}
