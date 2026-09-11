import { json, readTokens } from '../../lib/tiktok.js';
import { isActions } from '../../lib/session.js';

// Setup helper: lists the open_ids that have completed OAuth, so the value can be
// copied into GitHub Secrets. Shared-secret protected; not part of the user UI.
export async function onRequestGet({ request, env }) {
  if (!isActions(request, env)) return json({ error: 'forbidden' }, 403);

  const raw = await env.TOKENS.get('accounts');
  const idx = raw ? JSON.parse(raw) : [];
  const out = [];
  for (const a of idx) {
    const rec = await readTokens(env, a.open_id);
    out.push({
      open_id: a.open_id,
      added_at: a.added_at,
      updated_at: rec ? rec.updated_at : null,
      refresh_expires_at: rec ? rec.refresh_expires_at : null,
    });
  }
  return json({ accounts: out });
}
