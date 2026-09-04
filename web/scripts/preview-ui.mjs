// Isolated visual preview. No production database, billing, or contact provider is used.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3100'], {
  cwd: webRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    POSTGRES_URL: 'postgres://preview:preview@127.0.0.1:1/reachard_preview',
    AUTH_SECRET: 'local-visual-preview-only-not-for-authentication',
    STRIPE_SECRET_KEY: 'sk_test_local_visual_preview_placeholder'
  }
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
