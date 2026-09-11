import { TIKTOK, getAccessToken, tiktokPost, json } from '../../lib/tiktok.js';
import { currentOpenId } from '../../lib/session.js';

// Audit requirement (Point 1): this must be called on every page load and on every
// account change. We never cache the response -- reusing a cached creator_info is a
// documented rejection reason.
export async function onRequestGet({ request, env }) {
  const openId = await currentOpenId(request, env);
  if (!openId) return json({ authorized: false }, 200);

  let accessToken;
  try {
    accessToken = await getAccessToken(env, openId);
  } catch (e) {
    return json({ authorized: false, error: String(e.message || e) }, 200);
  }

  const r = await tiktokPost(TIKTOK.CREATOR_INFO, accessToken, {});
  if (r.error && r.error.code !== 'ok') {
    return json({ authorized: true, error: r.error }, 200);
  }
  return json({ authorized: true, creator: r.data }, 200);
}
