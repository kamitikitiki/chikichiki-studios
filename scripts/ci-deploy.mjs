// Deploy the Worker together with its secrets, in a single version.
//
// Why this exists: the Git integration builds a new Worker version on every push.
// A version built by CI does not carry the secrets that were typed into the
// dashboard, so the deployed version ends up with none of them -- the settings page
// still lists them, but `env.TIKTOK_CLIENT_KEY` is undefined at runtime.
// `wrangler deploy --secrets-file` puts the code and the secrets in the same version,
// which removes the race entirely.
//
// The values come from the build environment (Cloudflare: Settings > Build > Build
// variables and secrets). They are written to a temp file outside the repository and
// deleted immediately afterwards, so they never touch the working tree.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REQUIRED = [
  'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET',
  'SESSION_SECRET',
  'ACTIONS_SHARED_SECRET',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `\nMissing build secrets: ${missing.join(', ')}\n\n` +
      'Set them in the Cloudflare dashboard under Settings > Build > Build variables\n' +
      'and secrets (type: Secret), then re-run the build.\n'
  );
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'cs-secrets-'));
const file = join(dir, 'secrets.json');

try {
  writeFileSync(
    file,
    JSON.stringify(Object.fromEntries(REQUIRED.map((k) => [k, process.env[k]]))),
    { mode: 0o600 }
  );

  const res = spawnSync('npx', ['wrangler', 'deploy', '--secrets-file', file], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exit(res.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
