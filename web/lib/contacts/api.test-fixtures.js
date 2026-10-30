import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createContactsApi} from './api.js';

function fixture(env={}) {
  let auth=0;
  const api=createContactsApi({env:{NODE_ENV:'production',BASE_URL:'https://reachard.co',CONTACT_PROVIDER:'mock',...env},
    authenticate:async()=>{auth++;return null;},providers:{},
    account:{isAccountDbConfigured:()=>true,checkAccountDb:async()=>{if(env.MISSING_SCHEMA)throw Error('schema');}},checkBudget:async()=>({enabled:false})});
  return {api,auth:()=>auth};
}

test('extension CORS preflights do not authenticate or invoke business operations',async()=>{
 const f=fixture();
 const origin='chrome-extension://ladoemfclhhepfomibkdblodgnhceefm';
 const r=await f.api(new Request('https://contacts.reachard.co/api/contacts/search',{method:'OPTIONS',headers:{origin}}),'contacts.search');
 assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
 assert.match(r.headers.get('access-control-allow-headers'),/Idempotency-Key/);assert.equal(f.auth(),0);
});

test('untrusted origins and extensions outside the configured allowlist fail before authentication',async()=>{
 const f=fixture({ALLOWED_EXTENSION_ORIGINS:'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});
 for(const origin of ['https://attacker.invalid','chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','http://localhost:3000']){
   const r=await f.api(new Request('https://contacts.reachard.co/api/account',{headers:{origin,authorization:'Bearer secret'}}),'account');
   assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);
 }
 assert.equal(f.auth(),0);
});

test('malformed request metadata cannot alter response headers and responses cannot be cached',async()=>{
 const f=fixture();
 const r=await f.api(new Request('https://contacts.reachard.co/api/account',{headers:{'x-request-id':'x'.repeat(300)}}),'account');
 assert.equal(r.status,401);assert.ok(r.headers.get('x-request-id').length<120);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal((await r.json()).action.url,'https://reachard.co/connect-extension');
});

test('health fails when required migrations are unavailable',async()=>{
 const {api}=fixture({MISSING_SCHEMA:true});
 const r=await api(new Request('https://contacts.reachard.co/health'),'health');
 assert.equal(r.status,503);assert.deepEqual((await r.json()).issues,['account_database_unavailable']);
});

test('only the explicitly trusted Cloudflare header partitions anonymous clients',async()=>{
 const {api}=fixture({REACHARD_TRUST_CLOUDFLARE_PROXY:'1',RATE_LIMIT_UNAUTHENTICATED_MAX:'1'});
 const req=(address,forwarded)=>new Request('https://reachard.co/api/account',{headers:{'cf-connecting-ip':address,'x-forwarded-for':forwarded}});
 assert.equal((await api(req('192.0.2.1','198.51.100.1'),'account')).status,401);
 assert.equal((await api(req('192.0.2.1','198.51.100.2'),'account')).status,429);
 assert.equal((await api(req('192.0.2.2','198.51.100.1'),'account')).status,401);
});
