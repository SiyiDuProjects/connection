import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export async function ensureFreeTrial(userId: number) {
  const rows = await db.execute(sql`select ensure_free_trial(${userId}::integer) as eligible`);
  return rows[0]?.eligible === true;
}

export async function getFreeTrialStatus(userId: number) {
  if (!await ensureFreeTrial(userId)) return null;
  const rows = await db.execute(sql`select
    greatest(0, 3 + coalesce((select sum(amount) from credit_ledger
      where user_id = ${userId} and amount < 0), 0))::integer as remaining,
    searches, reveal_attempts, drafts from free_trial_claims where user_id = ${userId}`);
  const row = rows[0];
  return row ? { total: 3, remaining: Number(row.remaining), requiresCard: false as const,
    searchesRemaining: Math.max(0, 20 - Number(row.searches)),
    revealAttemptsRemaining: Math.max(0, 30 - Number(row.reveal_attempts)),
    draftsRemaining: Math.max(0, 12 - Number(row.drafts)) } : null;
}
