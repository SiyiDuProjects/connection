import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin';
import { db } from '@/lib/db/drizzle';
import {
  apiUsage,
  creditLedger,
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

  const [summaryRows, recentUsage, userRows] = await Promise.all([
    db
      .select({
        totalUsers: sql<number>`count(distinct ${users.id})::int`,
        totalApiCalls: sql<number>`(select count(*)::int from ${apiUsage})`,
        totalCreditsGranted: sql<number>`coalesce((select sum(${creditLedger.amount}) from ${creditLedger} where ${creditLedger.amount} > 0), 0)::int`,
        totalCreditsSpent: sql<number>`abs(coalesce((select sum(${creditLedger.amount}) from ${creditLedger} where ${creditLedger.amount} < 0), 0))::int`
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
      .limit(25)
  ]);

  return Response.json({
    summary: summaryRows[0] || {
      totalUsers: 0,
      totalApiCalls: 0,
      totalCreditsGranted: 0,
      totalCreditsSpent: 0
    },
    users: userRows,
    recentUsage
  });
}

function clean(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
