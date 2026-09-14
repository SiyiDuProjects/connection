import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const tick = () => new Promise(resolve => setImmediate(resolve));
const event = () => {
  const listeners = new Set();
  return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn), emit: (...args) => [...listeners].map(fn => fn(...args)) };
};
const pageContext = { type: 'external_job', companyName: 'Example', jobTitle: 'Engineer', sourceUrl: 'https://example.com/jobs/engineer' };
let model, actions, update;
let accountResponse = { ok: true, account: { subscription: { planName: 'Plus' }, onboarding: { profile: { complete: true } }, credits: { remaining: 0, unlimited: true } } };
const calls = [];
const chrome = {
  runtime: { id: 'fixture-extension', onMessage: event(), async sendMessage(message) {
    calls.push(message);
    if (message.type === 'GET_EMAIL_CUSTOMIZE') return { ok: true, custom: { tone: 'warm', length: 'concise', goal: 'advice', notes: '' } };
    if (message.type === 'GET_ACCOUNT_STATUS') return accountResponse;
    if (message.type === 'CONTACTS_SEARCH') return { ok: true, contacts: [{ id: 'contact-1', name: 'Example Person' }] };
    if (message.type === 'CONTACTS_REVEAL') return { ok: true, email: 'person@example.com', credits: { remaining: 0, unlimited: true } };
    if (message.type === 'EMAIL_DRAFT') return { ok: true, subject: 'Hello', body: 'Fixture draft' };
    throw new Error(`Unexpected fixture message: ${message.type}`);
  } },
  tabs: { async create() {} }
};
const window = {
  setTimeout, clearTimeout, addEventListener() {},
  ReachardPanelContext: { async start(callback) { update = callback; return () => {}; } },
  ReachardUI: { render(_host, state, handlers) { model = state; actions = handlers; } }
};
const brand = await readFile(new URL('../extension/brand.js', import.meta.url), 'utf8');
const controller = await readFile(new URL('../extension/sidepanel.js', import.meta.url), 'utf8');
vm.runInNewContext(`${brand}\n${controller}`, { window, document: { getElementById: () => ({}) }, chrome, URL, console });
window.ReachardController.start();
await tick();
assert.equal(model.creditsUnlimited, true);
assert.equal(model.creditsRemaining, 0);
update({ tabId: 10, pageContext });
await tick();
await actions.search();
assert.equal(model.contacts.length, 1, 'unlimited membership with numeric zero must still search');
await actions.reveal('contact-1');
assert.equal(model.creditsUnlimited, true);
assert.ok(model.drafts.has('contact-1'), 'unlimited zero balance must permit reveal and draft');
assert.equal(calls.filter(call => call.type === 'CONTACTS_REVEAL').length, 1);

accountResponse.account.credits = { remaining: 50, unlimited: false };
await actions.retryAccount();
assert.equal(model.creditsUnlimited, false, 'switching to limited Base removes the Unlimited label');
assert.equal(model.creditsRemaining, 50);
accountResponse.account.credits = { remaining: 60, unlimited: false };
await actions.retryAccount();
assert.equal(model.creditsUnlimited, false, 'legacy Plus is not inferred unlimited from its plan name');
assert.equal(model.creditsRemaining, 60);
accountResponse.account.credits = { remaining: null };
await actions.retryAccount();
assert.equal(model.creditsRemaining, null, 'a full account refresh with unknown balance must not retain a stale number or invent zero');
assert.equal(model.creditsUnlimited, false);
accountResponse.account.credits = { remaining: 0, unlimited: true };
await actions.retryAccount();
update({ tabId: 20, pageContext: { ...pageContext, sourceUrl: 'https://example.com/jobs/designer' } });
await tick();
assert.equal(model.creditsUnlimited, true, 'tab changes preserve the effective account entitlement');
accountResponse = { ok: false, status: 401, error: 'Sign in' };
await actions.retryAccount();
assert.equal(model.authenticated, false);
assert.equal(model.creditsRemaining, null);
assert.equal(model.creditsUnlimited, false, 'signing out clears unlimited access from cached state');
assert.equal(model.contacts.length, 0);
console.log('Extension quota fixtures passed: unlimited zero, Base50, legacy Plus60, unknown quota, tab changes and sign-out.');
