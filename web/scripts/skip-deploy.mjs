import { execFileSync } from 'node:child_process';
let message = process.env.VERCEL_GIT_COMMIT_MESSAGE;
if (!message) {
  try { message = execFileSync('git', ['log', '-1', '--format=%B'], { encoding: 'utf8' }); }
  catch { message = ''; }
}
const skip = message.includes('[skip deploy]');
console.log(skip ? 'Skipping this explicitly marked code-only synchronization.' : 'Normal deployment enabled.');
process.exit(skip ? 0 : 1);
