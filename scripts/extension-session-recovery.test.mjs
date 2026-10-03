import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../extension/service_worker.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const sender = { url: 'https://reachard.co/dashboard' };
const panel = { url: `chrome-extension://${'a'.repeat(32)}/sidepanel.html` };
const body = { contact: { id: 'fixture-contact' } };
const account = id => ({ ok: true, user: { id } });
const reply = (status = 200, payload = { ok: true, email: 'fixture@example.com' }) => ({ status, ok: status >= 200 && status < 300, async json() { return payload; } });
const state = () => ({ extensionApiToken: 'old-fixture-token', accountStatus: account(42) });
function worker(local = state(), fetcher = async () => reply(), hooks = {}) {
  const area = data => ({
    async get(keys) { return Object.fromEntries(keys.filter(key => key in data).map(key => [key, structuredClone(data[key])])); },
    async set(values) { await hooks.beforeSet?.(values); Object.assign(data, structuredClone(values)); },
    async remove(keys) { await hooks.beforeRemove?.(keys); for (const key of keys) delete data[key]; }
  });
  const event = { addListener() {} };
  const chrome = { storage: { local: area(local), sync: area({}) },
    runtime: { id: 'a'.repeat(32), getURL: path => `${panel.url.replace('sidepanel.html', '')}${path}`, getManifest: () => ({ version: '0.7.5' }), onInstalled: event, onStartup: event, onMessage: event, onMessageExternal: event, async sendMessage() {} },
    action: { onClicked: event }, sidePanel: { async setPanelBehavior() {} }, tabs: { async query() { return []; } } };
  const context = vm.createContext({ chrome, fetch: fetcher, URL, AbortSignal, crypto: webcrypto, TextEncoder, console, importScripts() {}, ReachardBrand: { name: 'Reachard' } });
  vm.runInContext(source, context);
  return context;
}
const connect = (w, token = 'new-fixture-token') => w.connectExtensionSession({ token, webBaseUrl: 'https://reachard.co', apiBaseUrl: 'https://contacts.reachard.co' }, sender);

for (const operation of ['account', 'post', 'preferences', 'presence']) {
  test(`late ${operation} 401 cannot delete a newly connected session`, async () => {
    const local = state(), pending = deferred(), w = worker(local, () => pending.promise);
    const request = operation === 'account' ? w.getAccountStatus(sender)
      : operation === 'post' ? w.postJson('/api/contacts/reveal', body, sender)
      : operation === 'presence' ? w.getLocalSessionStatus(sender)
      : w.webJson('/api/settings/custom', { method: 'GET' }, sender);
    await tick(); await connect(w);
    pending.resolve(reply(401, {})); await request;
    assert.equal(local.extensionApiToken, 'new-fixture-token');
  });
}

test('clearing an expired session cannot interleave storage removal with a new connection', async () => {
  const local = state(), deleting = deferred(), resume = deferred();
  const w = worker(local, async () => reply(401, {}), { async beforeRemove(keys) {
    if (keys.includes('extensionApiToken')) { deleting.resolve(); await resume.promise; }
  } });
  const old = w.getAccountStatus(sender); await deleting.promise;
  const fresh = connect(w); resume.resolve(); await Promise.all([old, fresh]);
  assert.equal(local.extensionApiToken, 'new-fixture-token');
});

test('a current-session 401 still clears the invalid credential', async () => {
  const local = state(), w = worker(local, async () => reply(401, {}));
  await w.getAccountStatus(sender); assert.equal(local.extensionApiToken, undefined);
});

for (const change of ['reconnect', 'sign-out']) {
  test(`presence cannot report an old account when ${change} happens while reading the response`, async () => {
    const local = state(), reading = deferred(), payload = deferred();
    const w = worker(local, async () => ({ ok: true, status: 200, async json() {
      reading.resolve(); return payload.promise;
    } }));
    const pending = w.getLocalSessionStatus(sender);
    await reading.promise;
    if (change === 'reconnect') await connect(w);
    else await w.clearExtensionSession(sender, { requireAllowedWebsite: true });
    payload.resolve(account(42));
    const result = await pending;
    assert.equal(result.sessionState, 'unavailable');
    assert.equal(result.userId, undefined);
    assert.equal(local.extensionApiToken, change === 'reconnect' ? 'new-fixture-token' : undefined);
  });
}

test('queued preferences are canceled when the account changes', async () => {
  const local = state(), first = deferred(), writes = [];
  const w = worker(local, async (_url, options) => {
    writes.push({ token: options.headers.Authorization, notes: JSON.parse(options.body).notes });
    return writes.length === 1 ? first.promise : reply();
  });
  const p1 = w.handleMessage({ type: 'SET_EMAIL_CUSTOMIZE', payload: { notes: 'A first note' } }, panel);
  await tick();
  const p2 = w.handleMessage({ type: 'SET_EMAIL_CUSTOMIZE', payload: { notes: 'A private queued note' } }, panel);
  await connect(w, 'account-B-fixture'); first.resolve(reply());
  const [, canceled] = await Promise.all([p1, p2]);
  assert.equal(writes.length, 1);
  assert.equal(canceled.ok, false);
});

test('unknown outcomes reuse their key after worker restart and same-account token rotation', async () => {
  const local = state(), keys = [];
  const lost = async (_url, options) => { keys.push(options.headers['Idempotency-Key']); throw new Error('lost response after server commit'); };
  await worker(local, lost).postJson('/api/contacts/reveal', body, sender);
  const w = worker(local, async (url, options) => {
    if (url.endsWith('/api/account')) return reply(200, account(42));
    keys.push(options.headers['Idempotency-Key']); return reply();
  });
  await connect(w); await w.postJson('/api/contacts/reveal', body, sender);
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
});

test('different accounts never share retry records for an identical operation', async () => {
  const local = state(), keys = [];
  const w = worker(local, async (url, options) => {
    if (url.endsWith('/api/account')) return reply(200, account(99));
    keys.push(options.headers['Idempotency-Key']); throw new Error('unknown outcome');
  });
  await w.postJson('/api/contacts/reveal', body, sender);
  await connect(w); await w.postJson('/api/contacts/reveal', body, sender);
  assert.notEqual(keys[0], keys[1]);
});

test('concurrent identical operations reserve one durable key before sending', async () => {
  const keys = [], pending = deferred(), arrived = deferred(), w = worker(state(), async (_url, options) => { keys.push(options.headers['Idempotency-Key']); if (keys.length === 2) arrived.resolve(); return pending.promise; });
  const p1 = w.postJson('/api/contacts/reveal', body, sender), p2 = w.postJson('/api/contacts/reveal', body, sender);
  await arrived.promise; pending.resolve(reply()); await Promise.all([p1, p2]);
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
});

test('a malformed success response keeps the retry key until confirmed completion', async () => {
  const local = state(), keys = [];
  const w = worker(local, async (_url, options) => { keys.push(options.headers['Idempotency-Key']); return { ...reply(), async json() { throw new Error('truncated JSON'); } }; });
  assert.equal((await w.postJson('/api/contacts/reveal', body, sender)).ok, false);
  await worker(local, async (_url, options) => { keys.push(options.headers['Idempotency-Key']); return reply(); }).postJson('/api/contacts/reveal', body, sender);
  assert.equal(keys[0], keys[1]);
});

test('an operation is not sent when its retry record cannot be persisted', async () => {
  let sent = false;
  const w = worker(state(), async () => { sent = true; return reply(); }, { beforeSet(values) {
    if (Object.keys(values).some(key => key.startsWith('pendingRequest:'))) throw new Error('storage unavailable');
  } });
  await assert.rejects(w.postJson('/api/contacts/reveal', body, sender), /storage unavailable/);
  assert.equal(sent, false);
});

test('a late account success cannot replace the new account cache', async () => {
  const local = state(), pending = deferred(), w = worker(local, () => pending.promise);
  const old = w.getAccountStatus(sender);
  await tick(); await connect(w);
  local.accountStatus = account(99);
  pending.resolve(reply(200, account(42)));
  assert.equal((await old).ok, false);
  assert.equal(local.accountStatus.user.id, 99);
});

test('an unknown result beyond the replay safety window is blocked without sending', async () => {
  const local = state();
  await worker(local, async () => { throw new Error('lost response'); }).postJson('/api/contacts/reveal', body, sender);
  const key = Object.keys(local).find(key => key.startsWith('pendingRequest:'));
  local[key].createdAt = Date.now() - 7 * 86400000;
  let sent = false;
  const result = await worker(local, async () => { sent = true; return reply(); }).postJson('/api/contacts/reveal', body, sender);
  assert.equal(result.status, 409);
  assert.equal(sent, false);
  assert.ok(local[key]);
});

test('retry storage contains no request body and is removed after confirmed success', async () => {
  const local = state();
  await worker(local, async () => { throw new Error('lost response'); }).postJson('/api/contacts/reveal', body, sender);
  const key = Object.keys(local).find(key => key.startsWith('pendingRequest:'));
  assert.match(key, /^pendingRequest:[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(local[key]).sort(), ['createdAt', 'key']);
  assert.equal(JSON.stringify(local[key]).includes(body.contact.id), false);
  await worker(local).postJson('/api/contacts/reveal', body, sender);
  assert.equal(local[key], undefined);
});
