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
      to_regclass('public.api_idempotency_keys')::text as api_idempotency_keys
  `;
  if (!row?.credit_ledger || !row?.api_usage || !row?.api_idempotency_keys) {
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
  ensureConfigured();

  const rows = await sql`
    select coalesce(sum(amount), 0)::int as balance
    from credit_ledger
    where user_id = ${userId}
  `;

  return Number(rows[0]?.balance || 0);
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
  response
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
      const balanceRows = await tx`
        select coalesce(sum(amount), 0)::int as balance
        from credit_ledger
        where user_id = ${userId}
      `;
      return {
        ok: true,
        replayed: true,
        balance: Number(balanceRows[0]?.balance || 0),
        response: idempotency.response || {}
      };
    }
    if (!idempotency || idempotency.status !== "processing") {
      throw new Error("Idempotency request was not claimed before completion.");
    }

    const balanceRows = await tx`
      select coalesce(sum(amount), 0)::int as balance
      from credit_ledger
      where user_id = ${userId}
    `;
    const balance = Number(balanceRows[0]?.balance || 0);

    if (balance < amount) {
      await tx`
        update api_idempotency_keys
        set status = 'failed', error = 'insufficient_credits', updated_at = now()
        where user_id = ${userId}
          and action = ${action}
          and idempotency_key = ${idempotencyKey}
      `;
      return { ok: false, balance };
    }

    const remaining = balance - amount;
    const completedResponse = {
      ...(response || {}),
      credits: { remaining }
    };

    if (amount > 0) {
      await tx`
        insert into credit_ledger (user_id, amount, action, request_id, metadata)
        values (
          ${userId},
          ${-amount},
          ${action},
          ${idempotencyKey},
          ${sql.json({ ...(request || {}), requestId: idempotencyKey })}
        )
        on conflict do nothing
      `;
    }

    await tx`
      insert into api_usage (user_id, action, request_id, credits, status, request, response)
      values (
        ${userId},
        ${action},
        ${idempotencyKey},
        ${amount},
        'success',
        ${sql.json(request || {})},
        ${sql.json(summarizeUsageResponse(action, completedResponse))}
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

function summarizeUsageResponse(action, response) {
  if (action === "contacts.search") {
    return { resultCount: Array.isArray(response?.contacts) ? response.contacts.length : 0 };
  }
  if (action === "contacts.reveal") {
    return { provider: response?.provider || "", emailFound: Boolean(response?.email) };
  }
  if (action === "email.draft") {
    return { ai: response?.ai || null };
  }
  return {};
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
