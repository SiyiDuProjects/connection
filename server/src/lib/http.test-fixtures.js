import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import express from 'express';
import { fetchJsonWithTimeout, errorHandler } from './http.js';
import { createProviderUsageGuard } from './usage-guard.js';

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('one deadline covers stalled headers', { timeout: 5000 }, async t => {
  const url = await serve(t, () => {});
  await assert.rejects(fetchJsonWithTimeout(url, {}, { timeoutMs: 1000, provider: 'fixture' }),
    { status: 504, message: 'fixture request timed out after 1000ms.' });
});

test('a stalled JSON body times out and releases the shared provider slot', { timeout: 5000 }, async t => {
  const url = await serve(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.flushHeaders();
    res.write('{"contacts":[');
  });
  const guard = createProviderUsageGuard({ userConcurrency: 1, globalConcurrency: 1,
    failureThreshold: 5, cooldownMs: 1000 });
  await assert.rejects(guard.run('search', 1, () => fetchJsonWithTimeout(url, {}, { timeoutMs: 1000 })), { status: 504 });
  assert.equal(await guard.run('search', 1, async () => 'capacity released'), 'capacity released');
});

test('caller cancellation also interrupts body consumption', { timeout: 5000 }, async t => {
  const controller = new AbortController();
  const url = await serve(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.flushHeaders();
    setImmediate(() => controller.abort());
  });
  await assert.rejects(fetchJsonWithTimeout(url, { signal: controller.signal }), { name: 'AbortError' });
});

test('complete JSON preserves status and cost headers; non-JSON errors retain their status', async t => {
  const url = await serve(t, (req, res) => {
    if (req.url === '/error') { res.writeHead(502); res.end('not JSON'); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'x-treg-cost-micro': '500' });
    res.end(JSON.stringify({ contacts: [{ name: 'Fixture' }] }));
  });
  const { response, data } = await fetchJsonWithTimeout(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-treg-cost-micro'), '500');
  assert.deepEqual(data.contacts, [{ name: 'Fixture' }]);
  const error = await fetchJsonWithTimeout(url + '/error');
  assert.equal(error.response.status, 502);
  assert.deepEqual(error.data, {});
});

test('truncated bodies reject instead of becoming successful empty JSON', async t => {
  const url = await serve(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': '1000' });
    res.write('{');
    setImmediate(() => res.destroy());
  });
  await assert.rejects(fetchJsonWithTimeout(url));
});

test('compressed JSON with trailing garbage cannot crash the parser or bypass the size limit', async t => {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.post('/', (req, res) => res.json({ ok: true, value: req.body.value }));
  app.use(errorHandler);
  const url = await serve(t, app);
  const request = body => fetch(url, { method: 'POST',
    headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }, body });
  const malformed = await request(Buffer.concat([gzipSync('{"value":1}'), Buffer.from('trailing garbage')]));
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).ok, false);
  const oversized = await request(gzipSync(JSON.stringify({ value: 'x'.repeat(70_000) })));
  assert.equal(oversized.status, 413);
  await oversized.arrayBuffer();
  const valid = await request(gzipSync('{"value":2}'));
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { ok: true, value: 2 });
});
