import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';

const require = createRequire(import.meta.url);
let state, fetcher;
const ProfileForm = () => null;
const Alert = Object.assign(() => null, { Indicator: 'indicator', Content: 'content', Description: 'description' });
const source = readFileSync(new URL('../app/(dashboard)/dashboard/profile/profile-editor.tsx', import.meta.url), 'utf8');
const module = { exports: {} };
const overrides = {
  swr: (_key, request) => { fetcher = request; return state; },
  '@heroui/react': { Alert, Spinner: 'spinner', Button: 'button' },
  '@/components/profile-form': { ProfileForm },
};
new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
}, fileName: fileURLToPath(new URL('../app/(dashboard)/dashboard/profile/profile-editor.tsx', import.meta.url)) }).outputText)(
  name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), module, module.exports,
);
const Editor = module.exports.default;
const data = id => ({ user: { id, name: 'Fixture', email: 'fixture@example.com' }, settings: { school: 'School' } });
function find(element, type, path = '') {
  if (!React.isValidElement(element)) return null;
  if (element.type === type) return { element, path };
  const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
  for (const [index, child] of children.entries()) {
    const match = find(child, type, `${path}/${index}`);
    if (match) return match;
  }
  return null;
}

for (const status of [401, 503]) {
  test(`background ${status} preserves the mounted form position and identity`, () => {
    state = { data: data(1), mutate: async () => {} };
    const before = find(Editor({}), ProfileForm);
    state.error = Object.assign(new Error('Refresh failed'), { status });
    const during = find(Editor({}), ProfileForm);
    assert.ok(during, 'A failed background refresh must not unmount the user\'s draft');
    assert.equal(during.path, before.path);
    assert.equal(during.element.key, before.element.key);
    state.error = undefined;
    const recovered = find(Editor({}), ProfileForm);
    assert.equal(recovered.path, before.path);
    assert.equal(recovered.element.key, before.element.key);
  });
}

test('a confirmed account switch remounts the form rather than reusing the previous account draft', () => {
  state = { data: data(1), mutate: async () => {} };
  const first = find(Editor({}), ProfileForm);
  state.data = data(2);
  const second = find(Editor({}), ProfileForm);
  assert.notEqual(first.element.key, second.element.key);
});

test('an initial load failure does not offer an empty editable profile', () => {
  state = { error: new Error('Offline'), mutate: async () => {} };
  assert.equal(find(Editor({}), ProfileForm), null);
});

test('account fetch distinguishes expired login from temporary failure, including non-JSON responses', async t => {
  state = { data: data(1), mutate: async () => {} }; Editor({});
  t.mock.method(globalThis, 'fetch', async () => new Response('Unauthorized', { status: 401 }));
  await assert.rejects(fetcher('/api/account'), error => error.status === 401 && /sign in/i.test(error.message));
  t.mock.method(globalThis, 'fetch', async () => new Response('Unavailable', { status: 503 }));
  await assert.rejects(fetcher('/api/account'), error => error.status === 503);
});

test('a failed refresh after saving is handled instead of escaping as an unhandled rejection', async () => {
  state = { data: data(1), mutate: async () => { throw new Error('Offline after save'); } };
  const form = find(Editor({}), ProfileForm);
  await form.element.props.onSaved();
  await new Promise(resolve => setImmediate(resolve));
});

test('the dashboard shell fetcher preserves 401 status in the shared account cache', async t => {
  const source = readFileSync(new URL('../app/(dashboard)/dashboard/dashboard-overview.tsx', import.meta.url), 'utf8');
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText)(() => ({}), module, module.exports);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Unauthorized' }, { status: 401 }));
  await assert.rejects(module.exports.fetchDashboardAccount('/api/account'), error => error.status === 401);
});
