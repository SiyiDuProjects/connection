import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin';
import { db } from '@/lib/db/drizzle';
import {
  apiUsage,
  creditLedger,
  productEvents,
  teamMembers,
  teams,
  users
} from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await getUser();
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminUser(admin)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const search = clean(request.nextUrl.searchParams.get('search'));
  const userFilter = search ? ilike(users.email, `%${search}%`) : undefined;

  const internalSource = sql<string>`coalesce(${apiUsage.response}->'internalCost'->>'source', '')`;
  const internalProvider = sql<string>`coalesce(${apiUsage.response}->'internalCost'->>'provider', '')`;
  const internalModel = sql<string>`coalesce(${apiUsage.response}->'internalCost'->>'model', '')`;
  const internalBilling = sql<string>`coalesce(${apiUsage.response}->'internalCost'->>'billing', '')`;

  const [summaryRows, recentUsage, userRows, funnelRows, internalCosts] = await Promise.all([
    db
      .select({
        totalUsers: sql<number>`count(distinct ${users.id})::int`,
        totalApiCalls: sql<number>`(select count(*)::int from ${apiUsage})`,
        totalCreditsGranted: sql<number>`coalesce((select sum(${creditLedger.amount}) from ${creditLedger} where ${creditLedger.amount} > 0), 0)::int`,
        totalCreditsSpent: sql<number>`abs(coalesce((select sum(${creditLedger.amount}) from ${creditLedger} where ${creditLedger.amount} < 0), 0))::int`,
        totalInternalCostUsd: sql<number>`(
          coalesce((select sum((${apiUsage.response}->'internalCost'->>'costMicroUsd')::numeric) from ${apiUsage} where ${apiUsage.response} ? 'internalCost'), 0) / 1000000.0
        )::double precision`,
        internalCost30dUsd: sql<number>`(
          coalesce((select sum((${apiUsage.response}->'internalCost'->>'costMicroUsd')::numeric) from ${apiUsage} where ${apiUsage.response} ? 'internalCost' and ${apiUsage.createdAt} >= now() - interval '30 days'), 0) / 1000000.0
        )::double precision`
      })
      .from(users)
      .where(isNull(users.deletedAt)),
    db
      .select({
        id: apiUsage.id,
        email: users.email,
        action: apiUsage.action,
        credits: apiUsage.credits,
        status: apiUsage.status,
        createdAt: apiUsage.createdAt
      })
      .from(apiUsage)
      .innerJoin(users, eq(apiUsage.userId, users.id))
      .orderBy(desc(apiUsage.createdAt))
      .limit(20),
    db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        planName: teams.planName,
        subscriptionStatus: teams.subscriptionStatus,
        creditBalance: sql<number>`coalesce((select sum(${creditLedger.amount}) from ${creditLedger} where ${creditLedger.userId} = ${users.id}), 0)::int`,
        lastUsedAt: sql<Date | null>`(select max(${apiUsage.createdAt}) from ${apiUsage} where ${apiUsage.userId} = ${users.id})`
      })
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(
        userFilter
          ? and(isNull(users.deletedAt), userFilter)
          : isNull(users.deletedAt)
      )
      .groupBy(
        users.id,
        users.email,
        users.createdAt,
        teams.planName,
        teams.subscriptionStatus
      )
      .orderBy(desc(users.createdAt))
      .limit(25),
    db
      .select({
        event: productEvents.event,
        count: sql<number>`count(*)::int`,
        users: sql<number>`count(distinct ${productEvents.userId})::int`
      })
      .from(productEvents)
      .groupBy(productEvents.event)
      .orderBy(productEvents.event),
    db
      .select({
        source: internalSource,
        provider: internalProvider,
        model: internalModel,
        billing: internalBilling,
        calls: sql<number>`count(*)::int`,
        costUsd: sql<number>`(sum((${apiUsage.response}->'internalCost'->>'costMicroUsd')::numeric) / 1000000.0)::double precision`,
        inputTokens: sql<number>`coalesce(sum((${apiUsage.response}->'internalCost'->>'inputTokens')::numeric), 0)::double precision`,
        outputTokens: sql<number>`coalesce(sum((${apiUsage.response}->'internalCost'->>'outputTokens')::numeric), 0)::double precision`
      })
      .from(apiUsage)
      .where(sql`${apiUsage.response} ? 'internalCost' and ${apiUsage.createdAt} >= now() - interval '30 days'`)
      .groupBy(internalSource, internalProvider, internalModel, internalBilling)
      .orderBy(desc(sql`sum((${apiUsage.response}->'internalCost'->>'costMicroUsd')::numeric)`))
  ]);

  return Response.json({
    summary: summaryRows[0] || {
      totalUsers: 0,
      totalApiCalls: 0,
      totalCreditsGranted: 0,
      totalCreditsSpent: 0,
      totalInternalCostUsd: 0,
      internalCost30dUsd: 0
    },
    internalCosts,
    funnel: funnelRows,
    users: userRows,
    recentUsage
  });
}

function clean(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
