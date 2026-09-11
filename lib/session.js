// Signed-cookie session. The cookie carries only the TikTok open_id;
// tokens never leave the server.

const enc = new TextEncoder();

async function key(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sign(value, secret) {
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(value));
  return `${value}.${b64url(sig)}`;
}

export async function unsign(signed, secret) {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const expected = await sign(value, secret);
  // constant-time-ish compare
  if (expected.length !== signed.length) return null;
  let diff = 0;
  for (let n = 0; n < expected.length; n++) diff |= expected.charCodeAt(n) ^ signed.charCodeAt(n);
  return diff === 0 ? value : null;
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) {
      try { return decodeURIComponent(v.join('=')); } catch (_) { return null; }
    }
  }
  return null;
}

export function cookie(name, value, maxAge) {
  const bits = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  if (maxAge !== undefined) bits.push(`Max-Age=${maxAge}`);
  return bits.join('; ');
}

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Build the signed session value: "<open_id>|<issued_at_ms>". */
export async function sessionValue(openId, secret) {
  return sign(`${openId}|${Date.now()}`, secret);
}

export async function currentOpenId(request, env) {
  const v = await unsign(readCookie(request, 'cs_session'), env.SESSION_SECRET);
  if (!v) return null;
  const i = v.lastIndexOf('|');
  if (i < 1) return null;
  const openId = v.slice(0, i);
  const iat = Number(v.slice(i + 1));
  if (!Number.isFinite(iat) || Date.now() - iat > SESSION_MAX_AGE_MS) return null;
  return openId;
}

/** Shared-secret auth for the GitHub Actions endpoints. */
export function isActions(request, env) {
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const want = env.ACTIONS_SHARED_SECRET || '';
  if (!want || token.length !== want.length) return false;
  let diff = 0;
  for (let n = 0; n < want.length; n++) diff |= want.charCodeAt(n) ^ token.charCodeAt(n);
  return diff === 0;
}
