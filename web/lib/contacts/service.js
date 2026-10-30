import { BRAND_NAME } from './brand.js';
import { publicError } from './http.js';
import { hasActionAccess, isBetaUnlimitedUsage } from './membership-policy.js';
import { normalizeContext, normalizeRevealContact } from './context.js';
import { webBaseUrl, revealProviderName, providerStatus } from './configuration.js';

const success = data => ({status:200, body:{ok:true,...data}});
const failure = (status,error,extra={}) => ({status,body:{ok:false,error,...extra}});

// HTTP-independent operations. The same account transaction owns admission,
// replay and charging; adapters cannot perform a second charge.
export function createContactsService({account, providers, providerUsage, env=process.env, log=()=>{}}) {
  const beta=()=>isBetaUnlimitedUsage(env);
  const pricing={label:'View membership plans',url:`${webBaseUrl(env)}/pricing`};
  function summarize(ctx) {
    const body=ctx.body||{}, context=body.pageContext||body.job||body;
    return {type:context.type,companyName:context.companyName,companyDomain:context.companyDomain,
      jobTitle:context.jobTitle,contactProvider:body.contact?.provider,contactId:body.contact?.id||body.contact?.linkedinUrl,
      contactKey:account.getContactKey(body.contact)};
  }
  const identify=(ctx,action)=>({userId:ctx.user.id,action,idempotencyKey:ctx.idempotencyKey});
  async function usage(ctx,action,status,response) {
    await account.logApiUsage({userId:ctx.user.id,action,requestId:ctx.idempotencyKey,credits:0,status,request:summarize(ctx),response});
  }
  async function recordFailure(ctx,action,error) {
    await Promise.all([account.failApiRequest({...identify(ctx,action),error:error?.message||String(error)}),
      usage(ctx,action,'error',{error:error?.message||String(error)})]);
  }
  async function charge(ctx,action,response,internalCost) {
    const result=await account.chargeAndLogApiUsage({...identify(ctx,action),amount:action==='contacts.reveal'?1:0,
      request:summarize(ctx),response,internalCost});
    if (!result?.ok) throw publicError(result?.membershipRequired?`An active ${BRAND_NAME} membership is required.`:'Your included email allowance has been used.',402,
      {action:pricing,credits:{remaining:result?.balance??0,required:action==='contacts.reveal'?1:0}});
    return success(result.response);
  }
  async function run(ctx,action,operation) {
    return providerUsage.run(action,ctx.user.id,async()=>{
      if (ctx.freeTrial && !await account.consumeFreeTrialOperation(ctx.user.id,action)) {
        throw publicError('The free trial limit for this feature has been reached. Choose a plan to continue.',402,{action:pricing,usageGuard:true});
      }
      return operation();
    });
  }
  return async function execute(action,ctx) {
    if (action==='account') {
      const [summary,billing]=await Promise.all([account.getAccountSummary(ctx.user.id),account.getBillingStateForUser(ctx.user.id)]);
      if (summary.onboarding?.billing) Object.assign(summary.onboarding.billing,{creditsRemaining:billing.unlimited?null:billing.remaining,
        creditStatus:account.publicCredits(billing).status,unlimited:billing.unlimited});
      return success({...summary,credits:account.publicCredits(billing)});
    }
    const key=String(ctx.headers.get('idempotency-key')||'').trim();
    if (key && (!/^[A-Za-z0-9._:-]+$/.test(key)||key.length>120)) return failure(400,'Invalid Idempotency-Key header.');
    ctx.idempotencyKey=key||ctx.requestId;
    const claim=await account.claimApiRequest({...identify(ctx,action),request:ctx.body||{}});
    if (claim.status==='conflict') return failure(409,'This Idempotency-Key belongs to a different request. Use a new key for a new operation.',{code:'idempotency_conflict'});
    if (claim.status==='unverifiable') return failure(409,'This earlier request cannot be safely replayed. Contact support before repeating it.',{code:'idempotency_unverifiable'});
    if (claim.status==='expired') return failure(409,'This request has already completed. Retry with a new Idempotency-Key.');
    if (claim.status==='processing') return {...failure(409,'This request is already being processed.'),headers:{'Retry-After':'2'}};
    if (claim.status==='replay') return success({...claim.response,credits:account.publicCredits(await account.getBillingStateForUser(ctx.user.id)),idempotentReplay:true});
    try {
      const membership=await account.getBillingStateForUser(ctx.user.id);
      const previous=action==='contacts.reveal'?await account.getPreviouslyRevealedContact(ctx.user.id,ctx.body?.contact):null;
      ctx.freeTrial=!beta()&&membership.status==='free_trial';
      if (!previous&&!beta()&&!hasActionAccess(membership,action,membership.remaining)) {
        throw publicError(ctx.freeTrial?'Your 3 free email unlocks have been used. Choose a plan to continue.':`An active ${BRAND_NAME} membership is required.`,402,{action:pricing});
      }
      const amount=membership.unlimited||beta()||previous?0:action==='contacts.reveal'?1:0;
      if (membership.remaining<amount) throw publicError('Your included email allowance has been used.',402,{action:pricing,credits:{...account.publicCredits(membership),required:amount}});
      const onboarding=await account.getOnboardingForUser(ctx.user.id);
      if (!onboarding.complete) throw publicError(`Complete your profile before using ${BRAND_NAME}.`,428,{onboarding,action:{label:'Complete profile',url:`${webBaseUrl(env)}/onboarding`}});
      if (previous) return await charge(ctx,action,previous);
      const providerRequest={customerId:ctx.user.id,idempotencyKey:ctx.idempotencyKey};
      if (action==='contacts.search') {
        const settings=await account.getUserSettings(ctx.user.id);
        const context=normalizeContext(ctx.body?.pageContext||ctx.body,settings);
        if (!context.companyName&&!context.companyDomain) throw publicError('Could not read the company name from this page.',400,
          {action:{label:'Open page',url:context.sourceUrl||context.jobUrl||'https://www.linkedin.com/jobs/'},credits:{remaining:await account.getCreditBalance(ctx.user.id)}});
        const contacts=await run(ctx,action,()=>providers.searchContacts(context,providerRequest)).catch(async error=>{
          if (error.usageGuard) throw error;
          log('warn','contacts.provider_failed',{requestId:ctx.requestId,provider:providerStatus(env).contactProvider,error:error.message});
          if (error.publicMessage&&error.status&&error.status<500) throw publicError(error.publicMessage,error.status,
            {action:error.status===428?{label:'Complete profile',url:`${webBaseUrl(env)}/onboarding`}:undefined,credits:{remaining:await account.getCreditBalance(ctx.user.id)}});
          throw publicError('Contact search is temporarily unavailable. Try again shortly.',503);
        });
        return await charge(ctx,action,{contacts:providers.rankContacts(contacts,context).slice(0,10)},providerRequest.internalCost);
      }
      if (action==='contacts.reveal') {
        const contact=normalizeRevealContact(ctx.body?.contact);
        if (!contact) throw publicError('Choose a valid contact before revealing an email.',400);
        const email=await run(ctx,action,()=>providers.revealEmail(contact,providerRequest)).catch(error=>{
          if(error.usageGuard) throw error;
          log('warn','contacts.reveal_provider_failed',{requestId:ctx.requestId,provider:revealProviderName(env),error:error.message});
          throw publicError('Email reveal is temporarily unavailable. Try again shortly.',503);
        });
        if (!email) {
          await Promise.all([account.failApiRequest({...identify(ctx,action),error:'email_not_found'}),usage(ctx,action,'not_found',
            {emailFound:false,...(providerRequest.internalCost?{internalCost:providerRequest.internalCost}:{})})]);
          return failure(404,'No work email was found. Your included allowance was not used.',{credits:{remaining:await account.getCreditBalance(ctx.user.id)}});
        }
        return await charge(ctx,action,{email,provider:revealProviderName(env)},providerRequest.internalCost);
      }
      const contact=ctx.body?.contact;
      const settings=await account.getUserSettings(ctx.user.id);
      const context=normalizeContext(ctx.body?.pageContext||ctx.body?.job||{},settings);
      if (!contact?.email) throw publicError('Unlock this contact before drafting outreach.',400,{credits:{remaining:await account.getCreditBalance(ctx.user.id)}});
      if (ctx.freeTrial&&!await account.hasRevealedEmail(ctx.user.id,contact.email)) throw publicError(`Unlock this contact with ${BRAND_NAME} before drafting during your free trial.`,403);
      const draft=await run(ctx,action,()=>providers.createDraft(contact,context,settings,{customerId:ctx.user.id}));
      return await charge(ctx,action,{...draft,mailtoUrl:providers.createMailtoUrl(contact.email,draft)},providers.getDraftInternalCost(draft));
    } catch(error) {
      await recordFailure(ctx,action,error).catch(()=>{});
      throw error;
    }
  };
}
