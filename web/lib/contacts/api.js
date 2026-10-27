import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { publicError } from './http.js';
import { createRateLimiter, createProviderUsageGuard } from './usage-guard.js';
import { createContactsService } from './service.js';
import { positiveIntegerEnv, webBaseUrl, providerStatus, configurationIssues } from './configuration.js';
import { isBetaUnlimitedUsage } from './membership-policy.js';

export async function readJsonBody(request, {maxBytes=65536,timeoutMs=10000}={}) {
  const encoding=request.headers.get('content-encoding');
  if (encoding && encoding.toLowerCase()!=='identity') throw publicError('Compressed request bodies are not supported.',415);
  const type=(request.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase();
  if (type!=='application/json') throw publicError('Content-Type must be application/json.',415);
  if (Number(request.headers.get('content-length')||0)>maxBytes) throw publicError('Request body is too large.',413);
  if (!request.body) return {};
  const reader=request.body.getReader();
  let timeout,abort;
  const interrupted=new Promise((_,reject)=>{
    const stop=error=>{ void reader.cancel().catch(()=>{}); reject(error); };
    timeout=setTimeout(()=>stop(publicError('Request body timed out.',408)),timeoutMs);
    abort=()=>stop(publicError('Request was canceled.',400));
    request.signal.addEventListener('abort',abort,{once:true});
    if(request.signal.aborted) abort();
  });
  try {
    const bytes=await Promise.race([(async()=>{
      const chunks=[];let length=0;
      while(true) {
        const {value,done}=await reader.read();
        if(done)break;
        length+=value.byteLength;
        if(length>maxBytes) {void reader.cancel().catch(()=>{});throw publicError('Request body is too large.',413);}
        chunks.push(value);
      }
      return Buffer.concat(chunks,length);
    })(),interrupted]);
    if(!bytes.length)return {};
    let parsed;
    try {parsed=JSON.parse(bytes.toString('utf8'));} catch {throw publicError('Invalid JSON request body.',400);}
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw publicError('JSON body must be an object.',400);
    return parsed;
  } finally {clearTimeout(timeout);request.signal.removeEventListener('abort',abort);reader.releaseLock();}
}

export function corsHeaders(request, env=process.env) {
  const origin=request.headers.get('origin');
  const headers={'Vary':'Origin'};
  if(!origin)return headers;
  const configured=[env.ALLOWED_WEB_ORIGINS,env.WEB_BASE_URL,env.BASE_URL].filter(Boolean).flatMap(v=>v.split(','));
  const webOrigins=configured.flatMap(v=>{try{return [new URL(v.trim()).origin];}catch{return [];}});
  if(env.NODE_ENV!=='production')webOrigins.push('http://localhost:3000','http://127.0.0.1:3000','http://localhost:8787','http://127.0.0.1:8787');
  const extensions=[env.ALLOWED_EXTENSION_ORIGINS,env.EXTENSION_ORIGIN].filter(Boolean).flatMap(v=>v.split(',')).map(v=>v.trim()).filter(Boolean);
  const extension=/^chrome-extension:\/\/[a-p]{32}$/.test(origin)&&(!extensions.length||extensions.includes(origin));
  if(!webOrigins.includes(origin)&&!extension)throw publicError('Origin not allowed.',403);
  return {...headers,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Authorization,Content-Type,Idempotency-Key,X-Request-ID',
    'Access-Control-Expose-Headers':'X-Request-ID,Retry-After'};
}

export function createContactsApi({account,providers,authenticate,checkBudget,env=process.env,log=()=>{}}) {
  const number=(name,fallback)=>positiveIntegerEnv(env,name,fallback);
  const limit=createRateLimiter({windowMs:number('RATE_LIMIT_WINDOW_MS',60000),max:number('RATE_LIMIT_MAX',60)});
  const anonymous=createRateLimiter({windowMs:number('RATE_LIMIT_WINDOW_MS',60000),max:number('RATE_LIMIT_UNAUTHENTICATED_MAX',60)});
  const providerUsage=createProviderUsageGuard({userConcurrency:number('PROVIDER_USER_CONCURRENCY',2),
    globalConcurrency:number('PROVIDER_GLOBAL_CONCURRENCY',8),failureThreshold:number('PROVIDER_FAILURE_THRESHOLD',5),
    cooldownMs:number('PROVIDER_CIRCUIT_COOLDOWN_MS',30000),onCircuitChange:details=>log('warn','provider.circuit_changed',details)});
  const execute=createContactsService({account,providers,providerUsage,env,log});
  return async function handle(request,action) {
    const supplied=request.headers.get('x-request-id')||'';
    const requestId=/^[A-Za-z0-9._:-]{1,120}$/.test(supplied)?supplied:randomUUID();
    const started=Date.now();let user,status=500;
    const headers=new Headers({'X-Request-ID':requestId,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    const respond=(code,body,extra={})=>{status=code;for(const [k,v] of Object.entries(extra))headers.set(k,String(v));return new Response(body===null?null:JSON.stringify(body),{status:code,headers:body===null?headers:new Headers([...headers,['Content-Type','application/json; charset=utf-8']])});};
    try {
      for(const [k,v] of Object.entries(corsHeaders(request,env)))headers.set(k,v);
      if(request.method==='OPTIONS')return respond(204,null);
      const expected=['health','live','account'].includes(action)?'GET':'POST';
      if(request.method!==expected && !(expected==='GET' && request.method==='HEAD'))return respond(405,{ok:false,error:'Method not allowed.'},{Allow:expected+', OPTIONS'});
      if(action==='live')return respond(200,{ok:true,live:true});
      if(action==='health') {
        const issues=configurationIssues(env,account.isAccountDbConfigured());let spendBudget={enabled:false};
        try{spendBudget=await checkBudget();}catch{issues.push('provider_budget_unavailable');}
        if(account.isAccountDbConfigured())try{await account.checkAccountDb();}catch{issues.push('account_database_unavailable');}
        return respond(issues.length?503:200,{ok:issues.length===0,ready:issues.length===0,issues,
          provider:providerStatus(env),usagePolicy:{betaUnlimited:isBetaUnlimitedUsage(env),spendBudget},auth:{accountDbConfigured:account.isAccountDbConfigured()}});
      }
      const token=(request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1]?.trim()||'';
      user=token?await authenticate(token):null;
      if(!user) {
        // Only enable this behind the loopback-only Cloudflare Tunnel ingress.
        // Arbitrary X-Forwarded-For values never allocate a fresh bucket.
        const address=env.REACHARD_TRUST_CLOUDFLARE_PROXY==='1'?request.headers.get('cf-connecting-ip'):null;
        anonymous(address&&isIP(address)?address:'untrusted-proxy');
        throw publicError(token?'Sign in and reconnect the extension.':'Sign in to use this API.',401,
          token?{}:{action:{label:'Connect extension',url:`${webBaseUrl(env)}/connect-extension`}});
      }
      limit(user.id);
      const body=expected==='POST'?await readJsonBody(request):{};
      const result=await execute(action,{user,body,headers:request.headers,requestId});
      return respond(result.status,result.body,result.headers);
    } catch(error) {
      const code=Number(error.status)||500;
      log(code>=500?'error':'warn','request.failed',{requestId,method:request.method,path:new URL(request.url).pathname,status:code,userId:user?.id||null,error:error.message});
      return respond(code,{ok:false,error:error.publicMessage||(code>=500?'Server error. Try again shortly.':error.message),requestId,
        ...(error.action?{action:error.action}:{}),...(error.credits?{credits:error.credits}:{})},
        Number.isSafeInteger(error.retryAfter)&&error.retryAfter>0?{'Retry-After':error.retryAfter}:{});
    } finally {
      log('info','request.completed',{requestId,method:request.method,path:new URL(request.url).pathname,status,durationMs:Date.now()-started,userId:user?.id||null});
    }
  };
}
