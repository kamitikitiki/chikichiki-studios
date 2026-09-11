// Single Worker entry point.
//
// Cloudflare serves a matching file from public/ first; anything that is not a
// static asset lands here. So this router only ever sees /auth/* and /api/*
// (plus genuine 404s).

import { handle as authStart } from './routes/auth-start.js';
import { handle as authCallback } from './routes/auth-callback.js';
import { handle as authLogout } from './routes/auth-logout.js';
import { handle as creatorInfo } from './routes/creator-info.js';
import { handle as publishInit } from './routes/publish-init.js';
import { handle as publishUpload } from './routes/publish-upload.js';
import { handle as publishStatus } from './routes/publish-status.js';
import { handle as token } from './routes/token.js';
import { handle as accounts } from './routes/accounts.js';
import { handle as health } from './routes/health.js';

const ROUTES = {
  'GET /auth/start': authStart,
  'GET /auth/callback': authCallback,
  'GET /auth/logout': authLogout,
  'GET /api/creator-info': creatorInfo,
  'POST /api/publish/init': publishInit,
  'PUT /api/publish/upload': publishUpload,
  'GET /api/publish/status': publishStatus,
  'POST /api/token': token,
  'GET /api/accounts': accounts,
  'GET /api/health': health,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const handler = ROUTES[`${request.method} ${pathname}`];

    if (!handler) {
      // Wrong method on a real route should read as 405, not 404.
      const methodMismatch = Object.keys(ROUTES).some((k) => k.endsWith(' ' + pathname));
      return new Response(methodMismatch ? 'Method Not Allowed' : 'Not Found', {
        status: methodMismatch ? 405 : 404,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
      });
    }

    try {
      return await handler({ request, env, ctx });
    } catch (err) {
      // Never leak internals (they can contain token material) to the client.
      console.error(`${request.method} ${pathname} failed:`, err && err.stack ? err.stack : err);
      return new Response(JSON.stringify({ error: 'internal_error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      });
    }
  },
};
