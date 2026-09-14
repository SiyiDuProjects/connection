import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = async name => {
  const code = await readFile(new URL(`../extension/${name}`, import.meta.url), 'utf8');
  if (name === 'sidepanel.js' || name === 'service_worker.js') {
    const brand = await readFile(new URL('../extension/brand.js', import.meta.url), 'utf8');
    return brand + '\n' + code.replace("importScripts('brand.js');", '');
  }
  return code;
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const event = () => {
  const listeners = new Set();
  return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn), emit: (...args) => [...listeners].map(fn => fn(...args)) };
};
const job = name => ({ type: 'external_job', companyName: name, jobTitle: `${name} Engineer`, sourceUrl: `https://example.com/jobs/${name}` });

// Native panel follows its window and ignores late replies from the previous tab.
{
 let activeTab=10; const first=deferred(), observations=[];
 const tabs={onActivated:event(),onUpdated:event(),onRemoved:event(),query:async()=>[{id:activeTab}],sendMessage:async id=>id===10?first.promise:{ok:true,pageContext:job(String(id))}};
 const sandbox={window:{},chrome:{tabs,windows:{getCurrent:async()=>({id:1})},runtime:{onMessage:event()}}};
 vm.runInNewContext(await source('sidepanel-context.js'),sandbox);
 const started=sandbox.window.ReachardPanelContext.start(value=>observations.push(value));
 await tick(); activeTab=20; tabs.onActivated.emit({tabId:20,windowId:1}); await tick();
 assert.equal(observations.at(-1).pageContext.companyName,'20');
 first.resolve({ok:true,pageContext:job('10')}); const stop=await started;
 assert.equal(observations.at(-1).pageContext.companyName,'20');
 let count=observations.length; tabs.onActivated.emit({tabId:30,windowId:2}); await tick(); assert.equal(observations.length,count);
 stop(); tabs.onUpdated.emit(20,{status:'complete'}); await tick(); assert.equal(observations.length,count);
}

// Search/reveal results and automatic drafts stay attached to the originating role.
{
  let model, actions, update;
  const search = deferred(), reveal = deferred();
  const calls = [];
  const host = {};
  const document = { getElementById: () => host };
  const chrome = {
    runtime: { id: 'test-extension', onMessage: event(), sendMessage: async message => {
      calls.push(message);
      switch (message.type) {
        case 'GET_EMAIL_CUSTOMIZE': return { ok: true, custom: { tone: 'warm', length: 'concise', goal: 'advice', notes: '' } };
        case 'GET_ACCOUNT_STATUS': return { ok: true, account: { onboarding: { profile: { complete: true } } } };
        case 'CONTACTS_SEARCH': return search.promise;
        case 'CONTACTS_REVEAL': return reveal.promise;
        case 'EMAIL_DRAFT': return { ok: true, subject: 'Hello', body: 'Fixture draft' };
        default: throw new Error(`Unexpected message ${message.type}`);
      }
    } },
    tabs: { create: async () => {} }
  };
  const window = {
    setTimeout, clearTimeout, addEventListener() {},
    ReachardPanelContext: { async start(callback) { update = callback; return () => {}; } },
    ReachardUI: { render(_host, state, handlers) { model = state; actions = handlers; } }
  };
  vm.runInNewContext(await source('sidepanel.js'), { window, document, chrome, URL, console });
  window.ReachardController.start();
  await tick();
  update({ tabId: 10, pageContext: job('A') });
  const searching = actions.search();
  update({ tabId: 20, pageContext: job('B') });
  search.resolve({ ok: true, contacts: [{ id: 'person-a', name: 'A Contact' }] });
  await searching;
  assert.equal(model.pageContext.companyName, 'B');
  assert.equal(model.contacts.length, 0);
  update({ tabId: 10, pageContext: job('A') });
  assert.equal(model.contacts[0].id, 'person-a', 'returning to A restores its completed result');
  const revealing = actions.reveal('person-a');
  update({ tabId: 20, pageContext: job('B') });
  reveal.resolve({ ok: true, email: 'test@example.com' });
  await revealing;
  assert.equal(model.drafts.size, 0, 'B must not display A draft');
  const draftRequest = calls.find(call => call.type === 'EMAIL_DRAFT');
  assert.equal(draftRequest.sourceTabId, 10);
  assert.equal(draftRequest.payload.pageContext.companyName, 'A');
  update({ tabId: 10, pageContext: job('A') });
  assert.equal(model.drafts.get('person-a').body, 'Fixture draft');
  update({ tabId: 30, pending: true });
  assert.equal(model.pageContext, null);
  update({ tabId: 30, pageContext: null });
  assert.equal(model.contextPending, false);
}

// Opening preserves the click gesture; login returns to the originating page.
{
 const opens=[], behavior=[], injections=[], notifications=[];
 const storage={get:async()=>({}),set:async()=>{},remove:async()=>{}};
 const chrome={action:{onClicked:event()},scripting:{insertCSS:async args=>injections.push(['css',args]),executeScript:async args=>injections.push(['js',args])},sidePanel:{setPanelBehavior:async value=>behavior.push(value),open:args=>{opens.push(args);return Promise.resolve();}},runtime:{getURL:path=>'chrome-extension://test/'+path,onInstalled:event(),onStartup:event(),onMessage:event(),onMessageExternal:event(),sendMessage:async message=>notifications.push(message)},storage:{local:storage,sync:storage},tabs:{get:async id=>({id,windowId:1}),sendMessage:async()=>({ok:true,pageContext:job('A')})}};
 const worker={chrome,URL,console,fetch:()=>{throw new Error('No live requests');}};
 vm.runInNewContext(await source('service_worker.js'),worker);
 assert.equal(behavior[0].openPanelOnActionClick,false);
 let response;
 chrome.runtime.onMessage.emit({type:'OPEN_REACHARD_SIDE_PANEL'},{tab:{id:10,windowId:1},frameId:0},value=>response=value);
 assert.equal(opens[0].windowId,1); await tick(); assert.equal(response.ok,true);
 chrome.runtime.onMessage.emit({type:'OPEN_REACHARD_SIDE_PANEL'},{tab:{id:10,windowId:1},frameId:2},value=>response=value);
 assert.equal(response.ok,false); assert.equal(opens.length,1);
 // A toolbar click opens synchronously and injects only if that page has no reader.
 chrome.action.onClicked.emit({id:10,windowId:1,url:'https://example.com/jobs/A'});
 assert.equal(opens.length,2); await tick(); assert.equal(injections.length,0);
 const existingReader=chrome.tabs.sendMessage;
 chrome.tabs.sendMessage=async()=>{throw new Error('No receiving end');};
 chrome.action.onClicked.emit({id:20,windowId:1,url:'https://other.example/jobs/B'});
 assert.equal(opens.length,3); await tick();
 assert.deepEqual(injections.map(item=>item[0]),['css','js']);
 assert.equal(injections[1][1].target.tabId,20);
 assert.deepEqual(Array.from(injections[1][1].files),['brand.js','content.js']);
 assert.equal(notifications.at(-1).tabId,20);
 await worker.activateCurrentPage({id:30,windowId:1,url:'chrome://settings/'});
 assert.equal(injections.length,2,'browser pages must never receive scripts');
 chrome.scripting.executeScript=async()=>{throw new Error('Chrome protected page');};
 await worker.activateCurrentPage({id:40,windowId:1,url:'https://chromewebstore.google.com/'});
 assert.equal(notifications.at(-1).tabId,40,'failed access still clears stale panel state');
 chrome.tabs.sendMessage=existingReader;
 const login=await worker.handleMessage({type:'GET_ACCOUNT_STATUS',sourceTabId:10},{url:chrome.runtime.getURL('sidepanel.html')});
 assert.equal(login.status,401); assert.equal(new URL(login.action.url).searchParams.get('return'),job('A').sourceUrl);
 const signIn=await worker.handleMessage({type:'GET_SIGN_IN_ACTION',sourceTabId:10},{url:chrome.runtime.getURL('sidepanel.html')});
 assert.equal(signIn.action.url,login.action.url);
 for (const type of ['CONTACTS_SEARCH','CONTACTS_REVEAL','EMAIL_DRAFT']) {
   const denied=await worker.handleMessage({type,payload:{}},{});
   assert.equal(denied.status,401,`${type} must reject missing credentials before fetch`);
 }
 const older=deferred(),writes=[];
 worker.setEmailCustomize=async value=>{writes.push(value.tone);if(value.tone==='warm')await older.promise;return{ok:true};};
 const one=worker.handleMessage({type:'SET_EMAIL_CUSTOMIZE',payload:{tone:'warm'}},{});
 const two=worker.handleMessage({type:'SET_EMAIL_CUSTOMIZE',payload:{tone:'direct'}},{});
 await tick(); assert.deepEqual(writes,['warm']);older.resolve();await Promise.all([one,two]);assert.deepEqual(writes,['warm','direct']);
}
console.log('Native side panel context, stale responses, toolbar opening and source login passed.');
