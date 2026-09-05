import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the shipped queue with deliberately delayed responses.
const source = await readFile(new URL('../extension/sidepanel.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function saveCustomizeFromPanel()');
const end = source.indexOf('  function normalizeCustomize(', start);
assert.ok(start >= 0 && end > start);
const api = vm.runInNewContext(`(() => {
  let customizeTimer, customizeSave = null, customizeRevision = 0, savedCustomizeRevision = 0, disposed = false;
  const state = {emailCustomize: {tone:'warm'}, customizeError:''};
  const pending = [];
  const normalizeCustomize = value => ({...value});
  const renderPanel = () => {};
  const t = value => value;
  const sendRuntimeMessage = message => new Promise(resolve => pending.push({message,resolve}));
  ${source.slice(start,end)}
  return {state, pending, save: saveCustomizeFromPanel,
    change(tone) { state.emailCustomize = {tone}; customizeRevision++; return saveCustomizeFromPanel(); }
  };
})()`, {window:{clearTimeout(){}}});

const first = api.change('direct');
const latest = api.change('formal');
assert.equal(api.pending.length, 1, 'writes must be serialized');
api.pending[0].resolve({ok:true,custom:{tone:'direct'}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(api.pending.length, 2, 'latest change must be written after the first response');
assert.equal(api.pending[1].message.payload.tone, 'formal');
assert.equal(api.state.emailCustomize.tone, 'formal', 'old response must not roll back the UI');
api.pending[1].resolve({ok:true,custom:{tone:'formal'}});
assert.equal(await first, true);
assert.equal(await latest, true);
assert.equal(api.state.customizeError, '');
await api.save();
assert.equal(api.pending.length, 2, 'clean settings must not create another save');

const failed = api.change('confident');
api.pending[2].resolve({ok:false,error:'Offline'});
assert.equal(await failed, false, 'draft generation must receive a failed flush');
assert.equal(api.state.emailCustomize.tone, 'confident');
assert.equal(api.state.customizeError, 'Offline');
const retry = api.save();
assert.equal(api.pending[3].message.payload.tone, 'confident');
api.pending[3].resolve({ok:true,custom:{tone:'confident'}});
assert.equal(await retry, true);
assert.equal(api.state.customizeError, '');
console.log('Autosave: serialized writes, latest selection, clean no-op, failure and retry passed.');
