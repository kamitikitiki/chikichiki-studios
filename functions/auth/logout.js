import { cookie } from '../../lib/session.js';

export function onRequestGet() {
  return new Response(null, {
    status: 302,
    headers: { Location: '/', 'Set-Cookie': cookie('cs_session', '', 0), 'Cache-Control': 'no-store' },
  });
}
