import crypto from "node:crypto";
import postgres from "postgres";

const sql = process.env.POSTGRES_URL ? postgres(process.env.POSTGRES_URL) : null;

export function isAccountDbConfigured() {
  return Boolean(sql);
}

export async function checkAccountDb() {
  ensureConfigured();
  const [row] = await sql`
    select
      to_regclass('public.credit_ledger')::text as credit_ledger,
      to_regclass('public.api_usage')::text as api_usage,
      to_regclass('public.api_idempotency_keys')::text as api_idempotency_keys,
      to_regclass('public.free_trial_claims')::text as free_trial_claims,
      to_regclass('public.auth_rate_limits')::text as auth_rate_limits,
      to_regclass('public.contact_email_unlocks')::text as contact_email_unlocks,
      to_regprocedure('public.get_account_entitlement(integer)')::text as get_account_entitlement,
      to_regprocedure('public.ensure_free_trial(integer)')::text as ensure_free_trial,
      to_regprocedure('public.consume_free_trial_operation(integer,text)')::text as consume_free_trial_operation
  `;
  if (!row?.credit_ledger || !row?.api_usage || !row?.api_idempotency_keys
    || !row?.free_trial_claims || !row?.auth_rate_limits || !row?.contact_email_unlocks || !row?.get_account_entitlement
    || !row?.ensure_free_trial || !row?.consume_free_trial_operation) {
    throw new Error("Required account database migrations have not been applied.");
  }
  return true;
}

export async function closeAccountDb() {
  if (sql) await sql.end({ timeout: 5 });
}

export async function pruneApiIdempotencyKeys() {
  ensureConfigured();
  await sql`
    delete from api_idempotency_keys
    where updated_at < now() - interval '7 days'
  `;
  await sql`delete from auth_rate_limits where resets_at < now() - interval '1 day'`;
}

export function getBearerToken(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function getUserFromApiToken(token) {
  ensureConfigured();

  const tokenHash = hashToken(token);
  const rows = await sql`
    select users.id, users.email
    from extension_api_tokens
    inner join users on users.id = extension_api_tokens.user_id
    where extension_api_tokens.token_hash = ${tokenHash}
      and extension_api_tokens.revoked_at is null
      and users.deleted_at is null
      and users.email_verified_at is not null
    limit 1
  `;

  if (!rows.length) {
    const error = new Error("Invalid extension token.");
    error.status = 401;
    error.publicMessage = "Sign in and reconnect the extension.";
    throw error;
  }

  await sql`
    update extension_api_tokens
    set last_used_at = now()
    where token_hash = ${tokenHash}
  `.catch(() => {});

  return rows[0];
}

export async function getAccountSummary(userId) {
  ensureConfigured();

  const rows = await sql`
    select
      users.id,
      users.email,
      users.name,
      teams.plan_name,
      teams.subscription_status,
      extension_api_tokens.id as extension_token_id,
      extension_api_tokens.last_used_at,
      to_jsonb(user_settings) as settings
    from users
    left join team_members on team_members.user_id = users.id
    left join teams on teams.id = team_members.team_id
    left join extension_api_tokens on extension_api_tokens.user_id = users.id
      and extension_api_tokens.revoked_at is null
    left join user_settings on user_settings.user_id = users.id
    where users.id = ${userId}
      and users.deleted_at is null
    order by extension_api_tokens.created_at desc
    limit 1
  `;

  const account = rows[0];
  if (!account) {
    const error = new Error("Account not found.");
    error.status = 404;
    error.publicMessage = "Account not found.";
    throw error;
  }
  const settings = account.settings || {};
  const preferences = settings.default_search_preferences || {};
  const onboardingProfile = getOnboardingStatus(account, settings);
  const usageRows = await sql`
    select action, status, created_at
    from api_usage
    where user_id = ${userId}
      and status = 'success'
    order by created_at desc
    limit 20
  `;
  const successfulSearch = usageRows.find((row) => row.action === "contacts.search");
  const successfulDraft = usageRows.find((row) => row.action === "email.draft");

  return {
    user: { id: account.id, email: account.email },
    subscription: {
      planName: account.plan_name || "Free",
      status: account.subscription_status || "inactive"
    },
    extension: {
      connected: Boolean(account.extension_token_id),
      lastUsedAt: account.last_used_at || null
    },
    onboarding: {
      profile: {
        complete: onboardingProfile.complete,
        completedFields: onboardingProfile.completedFields,
        totalFields: onboardingProfile.totalFields,
        missingFields: onboardingProfile.missingFields
      },
      extension: {
        connected: Boolean(account.extension_token_id),
        lastUsedAt: account.last_used_at || null
      },
      linkedIn: {
        recentSuccessfulSearchAt: successfulSearch?.created_at || null
      },
      draft: {
        recentSuccessfulDraftAt: successfulDraft?.created_at || null
      },
      billing: {
        planName: account.plan_name || "Free",
        status: account.subscription_status || "inactive"
      }
    }
  };
}

export async function getUserSettings(userId) {
  ensureConfigured();

  const rows = await sql`
    select to_jsonb(user_settings) as settings
    from user_settings
    where user_id = ${userId}
    limit 1
  `;

  return rows[0]?.settings || {};
}

export async function getOnboardingForUser(userId) {
  ensureConfigured();

  const rows = await sql`
    select users.name, to_jsonb(user_settings) as settings
    from users
    left join user_settings on user_settings.user_id = users.id
    where users.id = ${userId}
      and users.deleted_at is null
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    const error = new Error("Account not found.");
    error.status = 404;
    error.publicMessage = "Account not found.";
    throw error;
  }
  return getOnboardingStatus(row, row.settings || {});
}

export async function getCreditBalance(userId) {
  return (await getBillingStateForUser(userId)).remaining;
}

export async function getBillingStateForUser(userId) {
  ensureConfigured();
  await ensureFreeTrial(userId);
  const [row] = await sql`select * from get_account_entitlement(${userId}::integer)`;
  return billingState(row);
}

export async function getMembershipForUser(userId) {
  return getBillingStateForUser(userId);
}

export async function ensureFreeTrial(userId) {
  ensureConfigured();
  const [row] = await sql`select ensure_free_trial(${userId}::integer) as eligible`;
  return row?.eligible === true;
}

export async function consumeFreeTrialOperation(userId, action) {
  ensureConfigured();
  const [row] = await sql`select consume_free_trial_operation(${userId}::integer, ${action}) as allowed`;
  return row?.allowed === true;
}

export async function hasRevealedEmail(userId, email) {
  ensureConfigured();
  if (typeof email !== 'string' || !email.trim()) return false;
  const rows = await sql`select 1 from contact_email_unlocks where user_id = ${userId}
    and email_fingerprint = ${hashToken(email.trim().toLowerCase())} limit 1`;
  return rows.length > 0;
}

export async function getPreviouslyRevealedContact(userId, contact) {
  ensureConfigured();
  const contactKey = getContactKey(contact);
  const email = typeof contact?.email === 'string' ? contact.email.trim().toLowerCase() : '';
  if (!contactKey && !email) return null;
  const [unlocked] = await sql`select email, provider from contact_email_unlocks
    where user_id = ${userId} and
      ((${contactKey || null}::text is not null and contact_key = ${contactKey})
        or (${email || null}::text is not null and email_fingerprint = ${hashToken(email)}))
    order by created_at desc limit 1`;
  return unlocked || null;
}

export function getContactKey(contact) {
  if (!contact || typeof contact !== 'object') return '';
  try {
    const url = new URL(String(contact.linkedinUrl || ''));
    if (['http:', 'https:'].includes(url.protocol)
      && url.hostname.replace(/^www\./i, '').toLowerCase() === 'linkedin.com'
      && /^\/in\/[^/]+\/?$/i.test(url.pathname)) {
      return `linkedin:${url.pathname.replace(/\/+$/, '').toLowerCase()}`;
    }
  } catch {}
  const apolloId = typeof contact.apolloId === 'string' ? contact.apolloId.trim() : '';
  if (apolloId && apolloId.length <= 256) return `apollo:${apolloId}`;
  const id = typeof contact.id === 'string' ? contact.id.trim() : '';
  const provider = typeof contact.provider === 'string' ? contact.provider.trim().toLowerCase() : '';
  if (id && id.length <= 256 && ['treg', 'apollo', 'hunter', 'rapidapi', 'explorium', 'mock'].includes(provider)) return `${provider}:${id}`;
  return '';
}

export async function claimApiRequest({ userId, action, idempotencyKey }) {
  ensureConfigured();

  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`${userId}:${action}:${idempotencyKey}`}))`;
    const rows = await tx`
      select status, response, updated_at
      from api_idempotency_keys
      where user_id = ${userId}
        and action = ${action}
        and idempotency_key = ${idempotencyKey}
      limit 1
      for update
    `;
    const existing = rows[0];

    if (!existing) {
      // A pruned response must not let the same request key collide with a
      // durable debit or repeat a successful paid operation with new input.
      const [completed] = await tx`select 1 from api_usage
        where user_id = ${userId} and action = ${action} and request_id = ${idempotencyKey}
          and status = 'success' limit 1`;
      if (completed) return { status: 'expired' };
      await tx`
        insert into api_idempotency_keys (user_id, action, idempotency_key, status)
        values (${userId}, ${action}, ${idempotencyKey}, 'processing')
      `;
      return { status: "claimed" };
    }

    if (existing.status === "succeeded") {
      return { status: "replay", response: existing.response || {} };
    }

    const stale = new Date(existing.updated_at).getTime() < Date.now() - 5 * 60 * 1000;
    if (existing.status === "processing" && !stale) {
      return { status: "processing" };
    }

    await tx`
      update api_idempotency_keys
      set status = 'processing', response = '{}'::jsonb, error = null, updated_at = now()
      where user_id = ${userId}
        and action = ${action}
        and idempotency_key = ${idempotencyKey}
    `;
    return { status: "claimed" };
  });
}

export async function chargeAndLogApiUsage({
  userId,
  amount,
  action,
  idempotencyKey,
  request,
  response,
  internalCost
}) {
  ensureConfigured();

  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${Number(userId)})`;
    const idempotencyRows = await tx`
      select status, response
      from api_idempotency_keys
      where user_id = ${userId}
        and action = ${action}
        and idempotency_key = ${idempotencyKey}
      limit 1
      for update
    `;
    const idempotency = idempotencyRows[0];
    if (idempotency?.status === "succeeded") {
      const [entitlement] = await tx`select * from get_account_entitlement(${userId}::integer)`;
      const state = billingState(entitlement);
      return {
        ok: true,
        replayed: true,
        balance: state.remaining,
        response: { ...(idempotency.response || {}), credits: publicCredits(state) }
      };
    }
    if (!idempotency || idempotency.status !== "processing") {
      throw new Error("Idempotency request was not claimed before completion.");
    }

    // Re-read the paid period after obtaining the per-user charge lock. A
    // request that crosses renewal must never spend an earlier month's grant.
    const [entitlement] = await tx`select * from get_account_entitlement(${userId}::integer)`;
    const state = billingState(entitlement);
    const balance = state.remaining;
    const email = action === 'contacts.reveal' && typeof response?.email === 'string'
      ? response.email.trim().toLowerCase() : '';
    const emailFingerprint = email ? hashToken(email) : '';
    const [unlocked] = email ? await tx`select 1 from contact_email_unlocks
      where user_id = ${userId} and email_fingerprint = ${emailFingerprint}` : [];
    const alreadyUnlocked = Boolean(unlocked);
    const betaUnlimited = ['1', 'true', 'yes', 'on'].includes(String(process.env.BETA_UNLIMITED_USAGE || '').trim().toLowerCase());
    const membershipActive = ['active', 'trialing', 'past_due'].includes(state.status) && state.periodEnd * 1000 > Date.now();
    // Requests admitted before cancellation or expiry are checked again before
    // completion. Viewing an email this account already unlocked remains free.
    if (!alreadyUnlocked && !betaUnlimited && state.status !== 'free_trial' && !membershipActive) {
      await tx`update api_idempotency_keys set status = 'failed', error = 'membership_required', updated_at = now()
        where user_id = ${userId} and action = ${action} and idempotency_key = ${idempotencyKey}`;
      return { ok: false, balance, membershipRequired: true };
    }
    const chargedAmount = state.unlimited || betaUnlimited || alreadyUnlocked ? 0 : amount;

    if (balance < chargedAmount) {
      await tx`
        update api_idempotency_keys
        set status = 'failed', error = 'insufficient_credits', updated_at = now()
        where user_id = ${userId}
          and action = ${action}
          and idempotency_key = ${idempotencyKey}
      `;
      return { ok: false, balance };
    }

    const remaining = balance - chargedAmount;
    const completedResponse = {
      ...(response || {}),
      ...(alreadyUnlocked ? { alreadyUnlocked: true } : {}),
      credits: publicCredits({ ...state, remaining })
    };

    if (chargedAmount > 0) {
      const debits = await tx`
        insert into credit_ledger (user_id, amount, action, request_id, metadata)
        values (
          ${userId},
          ${-chargedAmount},
          ${action},
          ${idempotencyKey},
          ${sql.json({ ...(request || {}), requestId: idempotencyKey,
            ...(state.allowanceMode === 'monthly' ? { entitlementGrantId: state.entitlementGrantId } : {}) })}
        )
        on conflict do nothing
        returning id
      `;
      if (!debits.length) throw new Error('This request key already has a recorded debit. Retry with a new request key.');
    }

    if (email) {
      await tx`insert into contact_email_unlocks (user_id, email_fingerprint, contact_key, email, provider)
        values (${userId}, ${emailFingerprint}, ${request?.contactKey || null}, ${email}, ${String(response?.provider || '')})
        on conflict (user_id, email_fingerprint) do update
          set contact_key = coalesce(contact_email_unlocks.contact_key, excluded.contact_key)`;
    }

    await tx`
      insert into api_usage (user_id, action, request_id, credits, status, request, response)
      values (
        ${userId},
        ${action},
        ${idempotencyKey},
        ${chargedAmount},
        'success',
        ${sql.json(request || {})},
        ${sql.json(summarizeUsageResponse(action, completedResponse, internalCost))}
      )
      on conflict do nothing
    `;
    await tx`
      update api_idempotency_keys
      set status = 'succeeded', response = ${sql.json(completedResponse)}, error = null, updated_at = now()
      where user_id = ${userId}
        and action = ${action}
        and idempotency_key = ${idempotencyKey}
    `;

    return { ok: true, replayed: false, balance: remaining, response: completedResponse };
  });
}

export async function failApiRequest({ userId, action, idempotencyKey, error }) {
  ensureConfigured();
  if (!idempotencyKey) return;

  await sql`
    update api_idempotency_keys
    set status = 'failed', error = ${String(error || "request_failed").slice(0, 1000)}, updated_at = now()
    where user_id = ${userId}
      and action = ${action}
      and idempotency_key = ${idempotencyKey}
      and status = 'processing'
  `;
}

export async function logApiUsage({ userId, action, requestId, credits, status, request, response }) {
  ensureConfigured();

  await sql`
    insert into api_usage (user_id, action, request_id, credits, status, request, response)
    values (${userId}, ${action}, ${requestId || null}, ${credits}, ${status}, ${sql.json(request || {})}, ${sql.json(response || {})})
  `;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function billingState(row) {
  return {
    status: row?.status || 'inactive',
    periodStart: Number(row?.period_start || 0),
    periodEnd: Number(row?.period_end || 0),
    allowanceMode: row?.allowance_mode || 'legacy',
    monthlyAllowance: Number(row?.monthly_allowance || 0),
    remaining: Number(row?.remaining || 0),
    unlimited: row?.unlimited === true,
    entitlementGrantId: row?.entitlement_grant_id == null ? null : Number(row.entitlement_grant_id)
  };
}

export function publicCredits(state) {
  return {
    remaining: state.unlimited ? null : state.remaining,
    balance: state.unlimited ? null : state.remaining,
    unlimited: state.unlimited,
    status: state.unlimited ? 'unlimited' : state.remaining > 0 ? 'available' : 'empty',
    monthlyAllowance: state.unlimited ? null : state.monthlyAllowance,
    resetsAt: state.allowanceMode === 'monthly' && state.periodEnd ? new Date(state.periodEnd * 1000).toISOString() : null
  };
}

function summarizeUsageResponse(action, response, internalCost) {
  const internal = sanitizeInternalCost(internalCost);
  if (action === "contacts.search") {
    return { resultCount: Array.isArray(response?.contacts) ? response.contacts.length : 0, ...(internal ? { internalCost: internal } : {}) };
  }
  if (action === "contacts.reveal") {
    return { provider: response?.provider || "", emailFound: Boolean(response?.email), ...(internal ? { internalCost: internal } : {}) };
  }
  if (action === "email.draft") {
    return { ai: response?.ai || null, ...(internal ? { internalCost: internal } : {}) };
  }
  return internal ? { internalCost: internal } : {};
}

function sanitizeInternalCost(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const strings = ["source", "provider", "endpoint", "model", "billing", "callId", "responseId"];
  const numbers = ["costMicroUsd", "durationMs", "inputTokens", "cachedInputTokens", "outputTokens", "totalTokens"];
  const result = {};
  for (const key of strings) {
    const item = String(value[key] || "").trim();
    if (item) result[key] = item.slice(0, 160);
  }
  for (const key of numbers) {
    // Missing provider receipts are unknown, not free. Preserve that distinction
    // in the durable usage report used to monitor unlimited-plan economics.
    if (value[key] == null || value[key] === '') continue;
    const item = Number(value[key]);
    if (Number.isFinite(item) && item >= 0) result[key] = Math.round(item);
  }
  if (typeof value.cached === "boolean") result.cached = value.cached;
  if (typeof value.replayed === "boolean") result.replayed = value.replayed;
  return Object.keys(result).length ? result : null;
}

function ensureConfigured() {
  if (!sql) {
    const error = new Error("POSTGRES_URL is not configured.");
    error.status = 500;
    error.publicMessage = "Server account database is not configured.";
    throw error;
  }
}

function getOnboardingStatus(user = {}, settings = {}) {
  const fields = [
    ["name", user.name],
    ["school", settings.school]
  ];
  const hasBackground = Boolean(clean(settings.sender_profile) || clean(settings.resume_context));
  const missingFields = fields.filter(([, value]) => !clean(value)).map(([key]) => key);
  if (!hasBackground) missingFields.push("background");
  return {
    complete: missingFields.length === 0,
    missingFields,
    completedFields: fields.length + 1 - missingFields.length,
    totalFields: fields.length + 1
  };
}

function clean(value) {
  return String(value || "").trim();
}
