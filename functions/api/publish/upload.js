import { json } from '../../../lib/tiktok.js';
import { currentOpenId } from '../../../lib/session.js';

const ALLOWED = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

// Receives the browser's file and forwards it to TikTok's signed upload URL.
// Proxying (rather than PUTting from the browser) avoids depending on CORS
// headers we do not control. The body is buffered so Content-Length is exact:
// a chunked/streamed PUT does not satisfy the Content-Range contract.
// Files are single-chunk (<64MB) by design, well inside Worker memory limits.
export async function onRequestPut({ request, env }) {
  const openId = await currentOpenId(request, env);
  if (!openId) return json({ error: 'not_authorized' }, 401);

  const url = new URL(request.url);
  const publishId = url.searchParams.get('publish_id');
  if (!publishId) return json({ error: 'publish_id is required' }, 400);

  const raw = await env.TOKENS.get(`upload:${publishId}`);
  if (!raw) return json({ error: 'upload session expired' }, 410);
  const sess = JSON.parse(raw);
  if (sess.open_id !== openId) return json({ error: 'not_authorized' }, 403);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength !== sess.size) {
    return json({ error: 'size_mismatch', expected: sess.size, received: bytes.byteLength }, 400);
  }

  const ct = request.headers.get('Content-Type') || '';
  const contentType = ALLOWED.has(ct) ? ct : 'video/mp4';
  const size = sess.size;

  const res = await fetch(sess.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: bytes,
  });

  if (!res.ok) {
    return json({ error: 'upload_failed', status: res.status, detail: await res.text() }, 502);
  }
  // one-shot: the signed URL must not be reusable from our side
  await env.TOKENS.delete(`upload:${publishId}`);
  return json({ ok: true });
}
