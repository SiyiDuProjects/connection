import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createProviderUsageGuard, createRateLimiter } from './usage-guard.js';
import { fail, ok, publicError } from './http.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function fixtureServer({ env = {}, search = async () => [{ name: 'Fixture Person' }] } = {}) {
  const routes = new Map();
  const access = [];
  const claims = new Map();
  let calls = 0;
  const operationCalls = { search: 0, reveal: 0, draft: 0 };
  let charges = 0;
  const claimKey = ({ userId, action, idempotencyKey }) => `${userId}:${action}:${idempotencyKey}`;
  const application = {
    use: (path, fn) => { if (path === '/api') access.push(fn); },
    post: (path, ...handlers) => routes.set(`POST ${path}`, handlers),
    get: (path, ...handlers) => routes.set(`GET ${path}`, handlers),
    listen: () => ({ close: () => {} }),
  };
  const context = {
    BRAND_NAME: 'Reachard', URL, console, Date,
    process: { env: { RATE_LIMIT_MAX: '100', PROVIDER_USER_CONCURRENCY: '1', PROVIDER_GLOBAL_CONCURRENCY: '2',
      PROVIDER_FAILURE_THRESHOLD: '2', ...env }, once: () => {} },
    setInterval: () => ({ unref: () => {} }), clearInterval: () => {},
    express: Object.assign(() => application, { json: () => () => {} }),
    cors: () => () => {}, helmet: () => () => {},
    requestContext: () => {}, logRequest: () => {}, writeLog: () => {}, errorHandler: () => {},
    createRateLimiter, createProviderUsageGuard, fail, ok, publicError,
    isBetaUnlimitedUsage: () => false, hasMembershipAccess: () => true,
    getBearerToken: (req) => req.get('authorization')?.replace(/^Bearer /, '') || '',
    getUserFromApiToken: async (token) => {
      if (!['alice', 'bob', 'charlie'].includes(token)) throw publicError('Invalid token', 401);
      return { id: token };
    },
    getMembershipForUser: async () => ({}), getCreditBalance: async () => 20,
    getOnboardingForUser: async () => ({ complete: true }), getUserSettings: async () => ({}),
    getAccountSummary: async () => ({}), isAccountDbConfigured: () => true,
    checkAccountDb: async () => {}, closeAccountDb: async () => {}, pruneApiIdempotencyKeys: async () => {},
    claimApiRequest: async (value) => {
      const key = claimKey(value);
      const stored = claims.get(key);
      if (stored?.status === 'replay' || stored?.status === 'processing') return stored;
      claims.set(key, { status: 'processing' });
      return { status: 'claimed' };
    },
    chargeAndLogApiUsage: async (value) => {
      charges += 1;
      claims.set(claimKey(value), { status: 'replay', response: value.response });
      return { ok: true, response: value.response };
    },
    failApiRequest: async (value) => { claims.delete(claimKey(value)); }, logApiUsage: async () => {},
    searchContacts: async (...args) => { calls += 1; operationCalls.search += 1; return search(...args); }, rankContacts: (people) => people,
    revealEmail: async () => { operationCalls.reveal += 1; return 'person@example.com'; },
    createDraft: async () => { operationCalls.draft += 1; return { subject: 'Hello', body: 'Draft' }; },
    createMailtoUrl: () => 'mailto:person@example.com', getDraftInternalCost: () => null,
  };
  // Execute the actual Express route/middleware bodies with isolated account/provider
  // dependencies. No database, HTTP listener, timers, or paid service is invoked.
  const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\r?\n/gm, '');
  vm.runInNewContext(source, context, { filename: 'index.js' });

  function request({ token = 'alice', path = '/api/contacts/search', method = 'POST', key = 'request',
    body = { companyName: 'Example' }, ip = 'proxy-ip', forwarded = 'untrusted-client-ip' } = {}) {
    return new Promise((resolve, reject) => {
      const response = { status: 200, headers: {}, body: null };
      const res = {
        setHeader: (name, value) => { response.headers[name] = String(value); },
        status: (value) => { response.status = value; return res; },
        json: (value) => { response.body = value; resolve(response); return res; },
      };
      const req = { user: { id: 'forged-id' }, body, socket: { remoteAddress: ip }, ip,
        requestId: key, get: (name) => ({ authorization: token ? `Bearer ${token}` : '',
          'idempotency-key': key, 'x-forwarded-for': forwarded })[name] };
      const chain = [...access, ...(routes.get(`${method} ${path}`) || [])];
      const next = (error) => {
        if (error) {
          if (error.retryAfter) res.setHeader('Retry-After', error.retryAfter);
          return fail(res, error.status || 500, error.publicMessage || error.message);
        }
        const fn = chain.shift();
        if (!fn) return reject(new Error('Route did not respond.'));
        Promise.resolve(fn(req, res, next)).catch(reject);
      };
      next();
    });
  }
  return { request, calls: () => calls, charges: () => charges, operationCalls };
}

test('authenticated accounts behind one proxy get independent limits; forged identity does not bypass them', async () => {
  const fixture = fixtureServer({ env: { RATE_LIMIT_MAX: '1' } });
  assert.equal((await fixture.request({ key: 'a1' })).status, 200);
  const limited = await fixture.request({ key: 'a2', forwarded: 'different-ip' });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers['Retry-After']) > 0);
  assert.equal((await fixture.request({ token: 'bob', key: 'b1' })).status, 200);
  assert.equal(fixture.calls(), 2);
});

test('missing and invalid tokens share a socket-address limit; successful auth remains separate', async () => {
  const fixture = fixtureServer({ env: { RATE_LIMIT_UNAUTHENTICATED_MAX: '1' } });
  assert.equal((await fixture.request({ token: '' })).status, 401);
  assert.equal((await fixture.request({ token: 'invalid', forwarded: 'new-ip' })).status, 429);
  assert.equal((await fixture.request({ key: 'authenticated' })).status, 200);
  assert.equal(fixture.calls(), 1);
});

test('a completed idempotent replay bypasses provider admission and does not charge again', async () => {
  const hold = deferred();
  let first = true;
  const fixture = fixtureServer({ search: async () => { if (first) { first = false; return []; } await hold.promise; return []; } });
  assert.equal((await fixture.request({ key: 'completed' })).status, 200);
  const running = fixture.request({ key: 'running' });
  await new Promise((done) => setImmediate(done));
  const replay = await fixture.request({ key: 'completed' });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.idempotentReplay, true);
  assert.equal((await fixture.request({ key: 'running' })).status, 409);
  assert.equal((await fixture.request({ key: 'blocked' })).status, 429);
  assert.equal(fixture.calls(), 2);
  assert.equal(fixture.charges(), 1);
  hold.resolve();
  assert.equal((await running).status, 200);
  assert.equal((await fixture.request({ key: 'blocked' })).status, 200);
  assert.equal(fixture.charges(), 3);
});

test('global concurrency rejects new paid work without charging and releases capacity after failure', async () => {
  const hold = deferred();
  const fixture = fixtureServer({ env: { PROVIDER_GLOBAL_CONCURRENCY: '1' }, search: async () => {
    await hold.promise;
    throw publicError('Provider failure', 502);
  } });
  const running = fixture.request({ key: 'a1' });
  await new Promise((done) => setImmediate(done));
  const busy = await fixture.request({ token: 'bob', key: 'b1' });
  assert.equal(busy.status, 503);
  assert.equal(busy.headers['Retry-After'], '2');
  assert.equal(fixture.calls(), 1);
  hold.resolve();
  assert.equal((await running).status, 503);
  assert.equal((await fixture.request({ token: 'bob', key: 'b1' })).status, 503);
  assert.equal(fixture.calls(), 2);
  assert.equal(fixture.charges(), 0);
});

test('search, reveal and draft share the same user capacity while other users can continue', async () => {
  const hold = deferred();
  const fixture = fixtureServer({ search: async () => { await hold.promise; return []; } });
  const running = fixture.request({ key: 'search' });
  await new Promise((done) => setImmediate(done));
  const contact = { name: 'Fixture Person', email: 'person@example.com' };
  for (const path of ['/api/contacts/reveal', '/api/email/draft']) {
    assert.equal((await fixture.request({ path, key: path.replaceAll('/', '-'), body: { contact } })).status, 429);
  }
  assert.deepEqual(fixture.operationCalls, { search: 1, reveal: 0, draft: 0 });
  assert.equal((await fixture.request({ token: 'bob', path: '/api/email/draft', key: 'other-user', body: { contact } })).status, 200);
  hold.resolve();
  await running;
  for (const path of ['/api/contacts/reveal', '/api/email/draft']) {
    assert.equal((await fixture.request({ path, key: path.replaceAll('/', '-'), body: { contact } })).status, 200);
  }
  assert.deepEqual(fixture.operationCalls, { search: 1, reveal: 1, draft: 2 });
});

test('provider failures open a circuit while existing replay remains available without provider work', async () => {
  let healthy = true;
  const fixture = fixtureServer({ search: async () => {
    if (!healthy) throw publicError('Upstream unavailable', 502);
    return [];
  } });
  assert.equal((await fixture.request({ key: 'saved' })).status, 200);
  healthy = false;
  await fixture.request({ key: 'failure1' });
  await fixture.request({ key: 'failure2' });
  const blocked = await fixture.request({ key: 'failure3' });
  assert.equal(blocked.status, 503);
  assert.ok(Number(blocked.headers['Retry-After']) > 0);
  assert.equal(fixture.calls(), 3);
  assert.equal((await fixture.request({ key: 'saved' })).status, 200);
  assert.equal(fixture.charges(), 1);
});

test('circuits recover through one probe, ignore stale successes, and remain separate by action', async () => {
  let time = 1000;
  const events = [];
  const guard = createProviderUsageGuard({ userConcurrency: 2, globalConcurrency: 5,
    failureThreshold: 1, cooldownMs: 1000, now: () => time, onCircuitChange: (event) => events.push(event) });
  const stale = deferred();
  const oldWork = guard.run('search', 1, () => stale.promise);
  await assert.rejects(guard.run('search', 2, () => Promise.reject(publicError('error', 502))));
  stale.resolve('old response');
  await oldWork;
  await assert.rejects(guard.run('search', 1, async () => 'must not run'), { status: 503 });
  assert.equal(await guard.run('draft', 1, async () => 'draft'), 'draft');
  time += 1000;
  const probe = deferred();
  const recovering = guard.run('search', 1, () => probe.promise);
  await assert.rejects(guard.run('search', 2, async () => 'second probe'), { status: 503 });
  probe.resolve('recovered');
  assert.equal(await recovering, 'recovered');
  assert.equal(await guard.run('search', 2, async () => 'new result'), 'new result');
  assert.deepEqual(events.map((event) => event.state), ['open', 'closed']);
});

test('client validation failures do not trip a circuit; failed probes reopen it', async () => {
  let time = 1000;
  const guard = createProviderUsageGuard({ userConcurrency: 1, globalConcurrency: 1,
    failureThreshold: 1, cooldownMs: 1000, now: () => time });
  await assert.rejects(guard.run('search', 1, async () => { throw publicError('unknown location', 422); }));
  assert.equal(await guard.run('search', 1, async () => 'valid result'), 'valid result');
  await assert.rejects(guard.run('search', 1, async () => { throw new Error('network down'); }));
  time += 1000;
  await assert.rejects(guard.run('search', 1, async () => { throw publicError('provider rate limit', 429); }));
  await assert.rejects(guard.run('search', 2, async () => 'blocked'), { status: 503 });
  time += 1000;
  assert.equal(await guard.run('search', 2, async () => 'recovered'), 'recovered');
});
