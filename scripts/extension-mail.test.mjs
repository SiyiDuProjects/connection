import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

test('edited email survives reopening and mail app receives the current text', async () => {
  let actions, model;
  const host = {};
  const contact = {id:'test-person',name:'Test Person',email:'person@example.com'};
  const context = {type:'external_job',companyName:'Example',sourceUrl:'https://example.com/job'};
  const sandbox = {
    URL, setTimeout, clearTimeout, console,
    location: {href:''},
    document: {getElementById:()=>host},
    addEventListener(){},
    ReachardUI:{render(_host,state,callbacks){model=state;actions=callbacks;}},
    ReachardPanelContext:{async start(callback){callback({tabId:10,pageContext:context});return()=>{};}},
    chrome:{runtime:{id:'test',onMessage:{addListener(){},removeListener(){}},async sendMessage(message){
      if(message.type==='GET_EMAIL_CUSTOMIZE')return{ok:true,custom:{tone:'warm',length:'concise',goal:'advice',notes:''}};
      if(message.type==='GET_ACCOUNT_STATUS')return{ok:true,account:{}};
      if(message.type==='CONTACTS_SEARCH')return{ok:true,contacts:[contact]};
      if(message.type==='EMAIL_DRAFT')return{ok:true,subject:'Original',body:'Original body',mailtoUrl:'mailto:person@example.com?subject=Original'};
      throw new Error(`Unexpected ${message.type}`);
    }}}
  };
  sandbox.window=sandbox;
  vm.runInNewContext(await readFile(new URL('../extension/sidepanel.js',import.meta.url),'utf8'),sandbox);
  sandbox.ReachardController.start();
  await new Promise(setImmediate);
  await actions.search();
  await actions.draft(contact.id);
  actions.editDraft(contact.id,{subject:'Robotics & data?',body:'Hi Test,\nA + B = better.\n谢谢'});
  actions.showResults(false);
  actions.showResults(true);
  assert.equal(model.drafts.get(contact.id).subject,'Robotics & data?');
  assert.equal(sandbox.location.href,'','editing must not send or open an email');
  actions.openMail(contact.id);
  const mail=new URL(sandbox.location.href);
  assert.equal(decodeURIComponent(mail.pathname),'person@example.com');
  assert.equal(mail.searchParams.get('subject'),'Robotics & data?');
  assert.equal(mail.searchParams.get('body'),'Hi Test,\nA + B = better.\n谢谢');
});
