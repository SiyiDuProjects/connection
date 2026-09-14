import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bridgeSource = await readFile(new URL('../extension/web_bridge.js', import.meta.url), 'utf8');
const calls = [], replies = [];
let listener;
const window = {
  location: { origin: 'https://reachard.co' },
  addEventListener(type, handler) { if (type === 'message') listener = handler; },
  removeEventListener() {},
  postMessage(message, origin) { replies.push({ message, origin }); }
};
const chrome = { runtime: { id: 'fixture', sendMessage(message, callback) { calls.push(message); callback({ ok: true }); } } };
vm.runInNewContext(bridgeSource, { window, chrome });
const request = type => ({ source: window, data: { source: 'reachard-web', id: 'fixture-request', type, payload: {} } });
for (const type of ['CONTACTS_SEARCH', 'CONTACTS_REVEAL', 'EMAIL_DRAFT', 'SET_EMAIL_CUSTOMIZE']) {
  listener(request(type));
  assert.equal(calls.length, 0, `${type} must not pass through the account website bridge`);
  assert.equal(replies.at(-1).message.response.ok, false);
}
listener({ ...request('GET_EXTENSION_SESSION_STATUS'), source: {} });
assert.equal(calls.length, 0, 'another window/frame must not control the bridge');
for (const type of ['GET_EXTENSION_SESSION_STATUS', 'CONNECT_EXTENSION_TOKEN', 'CLEAR_EXTENSION_SESSION', 'GET_EXTENSION_LANGUAGE', 'SET_EXTENSION_LANGUAGE']) {
  listener(request(type));
  assert.equal(calls.at(-1).type, type, 'supported session flows must remain available');
  assert.equal(replies.at(-1).origin, 'https://reachard.co', 'responses must stay on the current website origin');
}

const workerSource = await readFile(new URL('../extension/service_worker.js', import.meta.url), 'utf8');
const event = { addListener() {} };
const workerContext = vm.createContext({
  importScripts() {}, ReachardBrand: { name: 'Reachard' }, URL, console,
  chrome: { action: { onClicked: event }, sidePanel: { setPanelBehavior: () => Promise.resolve() }, runtime: { onInstalled: event, onStartup: event, onMessage: event, onMessageExternal: event } }
});
vm.runInContext(workerSource, workerContext);
const allowed = url => vm.runInContext(`isAllowedWebsite(${JSON.stringify(url)})`, workerContext);
for (const origin of ['https://reachard.co', 'https://www.reachard.co', 'http://localhost:3000', 'http://127.0.0.1:3000']) assert.equal(allowed(`${origin}/sign-in`), true);
for (const origin of ['https://contacts.reachard.co', 'https://reachard.co.attacker.example', 'http://reachard.co', 'https://attacker.example']) assert.equal(allowed(`${origin}/sign-in`), false);
const rejection = await vm.runInContext(`handleExternalMessage({ type: 'CONNECT_EXTENSION_TOKEN', payload: {} }, { url: 'https://contacts.reachard.co/' })`, workerContext);
assert.equal(rejection.ok, false);
assert.equal(rejection.error, 'Website origin is not allowed.');
const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
assert.ok(manifest.host_permissions.includes('https://contacts.reachard.co/*'), 'the contact API still needs network access');
assert.ok(!manifest.externally_connectable.matches.includes('https://contacts.reachard.co/*'), 'the API domain must not become an account-control website');
console.log('Extension bridge: session allowlist, business-message rejection, source-window isolation, and exact trusted account origins passed.');
