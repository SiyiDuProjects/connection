import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as jose from 'jose';
import React from 'react';
import { NextRequest } from 'next/server.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
process.env.AUTH_SECRET = 'isolated-auth-session-fixture-secret-at-least-32-characters';
process.env.POSTGRES_URL = 'postgresql://fixture:fixture@localhost/fixture';
const jar = new Map();
let lastCookie;
let user = null;
const overrides = {
  jose,
  'next/headers': { cookies: async () => ({
    get: name => jar.has(name) ? { value: jar.get(name) } : undefined,
    has: name => jar.has(name),
    set: (name, value, options) => { lastCookie = { name, value, options }; jar.set(name, value); },
  }) },
  'next/navigation': { redirect: url => { throw Object.assign(new Error('redirect'), { url }); } },
  '@/lib/db/queries': { getUser: async () => user },
  './login': { Login: () => React.createElement('div', null, 'login') },
  './continue-checkout': { ContinueCheckout: () => React.createElement('div', null, 'checkout') },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith('@/')) return load(resolve(root, name.slice(2) + '.ts'));
    if (name.startsWith('.')) return load(resolve(dirname(file), name + '.ts'));
    return require(name);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const session = load(resolve(root, 'lib/auth/session.ts'));
const { middleware } = load(resolve(root, 'middleware.ts'));
const { AuthPage } = load(resolve(root, 'app/(login)/auth-page.tsx'));
const { signedInDestination } = load(resolve(root, 'lib/auth/entry-destination.ts'));

test('session cookie is persistent, root-scoped and readable by a later request', async () => {
  const before = Date.now();
  await session.setSession({ id: 17 });
  assert.equal(lastCookie.options.path, '/');
  assert.equal(lastCookie.options.httpOnly, true);
  assert.equal(lastCookie.options.sameSite, 'lax');
  assert.ok(lastCookie.options.expires.getTime() >= before + 23.9 * 60 * 60 * 1000);
  assert.equal((await session.getSession()).user.id, 17);
});

test('expired or malformed tokens become signed-out state', async () => {
  const expired = await new jose.SignJWT({ user: { id: 17 } })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1 second ago')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  for (const value of [expired, 'invalid']) {
    jar.set('session', value);
    assert.equal(await session.getSession(), null);
  }
});

test('middleware preserves the requested dashboard path and query when signed out', async () => {
  const response = await middleware(new NextRequest('https://reachard.co/dashboard/general?tab=password'));
  const target = new URL(response.headers.get('location'));
  assert.equal(target.pathname, '/sign-in');
  assert.equal(target.searchParams.get('redirect'), '/dashboard/general?tab=password');
});

test('invalid cookie is removed on the actual redirect response', async () => {
  const response = await middleware(new NextRequest('https://reachard.co/dashboard', { headers: { cookie: 'session=invalid' } }));
  assert.equal(response.status, 307);
  assert.match(response.headers.get('set-cookie'), /session=;/);
  assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
});

test('valid cookie refresh retains user and root scope', async () => {
  await session.setSession({ id: 17, sessionVersion: 12 });
  const response = await middleware(new NextRequest('https://reachard.co/', { headers: { cookie: `session=${jar.get('session')}` } }));
  const refreshed = response.cookies.get('session');
  assert.equal((await session.verifyToken(refreshed.value)).user.id, 17);
  assert.equal((await session.verifyToken(refreshed.value)).user.sessionVersion, 12);
  assert.equal(refreshed.path, '/');
});

test('password recovery page suppresses referrer propagation and caching', async () => {
  const response = await middleware(new NextRequest('https://reachard.co/reset-password?token=fixture'));
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('authenticated sign-in and sign-up entries redirect without another form', async () => {
  user = { id: 17 }; jar.set('session', 'present');
  for (const mode of ['signin', 'signup']) {
    await assert.rejects(AuthPage({ mode, searchParams: Promise.resolve({}) }), error => error.url === '/dashboard');
    await assert.rejects(AuthPage({ mode, searchParams: Promise.resolve({ redirect: '/connect-extension?state=fixture' }) }), error => error.url === '/connect-extension?state=fixture');
  }
});

test('authenticated checkout retains price and requires an explicit continuation', async () => {
  user = { id: 17 }; jar.set('session', 'present');
  const view = await AuthPage({ mode: 'signin', searchParams: Promise.resolve({ redirect: 'checkout', priceId: 'price_fixture' }) });
  assert.equal(view.type, overrides['./continue-checkout'].ContinueCheckout);
  assert.equal(view.props.priceId, 'price_fixture');
});

test('invalid/deleted user session still gets auth form', async () => {
  user = null; jar.set('session', 'present');
  const view = await AuthPage({ mode: 'signup', searchParams: Promise.resolve({}) });
  assert.equal(view.props.children.type, overrides['./login'].Login);
  assert.equal(view.props.children.props.mode, 'signup');
});

test('auth landing rejects external redirects and auth-page loops', () => {
  for (const target of ['//evil.example', '/\\evil.example', '/sign-up?ref=code', '/sign-in/', '/verify-email']) {
    assert.equal(signedInDestination(target), '/dashboard');
  }
  assert.equal(signedInDestination('/dashboard/profile?edit=1'), '/dashboard/profile?edit=1');
});
