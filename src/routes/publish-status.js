import { TIKTOK, getAccessToken, tiktokPost, json } from '../../lib/tiktok.js';
import { currentOpenId } from '../../lib/session.js';

export async function handle({ request, env }) {
  const openId = await currentOpenId(request, env);
  if (!openId) return json({ error: 'not_authorized' }, 401);

  const publishId = new URL(request.url).searchParams.get('publish_id');
  if (!publishId) return json({ error: 'publish_id is required' }, 400);

  const accessToken = await getAccessToken(env, openId);
  const r = await tiktokPost(TIKTOK.STATUS, accessToken, { publish_id: publishId });
  return json(r);
}
