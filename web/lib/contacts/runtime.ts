import 'server-only';
import * as account from './account.js';
import { searchContacts, revealEmail } from './contacts-provider.js';
import { rankContacts } from './ranking.js';
import { createDraft, createMailtoUrl, getDraftInternalCost } from './email.js';
import { checkProviderBudget } from './spend-budget.js';
import { writeLog } from './http.js';
import { createContactsApi } from './api.js';
import { getUserFromExtensionToken } from '../extension-tokens';

type Handler = (request: Request, action: string) => Promise<Response>;
const processState = globalThis as typeof globalThis & { reachardContactsHandler?: Handler; reachardContactsCleanup?: ReturnType<typeof setInterval> };
export function handleContactsRequest(request: Request, action: string): Promise<Response> {
  // Vercel remains an inactive rollback target during the VPS cutover.
  if (process.env.REACHARD_CONTACTS_ENABLED !== '1' && process.env.REACHARD_LOCAL_TEST !== '1') {
    return Promise.resolve(Response.json({ok:false,error:'Contacts service is not enabled on this deployment.'},{status:503,headers:{'Cache-Control':'no-store'}}));
  }
  if (!processState.reachardContactsHandler) {
    processState.reachardContactsHandler = createContactsApi({account,
      providers:{searchContacts,revealEmail,rankContacts,createDraft,createMailtoUrl,getDraftInternalCost},
      authenticate:getUserFromExtensionToken,checkBudget:checkProviderBudget,log:writeLog});
  }
  return processState.reachardContactsHandler(request,action);
}
export function startContactsMaintenance() {
  if (process.env.REACHARD_CONTACTS_ENABLED !== '1' || processState.reachardContactsCleanup) return;
  const timer=setInterval(()=>{void account.pruneApiIdempotencyKeys().catch(()=>writeLog('warn','idempotency.cleanup_failed'));},6*60*60*1000);
  timer.unref();
  processState.reachardContactsCleanup=timer;
}
