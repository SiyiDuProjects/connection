import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const event = () => {
  const listeners = new Set();
  return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn), emit: value => Promise.all([...listeners].map(fn => fn(value))), responses: value => [...listeners].map(fn => fn(value)) };
};
const source = await readFile(new URL('../extension/brand.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../extension/sidepanel.js', import.meta.url), 'utf8');
const loginUrl = 'https://reachard.co/connect-extension?extensionId=fixture&return=https%3A%2F%2Fexample.com%2Fjob';
const unauthorized = { ok: false, status: 401, error: 'Sign in', action: { url: loginUrl } };
const valid = { ok: true, account: { onboarding: { profile: { complete: true } } } };
const initialAccount = deferred(), initialPreferences = deferred(), search = deferred();
let accountReply = initialAccount.promise, preferencesReply = initialPreferences.promise;
let model, actions, update;
const calls = [], opened = [];
const messages = event();
const chrome = { runtime: { id: 'fixture', onMessage: messages, async sendMessage(message) {
  calls.push(message.type);
  if (message.type === 'GET_ACCOUNT_STATUS') return accountReply;
  if (message.type === 'GET_EMAIL_CUSTOMIZE') return preferencesReply;
  if (message.type === 'CONTACTS_SEARCH') return search.promise;
  if (message.type === 'GET_SIGN_IN_ACTION') return { ok: true, action: { url: loginUrl } };
  throw new Error(`Unexpected message: ${message.type}`);
} }, tabs: { async create(value) { opened.push(value); } } };
const window = { setTimeout, clearTimeout, addEventListener() {},
  ReachardPanelContext: { async start(callback) { update = callback; return () => {}; } },
  ReachardUI: { render(_host, state, handlers) { model = state; actions = handlers; } } };
vm.runInNewContext(source, { chrome, window, document: { getElementById: () => ({}) }, URL, console });
window.ReachardController.start();
assert.deepEqual(messages.responses({ type: 'GET_ACCOUNT_STATUS' }), [undefined], 'a panel must not claim unrelated worker messages with an async empty response');
assert.deepEqual(messages.responses({ type: 'CONTACTS_SEARCH' }), [undefined], 'another panel must not intercept search responses');
update({ tabId: 1, pageContext: { type: 'external_job', companyName: 'Fixture', sourceUrl: 'https://example.com/job' } });
assert.equal(model.accountLoading, true);
await actions.search();
assert.ok(!calls.includes('CONTACTS_SEARCH'), 'unknown session must not start a search');

initialAccount.resolve(unauthorized); await tick();
initialPreferences.resolve({ ok: true, custom: { tone: 'warm' } }); await tick();
assert.equal(model.authenticated, false, 'late preferences cannot authenticate a signed-out account');
await actions.search();
actions.showResults(true);
assert.equal(model.searchSheetOpen, false);
assert.ok(!calls.includes('CONTACTS_SEARCH'));
await actions.signIn();
assert.equal(opened[0].url, loginUrl, 'login must preserve the worker-provided return route');

update({ tabId: 2, pageContext: { type: 'linkedin_person', personName: 'Sample', sourceUrl: 'https://example.com/person' } });
await tick(); await actions.search();
assert.equal(model.contacts.length, 0, 'local profile preparation also requires login');

accountReply = valid; preferencesReply = { ok: true, custom: { tone: 'warm' } };
await messages.emit({ type: 'ACCOUNT_AUTH_UPDATED' });
assert.equal(model.authenticated, true);
update({ tabId: 1, pageContext: { type: 'external_job', companyName: 'Fixture', sourceUrl: 'https://example.com/job' } });
await tick(); const searching = actions.search();
assert.ok(calls.includes('CONTACTS_SEARCH'));
accountReply = unauthorized;
const logout = messages.emit({ type: 'ACCOUNT_AUTH_UPDATED' });
assert.equal(model.searchSheetOpen, false, 'logout immediately hides old results');
search.resolve({ ok: true, contacts: [{ id: 'late', name: 'Late result' }] });
await Promise.all([logout, searching]);
assert.equal(model.authenticated, false);
assert.equal(model.contacts.length, 0, 'late results cannot revive a signed-out session');
await actions.reveal('late'); await actions.draft('late');
assert.ok(!calls.includes('CONTACTS_REVEAL') && !calls.includes('EMAIL_DRAFT'));

accountReply = { ok: false, status: 0, error: 'Offline' };
await actions.retryAccount();
assert.equal(model.authenticated, null);
assert.equal(model.accountLoading, false);
assert.equal(model.accountError, 'Offline');
const searchCount = calls.filter(type => type === 'CONTACTS_SEARCH').length;
await actions.search();
assert.equal(calls.filter(type => type === 'CONTACTS_SEARCH').length, searchCount);
accountReply = valid; await actions.retryAccount();
assert.equal(model.authenticated, true, 'successful retry restores the account');
console.log('Extension auth: pending, signed out, preference race, profile gate, sign-in route, logout race and retry passed.');
