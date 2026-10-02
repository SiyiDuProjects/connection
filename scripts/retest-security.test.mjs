import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const ts = require('typescript');
const policy = ts.transpileModule(await readFile(new URL('../web/lib/auth/local-test-policy.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const box = { exports: {}, URL }; vm.runInNewContext(policy, box);
const env = { NODE_ENV: 'development', REACHARD_LOCAL_TEST: '1', POSTGRES_URL: 'postgresql://postgres@127.0.0.1:55432/postgres' };
assert.equal(box.exports.isLocalTestEmail('qa@reachard.test', env), true);
for (const override of [{ NODE_ENV: 'production' }, { VERCEL: '1' }, { REACHARD_LOCAL_TEST: '0' }, { POSTGRES_URL: 'postgresql://postgres@remote:55432/postgres' }]) assert.equal(box.exports.isLocalTestEmail('qa@reachard.test', { ...env, ...override }), false);
for (const email of ['user@berkeley.edu', 'qa@reachard.test.evil.com', 'qa@example.com']) assert.equal(box.exports.isLocalTestEmail(email, env), false);

const source = await readFile(new URL('../extension/service_worker.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function getExtensionPresence('), source.indexOf('async function clearExtensionSession('));
for (const scenario of ['valid', 'missing', '401', '503', 'malformed', 'network']) {
  let clears = 0, calls = 0;
  const sandbox = { AbortSignal, chrome: { runtime: { id: 'a'.repeat(32), getManifest: () => ({ version: '0.7.5' }) } },
    isAllowedWebsite: url => url === 'https://reachard.co/dashboard',
    getExtensionApiToken: async () => scenario === 'missing' ? '' : 'fixture-token',
    readSession: async () => ({ token: scenario === 'missing' ? '' : 'fixture-token', apiBaseUrl: 'https://contacts.reachard.co' }),
    sessionIsCurrent: async () => true,
    getApiBaseUrl: async () => 'https://contacts.reachard.co', removeSensitiveSession: async () => { clears++; return true; },
    safeFetch: async () => { calls++; if (scenario === 'network') throw new Error('offline'); return { status: Number(scenario) || 200, ok: !['401','503'].includes(scenario), json: async () => scenario === 'malformed' ? {} : { ok: true, user: { id: 42 } } }; }
  };
  vm.runInNewContext(helpers, sandbox);
  assert.equal(sandbox.getExtensionPresence({ url: 'https://reachard.co/dashboard' }).installed, true);
  assert.equal(calls, 0, 'Presence must never depend on a provider or network');
  assert.equal(sandbox.getExtensionPresence({ url: 'https://other.example/' }).ok, false);
  const status = await sandbox.getLocalSessionStatus({ url: 'https://reachard.co/dashboard' });
  assert.equal(status.sessionState, scenario === 'valid' ? 'connected' : ['missing','401'].includes(scenario) ? 'signed-out' : 'unavailable');
  assert.equal(clears, scenario === '401' ? 1 : 0);
  if (scenario === 'valid') assert.equal(status.userId, 42);
}
console.log('Local fake-email restrictions and network-independent extension presence/session states passed.');
const intelligence = await readFile(new URL('../server/src/lib/contact-intelligence.js', import.meta.url), 'utf8');
const schoolScope = {};
vm.runInNewContext(intelligence.slice(intelligence.indexOf('function schoolsMatch('), intelligence.indexOf('function normalizeLocation(')), schoolScope);
assert.equal(schoolScope.schoolsMatch('UC Berkeley', 'University of California, Berkeley'), true);
assert.equal(schoolScope.schoolsMatch('University of California, Berkeley - Physics', 'UC Berkeley'), true);
assert.equal(schoolScope.schoolsMatch('Berkeley College', 'University of California, Berkeley'), false);
assert.equal(schoolScope.schoolsMatch('Berkeley City College', 'University of California, Berkeley'), false);
assert.equal(schoolScope.schoolsMatch('Berkeley College', 'Berkeley'), false);
console.log('Canonical school aliases match without conflating Berkeley institutions.');
