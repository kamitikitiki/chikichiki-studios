import { TIKTOK, getAccessToken, tiktokPost, json } from '../../lib/tiktok.js';
import { currentOpenId } from '../../lib/session.js';

export async function handle({ request, env }) {
  const openId = await currentOpenId(request, env);
  if (!openId) return json({ error: 'not_authorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const { post_info, video_size } = body || {};

  if (!post_info || !post_info.privacy_level) {
    return json({ error: 'privacy_level is required' }, 400);
  }
  if (!video_size || video_size < 1) {
    return json({ error: 'video_size is required' }, 400);
  }
  if (video_size > 64 * 1048576) {
    return json({ error: 'video is larger than the 64 MB single-chunk limit' }, 400);
  }

  const accessToken = await getAccessToken(env, openId);

  // Docs: chunks are 5MB-64MB, and a file under 5MB must be sent whole. A single
  // chunk therefore covers everything up to 64MB, which is enforced above, so we
  // never split.
  const payload = {
    post_info: {
      title: post_info.title || '',
      privacy_level: post_info.privacy_level,
      disable_comment: !!post_info.disable_comment,
      disable_duet: !!post_info.disable_duet,
      disable_stitch: !!post_info.disable_stitch,
      brand_content_toggle: !!post_info.brand_content_toggle,
      brand_organic_toggle: !!post_info.brand_organic_toggle,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size,
      chunk_size: video_size,
      total_chunk_count: 1,
    },
  };

  const r = await tiktokPost(TIKTOK.VIDEO_INIT, accessToken, payload);
  if (!r.data || !r.data.publish_id || !r.data.upload_url) {
    return json({ error: r.error || 'init_failed', raw: r }, 400);
  }

  // Keep upload_url server-side; the browser only ever sees publish_id.
  await env.TOKENS.put(
    `upload:${r.data.publish_id}`,
    JSON.stringify({ upload_url: r.data.upload_url, open_id: openId, size: video_size }),
    { expirationTtl: 3600 } // the upload URL itself is valid for one hour
  );

  return json({ publish_id: r.data.publish_id });
}
