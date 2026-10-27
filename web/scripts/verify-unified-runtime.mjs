// Real production Next.js HTTP boundary with a disposable PostgreSQL-compatible
// database and mock providers. Never inherit runtime secrets or call paid APIs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, cp, access } from 'node:fs/promises';
import { once } from 'node:events';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { SignJWT } from 'jose';
import { keepProtocolMessagesTogether } from './local-test-protocol.mjs';

const source=fileURLToPath(new URL('..',import.meta.url));
const build=path.resolve(process.argv[2]||source);
const standalone=path.join(build,'.next/standalone');
await access(path.join(standalone,'server.js'));
await cp(path.join(build,'.next/static'),path.join(standalone,'.next/static'),{recursive:true});
await cp(path.join(build,'public'),path.join(standalone,'public'),{recursive:true});
async function freePort() {
  const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
const db=new PGlite();
const migrations=path.join(source,'lib/db/migrations');
const journal=JSON.parse(await readFile(path.join(migrations,'meta/_journal.json'),'utf8'));
for(const entry of journal.entries)await db.exec(await readFile(path.join(migrations,entry.tag+'.sql'),'utf8'));
await db.exec(`INSERT INTO users (id,email,password_hash,email_verified_at,name) VALUES
 (1,'runtime@example.test','unused',now(),'Runtime Test'),(2,'unverified@example.test','unused',null,'Unverified');
 INSERT INTO teams (id,name) VALUES (1,'Runtime Test');
 INSERT INTO team_members (user_id,team_id,role) VALUES (1,1,'owner');
 INSERT INTO user_settings (user_id,school,sender_profile) VALUES (1,'Test School','Test profile');`);
const token='fc_'+randomBytes(32).toString('base64url');
await db.query('INSERT INTO extension_api_tokens (user_id,token_hash) VALUES (1,$1)',[createHash('sha256').update(token).digest('hex')]);
const dbPort=await freePort(),port=await freePort(),base=`http://127.0.0.1:${port}`;
const socket=new PGLiteSocketServer({db,host:'127.0.0.1',port:dbPort,maxConnections:20});
keepProtocolMessagesTogether(socket,db);await socket.start();
const secret=randomBytes(48).toString('hex');
const env={PATH:process.env.PATH,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',
  HOSTNAME:'127.0.0.1',PORT:String(port),REACHARD_CONTACTS_ENABLED:'1',REACHARD_TRUST_CLOUDFLARE_PROXY:'0',
  POSTGRES_URL:`postgresql://postgres@127.0.0.1:${dbPort}/postgres`,AUTH_SECRET:secret,
  BASE_URL:'https://reachard.co',WEB_BASE_URL:'https://reachard.co',ALLOWED_WEB_ORIGINS:'https://reachard.co',
  ALLOWED_EXTENSION_ORIGINS:'chrome-extension://ladoemfclhhepfomibkdblodgnhceefm',
  CONTACT_PROVIDER:'mock',APOLLO_MOCK:'true',BETA_UNLIMITED_USAGE:'false',
  STRIPE_SECRET_KEY:'sk_test_disabled',STRIPE_WEBHOOK_SECRET:'whsec_disabled',PROVIDER_DAILY_BUDGET_USD:''};
const child=spawn(process.execPath,[path.join(standalone,'server.js')],{cwd:standalone,env,stdio:['ignore','pipe','pipe']});
let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-20000);});
let checks=0;
async function check(name,fn) {await fn();checks++;console.log(`ok ${checks} - ${name}`);}
const auth={authorization:`Bearer ${token}`,'content-type':'application/json'};
async function request(route,init={}) {
  // Node's fetch replaces Host; use the actual HTTP transport for tunnel-host tests.
  if(init.headers?.host)return new Promise((resolve,reject)=>{
    const req=http.request(base+route,{method:init.method||'GET',headers:init.headers},res=>{
      const parts=[];res.on('data',part=>parts.push(part));res.on('end',()=>resolve(new Response(Buffer.concat(parts),{status:res.statusCode,headers:res.headers})));
    });req.on('error',reject);req.setTimeout(20000,()=>req.destroy(new Error('HTTP fixture timeout')));req.end(init.body);
  });
  return fetch(base+route,{...init,signal:AbortSignal.timeout(20000)});
}
async function post(route,body,key) {return request(route,{method:'POST',headers:{...auth,'idempotency-key':key},body:JSON.stringify(body)});}
try {
  for(let attempt=0;attempt<80;attempt++) {
    if(child.exitCode!==null)throw new Error('Standalone exited: '+output);
    if(await request('/live').then(r=>r.ok).catch(()=>false))break;
    if(attempt===79)throw new Error('Standalone startup timed out: '+output);
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  await check('standalone website and API readiness',async()=>{
    assert.equal((await request('/')).status,200);assert.equal((await request('/sign-in')).status,200);
    const health=await request('/health');assert.equal(health.status,200,await health.clone().text());assert.equal((await health.json()).ready,true);
  });
  await check('website redirects keep the public HTTPS origin behind the tunnel',async()=>{
    for(const [route,target] of [['/dashboard','/sign-in'],['/verify-email/confirm','/verify-email'],['/api/stripe/checkout','/pricing']]) {
      const res=await request(route,{headers:{host:'reachard.co','x-forwarded-host':'reachard.co','x-forwarded-proto':'https'},redirect:'manual'});
      const location=new URL(res.headers.get('location'));
      assert.equal(location.origin,'https://reachard.co',route+' redirects to '+location.href);assert.equal(location.pathname,target);
    }
  });
  await check('legacy hostname and explicit account endpoint require extension authentication',async()=>{
    const res=await request('/api/account',{headers:{host:'contacts.reachard.co'}});assert.equal(res.status,401);
    assert.ok((await res.json()).action.url.endsWith('/connect-extension'));
    assert.equal((await request('/api/extension/account')).status,401);
  });
  await check('extension preflight and disallowed origin',async()=>{
    const origin=env.ALLOWED_EXTENSION_ORIGINS;
    const good=await request('/api/contacts/search',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}});
    assert.equal(good.status,204);assert.equal(good.headers.get('access-control-allow-origin'),origin);
    assert.equal((await request('/api/contacts/search',{method:'OPTIONS',headers:{origin:'https://evil.example'}})).status,403);
  });
  await check('cookie website contract and Bearer extension contract coexist',async()=>{
    const jwt=await new SignJWT({user:{id:1,sessionVersion:0},expires:new Date(Date.now()+3600000).toISOString()})
      .setProtectedHeader({alg:'HS256'}).setExpirationTime('1h').sign(new TextEncoder().encode(secret));
    const web=await request('/api/account',{headers:{cookie:`session=${jwt}`}});
    assert.equal(web.status,200,await web.clone().text());assert.ok((await web.json()).extension);
    const extension=await request('/api/account',{headers:auth});assert.equal(extension.status,200,await extension.clone().text());
    const data=await extension.json();assert.equal(data.credits.remaining,3);assert.ok(data.user);
  });
  await check('search runs through compiled route and replays the same request',async()=>{
    const body={companyName:'Example',companyDomain:'example.test'};
    const first=await post('/api/contacts/search',body,'search-1');assert.equal(first.status,200,await first.clone().text());
    assert.equal((await first.json()).contacts.length,3);
    const again=await post('/api/contacts/search',body,'search-1');assert.equal((await again.json()).idempotentReplay,true);
    assert.equal((await post('/api/contacts/search',{companyName:'Different'},'search-1')).status,409);
  });
  await check('validation failures release claims instead of remaining processing',async()=>{
    assert.equal((await post('/api/contacts/search',{},'invalid-1')).status,400);
    assert.equal((await post('/api/contacts/search',{},'invalid-1')).status,400);
    const rows=(await db.query("select status from api_idempotency_keys where idempotency_key='invalid-1'")).rows;
    assert.equal(rows[0].status,'failed');
  });
  const contact={name:'Jane Doe',companyName:'Example',companyDomain:'example.test',id:'mock-jane'};
  await check('reveal charges once; replay and reopening do not charge again',async()=>{
    const first=await post('/api/contacts/reveal',{contact},'reveal-1');assert.equal(first.status,200,await first.clone().text());
    contact.email=(await first.json()).email;assert.ok(contact.email.endsWith('@example.test'));
    assert.equal((await (await post('/api/contacts/reveal',{contact:{...contact,email:undefined}},'reveal-1')).json()).idempotentReplay,true);
    assert.equal((await post('/api/contacts/reveal',{contact},'reopen-1')).status,200);
    assert.equal((await (await request('/api/account',{headers:auth})).json()).credits.remaining,2);
  });
  await check('draft uses the safe local template without paid calls',async()=>{
    const res=await post('/api/email/draft',{contact,pageContext:{companyName:'Example'}},'draft-1');assert.equal(res.status,200,await res.clone().text());
    const data=await res.json();assert.equal(data.ai.provider,'template');assert.ok(data.mailtoUrl.startsWith('mailto:'));
  });
  await check('compressed, oversized and malformed bodies are rejected',async()=>{
    const compressed=await request('/api/contacts/search',{method:'POST',headers:{...auth,'content-encoding':'gzip'},body:'{}'});assert.equal(compressed.status,415);
    const oversized=await post('/api/contacts/search',{companyName:'x'.repeat(70000)},'oversized');assert.equal(oversized.status,413);
    const invalid=await request('/api/contacts/search',{method:'POST',headers:auth,body:'{'});assert.equal(invalid.status,400);
  });
  await check('old connection links redirect to the canonical website',async()=>{
    const res=await request('/connect-extension?extensionId=test',{headers:{host:'contacts.reachard.co'},redirect:'manual'});
    assert.equal(res.status,302);assert.equal(res.headers.get('location'),'https://reachard.co/connect-extension?extensionId=test');
  });
  await check('revoked and unverified credentials fail in the shared verifier',async()=>{
    await db.exec('UPDATE users SET email_verified_at=null WHERE id=1');assert.equal((await request('/api/account',{headers:auth})).status,401);
    await db.exec('UPDATE users SET email_verified_at=now() WHERE id=1;UPDATE extension_api_tokens SET revoked_at=now()');
    assert.equal((await request('/api/extension/account',{headers:auth})).status,401);
  });
  console.log(JSON.stringify({ok:true,checks,paidProviderCalls:0,database:'disposable PGlite',runtime:'Next.js production standalone'}));
} catch(error) {console.error(output);throw error;}
finally {
  // pglite-socket 0.2.11 stop() does not await handler.detach(). Drain those
  // operations before closing the database, including protocol rollback work.
  await Promise.all([...socket.handlers].map(handler=>handler.detach(true)));
  await socket.stop();
  const exited=child.exitCode===null?once(child,'exit'):Promise.resolve();child.kill('SIGTERM');
  const force=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(force);
  await db.close();
}
