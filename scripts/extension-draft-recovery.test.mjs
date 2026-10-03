import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../extension/brand.js', import.meta.url), 'utf8') + '\n'
  + await readFile(new URL('../extension/sidepanel.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
// Providers without an ID use their array index in the UI; a later search can
// therefore reuse "0" for a different person.
const person = (name, email = `${name.toLowerCase()}@example.com`) => ({ name, email });
const draft = text => ({ ok: true, subject: text, body: `${text} body` });
async function panel(preferences = { ok: true, custom: {} }) {
  let actions, model, update;
  const accountListeners = new Set();
  const lifecycle = new Map();
  const calls = [];
  const replies = {
    CONTACTS_SEARCH: () => ({ ok: true, contacts: [person('Alice')] }),
    CONTACTS_REVEAL: () => ({ ok: true, email: 'alice@example.com' }),
    EMAIL_DRAFT: () => draft('Original'),
  };
  const window = {
    setTimeout, clearTimeout, addEventListener(type, listener) { lifecycle.set(type, listener); }, location: { href: '' },
    ReachardUI: { render(_host, state, handlers) { model = state; actions = handlers; } },
    ReachardPanelContext: { async start(callback) { update = callback; return () => {}; } },
  };
  const chrome = { runtime: { id: 'fixture', onMessage: {
    addListener(listener) { accountListeners.add(listener); }, removeListener(listener) { accountListeners.delete(listener); },
  }, async sendMessage(message) {
    calls.push(message);
    if (message.type === 'GET_ACCOUNT_STATUS') return { ok: true, account: { user: { id: 42 } } };
    if (message.type === 'GET_EMAIL_CUSTOMIZE') return preferences;
    return replies[message.type](message);
  } } };
  vm.runInNewContext(source, { window, document: { getElementById: () => ({}) }, chrome, URL, console });
  window.ReachardController.start(); await tick();
  const context = company => ({ type: 'external_job', companyName: company, sourceUrl: `https://example.com/${company}` });
  update({ tabId: 10, pageContext: context('A') }); await tick();
  await actions.search();
  return { get actions() { return actions; }, get model() { return model; }, calls, replies, window,
    dispose() { lifecycle.get('pagehide')?.(); },
    async authChanged() { await Promise.all([...accountListeners].map(listener => listener({ type: 'ACCOUNT_AUTH_UPDATED' }))); },
    async page(tabId, company) { update({ tabId, pageContext: context(company) }); await tick(); } };
}

test('two generation clicks send one draft request and keep the busy state until it completes', async () => {
  const p = await panel(), response = deferred();
  p.replies.EMAIL_DRAFT = () => response.promise;
  const first = p.actions.draft('0');
  const second = p.actions.draft('0'); await tick();
  const count = p.calls.filter(call => call.type === 'EMAIL_DRAFT').length;
  const busy = p.model.drafting.has('0');
  response.resolve(draft('Generated')); await Promise.all([first, second]);
  assert.equal(count, 1); assert.equal(busy, true);
  assert.equal(p.model.drafting.has('0'), false);
});

test('an edit made while regeneration is pending wins over the late generated text', async () => {
  const p = await panel(); await p.actions.draft('0');
  const response = deferred(); p.replies.EMAIL_DRAFT = () => response.promise;
  const pending = p.actions.draft('0'); await tick();
  p.actions.editDraft('0', { body: 'My unsaved edit' });
  response.resolve(draft('Late')); await pending;
  assert.equal(p.model.drafts.get('0').body, 'My unsaved edit');
});

for (const outcome of ['success', 'failure']) {
  test(`late draft ${outcome} from a replaced result cannot overwrite the new contact's operation`, async () => {
    const p = await panel(), old = deferred(), fresh = deferred();
    p.replies.EMAIL_DRAFT = () => old.promise;
    const first = p.actions.draft('0'); await tick();
    p.replies.CONTACTS_SEARCH = () => ({ ok: true, contacts: [person('Bob')] });
    await p.actions.search();
    p.replies.EMAIL_DRAFT = () => fresh.promise;
    const second = p.actions.draft('0'); await tick();
    old.resolve(outcome === 'success' ? draft('Alice') : { ok: false, status: 503, error: 'Old failure' });
    await first;
    const busy = p.model.drafting.has('0'), stale = p.model.drafts.get('0'), error = p.model.error;
    fresh.resolve(draft('Bob')); await second;
    assert.equal(stale, undefined); assert.equal(error, ''); assert.equal(busy, true);
    p.actions.openMail('0');
    const mail = new URL(p.window.location.href);
    assert.equal(decodeURIComponent(mail.pathname), 'bob@example.com');
    assert.equal(mail.searchParams.get('subject'), 'Bob');
  });
}

test('late email reveal cannot attach Alice\'s address or start a draft for a replacement contact', async () => {
  const p = await panel(), response = deferred();
  p.replies.CONTACTS_SEARCH = () => ({ ok: true, contacts: [person('Alice', '')] });
  await p.actions.search();
  p.replies.CONTACTS_REVEAL = () => response.promise;
  const pending = p.actions.reveal('0'); await tick();
  p.replies.CONTACTS_SEARCH = () => ({ ok: true, contacts: [person('Bob', '')] });
  await p.actions.search();
  response.resolve({ ok: true, email: 'alice@example.com' }); await pending;
  assert.equal(p.model.revealed.size, 0);
  assert.equal(p.calls.filter(call => call.type === 'EMAIL_DRAFT').length, 0);
});

test('failed search preserves the existing contacts and edited draft', async () => {
  const p = await panel(); await p.actions.draft('0');
  p.actions.editDraft('0', { body: 'Keep my work' });
  p.replies.CONTACTS_SEARCH = () => ({ ok: false, status: 503, error: 'Search unavailable' });
  await p.actions.search();
  assert.equal(p.model.contacts[0]?.name, 'Alice');
  assert.equal(p.model.drafts.get('0')?.body, 'Keep my work');
  assert.equal(p.model.loading, false); assert.equal(p.model.error, 'Search unavailable');
});

test('replacing results while preferences are saving cancels the queued generation before dispatch', async () => {
  const p = await panel(), saved = deferred();
  p.replies.SET_EMAIL_CUSTOMIZE = () => saved.promise;
  p.actions.customize({ tone: 'formal', length: 'concise', goal: 'advice', notes: '' });
  const pending = p.actions.draft('0'); await tick();
  p.replies.CONTACTS_SEARCH = () => ({ ok: true, contacts: [person('Bob')] });
  await p.actions.search();
  saved.resolve({ ok: true }); await pending;
  assert.equal(p.calls.filter(call => call.type === 'EMAIL_DRAFT').length, 0);
  assert.equal(p.model.drafting.size, 0);
});

test('a queued draft retains the role selected when generation was requested', async () => {
  const p = await panel(), saved = deferred();
  p.replies.SET_EMAIL_CUSTOMIZE = () => saved.promise;
  p.actions.manualRole('Original role');
  p.actions.customize({ tone: 'formal', length: 'concise', goal: 'advice', notes: '' });
  const pending = p.actions.draft('0'); await tick();
  p.actions.manualRole('Later role');
  saved.resolve({ ok: true }); await pending;
  const request = p.calls.find(call => call.type === 'EMAIL_DRAFT');
  assert.equal(request.payload.pageContext.jobTitle, 'Original role');
});

test('a failed generation releases its busy flag and can be retried', async () => {
  const p = await panel();
  p.replies.EMAIL_DRAFT = () => ({ ok: false, status: 503, error: 'Temporarily unavailable' });
  await p.actions.draft('0');
  assert.equal(p.model.drafting.size, 0);
  assert.equal(p.model.drafts.size, 0);
  p.replies.EMAIL_DRAFT = () => draft('Recovered');
  await p.actions.draft('0');
  assert.equal(p.model.drafts.get('0').subject, 'Recovered');
  assert.equal(p.model.error, '');
});

test('duplicate search clicks share the active search instead of racing replacements', async () => {
  const p = await panel(), response = deferred();
  const before = p.calls.filter(call => call.type === 'CONTACTS_SEARCH').length;
  p.replies.CONTACTS_SEARCH = () => response.promise;
  const first = p.actions.search(), second = p.actions.search(); await tick();
  const count = p.calls.filter(call => call.type === 'CONTACTS_SEARCH').length - before;
  response.resolve({ ok: true, contacts: [person('Bob')] }); await Promise.all([first, second]);
  assert.equal(count, 1); assert.equal(p.model.contacts[0].name, 'Bob');
});

test('a canceled search completion cannot clear the busy state of the replacement session search', async () => {
  const p = await panel(), old = deferred(), fresh = deferred();
  p.replies.CONTACTS_SEARCH = () => old.promise;
  const first = p.actions.search(); await tick();
  await p.authChanged();
  p.replies.CONTACTS_SEARCH = () => fresh.promise;
  const second = p.actions.search(); await tick();
  old.resolve({ ok: true, contacts: [person('Old account')] }); await first;
  const busy = p.model.loading;
  fresh.resolve({ ok: true, contacts: [person('Current account')] }); await second;
  assert.equal(busy, true);
  assert.equal(p.model.contacts[0].name, 'Current account');
});

test('draft completion stays with its original page when switching contacts in another tab', async () => {
  const p = await panel(), response = deferred();
  p.replies.EMAIL_DRAFT = () => response.promise;
  const pending = p.actions.draft('0'); await tick();
  await p.page(20, 'B');
  response.resolve(draft('For A')); await pending;
  assert.equal(p.model.drafts.size, 0);
  await p.page(10, 'A');
  assert.equal(p.model.drafts.get('0').subject, 'For A');
});

for (const outcome of ['success', 'transport failure', 'API failure']) {
  test(`late preference ${outcome} cannot replace newer saved settings after a tab change`, async () => {
    const response = deferred(), p = await panel(response.promise);
    const latest = { tone: 'formal', length: 'detailed', goal: 'referral', notes: '' };
    p.replies.SET_EMAIL_CUSTOMIZE = message => ({ ok: true, custom: message.payload });
    p.actions.customize(latest);
    assert.equal(await p.actions.save(), true);
    await p.page(20, 'B');
    if (outcome === 'transport failure') response.reject(new Error('Old transport failure'));
    else response.resolve(outcome === 'success' ? { ok: true, custom: { tone: 'warm' } } : { ok: false, status: 503, error: 'Old API failure' });
    await tick();
    assert.deepEqual({ ...p.model.emailCustomize }, latest);
    assert.equal(p.model.customizeError, '');
    assert.equal(p.model.accountError, '');
    assert.equal(await p.actions.save(), true);
    assert.equal(p.calls.filter(call => call.type === 'SET_EMAIL_CUSTOMIZE').length, 1);
  });
}

test('a current preference transport failure is a preference error and keeps the current values', async () => {
  const response = deferred(), p = await panel(response.promise);
  const previous = p.model.emailCustomize;
  response.reject(new Error('Preferences unavailable')); await tick();
  assert.equal(p.model.customizeError, 'Preferences unavailable');
  assert.equal(p.model.accountError, '');
  assert.equal(p.model.authenticated, true);
  assert.equal(p.model.emailCustomize, previous);
});

for (const outcome of ['success', 'failure']) {
  test(`a disposed panel ignores a late preference ${outcome}`, async () => {
    const response = deferred(), p = await panel(response.promise);
    const previous = p.model.emailCustomize;
    p.dispose();
    if (outcome === 'failure') response.reject(new Error('Late failure after close'));
    else response.resolve({ ok: true, custom: { tone: 'formal' } });
    await tick();
    assert.equal(p.model.emailCustomize, previous);
    assert.equal(p.model.customizeError, '');
    assert.equal(p.model.accountError, '');
  });
}
