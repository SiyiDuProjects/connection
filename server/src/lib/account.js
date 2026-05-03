import crypto from "node:crypto";
import postgres from "postgres";

const sql = process.env.POSTGRES_URL ? postgres(process.env.POSTGRES_URL) : null;

export function isAccountDbConfigured() {
  return Boolean(sql);
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
  `;

  return rows[0];
}

export async function getAccountSummary(userId) {
  ensureConfigured();

  const rows = await sql`
    select
      users.id,
      users.email,
      teams.plan_name,
      teams.subscription_status,
      extension_api_tokens.id as extension_token_id,
      extension_api_tokens.last_used_at
    from users
    left join team_members on team_members.user_id = users.id
    left join teams on teams.id = team_members.team_id
    left join extension_api_tokens on extension_api_tokens.user_id = users.id
      and extension_api_tokens.revoked_at is null
    where users.id = ${userId}
      and users.deleted_at is null
    order by extension_api_tokens.created_at desc
    limit 1
  `;

  const account = rows[0] || {};
  return {
    user: { id: account.id, email: account.email },
    subscription: {
      planName: account.plan_name || "Free",
      status: account.subscription_status || "inactive"
    },
    extension: {
      connected: Boolean(account.extension_token_id),
      lastUsedAt: account.last_used_at || null
    }
  };
}

export async function getUserSettings(userId) {
  ensureConfigured();

  const rows = await sql`
    select target_role, email_tone, default_search_preferences, sender_profile
    from user_settings
    where user_id = ${userId}
    limit 1
  `;

  return rows[0] || {};
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

export async function spendCredits({ userId, amount, action, metadata }) {
  ensureConfigured();

  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${Number(userId)})`;
    const balanceRows = await tx`
      select coalesce(sum(amount), 0)::int as balance
      from credit_ledger
      where user_id = ${userId}
    `;
    const balance = Number(balanceRows[0]?.balance || 0);

    if (balance < amount) {
      return { ok: false, balance };
    }

    if (amount > 0) {
      await tx`
        insert into credit_ledger (user_id, amount, action, metadata)
        values (${userId}, ${-amount}, ${action}, ${sql.json(metadata || {})})
      `;
    }

    return { ok: true, balance: balance - amount };
  });
}

export async function logApiUsage({ userId, action, credits, status, request, response }) {
  ensureConfigured();

  await sql`
    insert into api_usage (user_id, action, credits, status, request, response)
    values (${userId}, ${action}, ${credits}, ${status}, ${sql.json(request || {})}, ${sql.json(response || {})})
  `;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function ensureConfigured() {
  if (!sql) {
    const error = new Error("POSTGRES_URL is not configured.");
    error.status = 500;
    error.publicMessage = "Server account database is not configured.";
    throw error;
  }
}
