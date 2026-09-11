import { cookie } from '../../lib/session.js';

export function handle() {
  return new Response(null, {
    status: 302,
    headers: { Location: '/', 'Set-Cookie': cookie('cs_session', '', 0), 'Cache-Control': 'no-store' },
  });
}
