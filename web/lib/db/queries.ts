import { desc, and, eq, isNull, sql } from 'drizzle-orm';
import { db } from './drizzle';
import {
  activityLogs,
  apiUsage,
  extensionApiTokens,
  billingAccounts,
  userSettings,
  users
} from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';
import { ensureFreeTrial } from '@/lib/free-trial';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  let sessionData;
  try { sessionData = await verifyToken(sessionCookie.value); } catch { return null; }
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0 || !user[0].emailVerifiedAt
    || (sessionData.user.sessionVersion ?? 0) !== user[0].sessionVersion) {
    return null;
  }

  return user[0];
}

export async function getBillingAccountByStripeCustomerId(customerId: string) {
  const [account] = await db.select().from(billingAccounts)
    .where(eq(billingAccounts.stripeCustomerId, customerId)).limit(1);
  return account || null;
}

export async function getBillingAccount(userId: number) {
  const [account] = await db.select().from(billingAccounts)
    .where(eq(billingAccounts.userId, userId)).limit(1);
  return account || null;
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getCreditBalance(userId: number) {
  return (await getAccountEntitlement(userId)).balance;
}

export async function getAccountEntitlement(userId: number) {
  await ensureFreeTrial(userId);
  const result = await db.execute(sql`select * from get_account_entitlement(${userId}::integer)`);
  const row = result[0];
  if (!row) throw new Error('Account allowance is unavailable.');
  return { balance: Number(row.remaining || 0), unlimited: row.unlimited === true,
    monthlyCredits: row.monthly_allowance == null ? null : Number(row.monthly_allowance),
    periodStart: Number(row.period_start || 0), periodEnd: Number(row.period_end || 0),
    allowanceMode: String(row.allowance_mode || 'legacy'), status: String(row.status || 'inactive') };
}

export async function getRecentUsage(userId: number) {
  return db
    .select()
    .from(apiUsage)
    .where(eq(apiUsage.userId, userId))
    .orderBy(desc(apiUsage.createdAt))
    .limit(10);
}

export async function getSettings(userId: number) {
  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return result[0] || null;
}

export async function hasActiveExtensionToken(userId: number) {
  const result = await db
    .select({ id: extensionApiTokens.id })
    .from(extensionApiTokens)
    .where(
      and(
        eq(extensionApiTokens.userId, userId),
        isNull(extensionApiTokens.revokedAt)
      )
    )
    .limit(1);

  return result.length > 0;
}

export async function getActiveExtensionTokenInfo(userId: number) {
  const result = await db
    .select({
      id: extensionApiTokens.id,
      name: extensionApiTokens.name,
      lastUsedAt: extensionApiTokens.lastUsedAt,
      createdAt: extensionApiTokens.createdAt
    })
    .from(extensionApiTokens)
    .where(
      and(
        eq(extensionApiTokens.userId, userId),
        isNull(extensionApiTokens.revokedAt)
      )
    )
    .orderBy(desc(extensionApiTokens.createdAt))
    .limit(1);

  return result[0] || null;
}
