import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../components/extension-session-bridge.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
async function mount(t, initial) {
  let status = initial, effect, cleanup, retry;
  const requests = [], messages = [], listeners = new Set();
  const previousWindow = globalThis.window;
  const window = {
    location: { origin: 'https://reachard.co', hostname: 'reachard.co' },
    setTimeout, clearTimeout,
    setInterval: callback => { retry = callback; return 1; }, clearInterval() {},
    addEventListener(type, callback) { if (type === 'message') listeners.add(callback); },
    removeEventListener(type, callback) { if (type === 'message') listeners.delete(callback); },
    postMessage(message) {
      messages.push(message);
      queueMicrotask(() => {
        const response = message.type === 'GET_EXTENSION_SESSION_STATUS'
          ? { ok: true, extensionId: 'a'.repeat(32), ...status } : { ok: true };
        for (const callback of [...listeners]) callback({ source: window,
          data: { source: 'reachard-extension-bridge', id: message.id, response } });
      });
    },
  };
  globalThis.window = window;
  t.after(() => { cleanup?.(); if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, method: options.method });
    return Response.json({ token: 'fixture-token', tokenId: 9 });
  });
  const module = { exports: {} };
  const overrides = {
    react: { useRef: () => ({ current: null }), useEffect: callback => { effect = callback; } },
    'next/navigation': { usePathname: () => '/dashboard' },
  };
  new Function('require', 'module', 'exports', source)(name => overrides[name] || require(name), module, module.exports);
  module.exports.ExtensionSessionBridge({ user: { id: 42 } });
  cleanup = effect(); await tick();
  return { requests, messages, async retry(next) { status = next; await retry(); await tick(); } };
}

test('a temporary account-check failure never rotates a token and can recover on the next check', async t => {
  const bridge = await mount(t, { hasToken: true, sessionState: 'unavailable' });
  assert.equal(bridge.requests.length, 0, 'Unknown status must not revoke the current credential by minting a replacement');
  await bridge.retry({ hasToken: true, sessionState: 'connected', userId: 42 });
  assert.equal(bridge.requests.length, 0);
});

test('an unavailable check can later reconnect after confirmed sign-out', async t => {
  const bridge = await mount(t, { hasToken: true, sessionState: 'unavailable' });
  assert.equal(bridge.requests.length, 0);
  await bridge.retry({ hasToken: false, sessionState: 'signed-out' });
  assert.deepEqual(bridge.requests, [{ url: '/api/extension-token', method: 'POST' }]);
  assert.ok(bridge.messages.some(message => message.type === 'CONNECT_EXTENSION_TOKEN'));
});

test('a confirmed different account still connects the signed-in website account', async t => {
  const bridge = await mount(t, { hasToken: true, sessionState: 'connected', userId: 77 });
  assert.deepEqual(bridge.requests, [{ url: '/api/extension-token', method: 'POST' }]);
  assert.ok(bridge.messages.some(message => message.type === 'CONNECT_EXTENSION_TOKEN'));
});
