import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webDirectory = fileURLToPath(new URL('..', import.meta.url));
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3012'], {
  cwd: webDirectory,
  stdio: 'inherit',
  env: { ...process.env, REACHARD_PREVIEW_DIST_DIR: '.next-marketing-preview' }
});
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
