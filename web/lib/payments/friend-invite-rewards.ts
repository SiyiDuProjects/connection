import Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  friendInviteRedemptions,
  friendInviteRewards,
  friendInvites,
  teamMembers,
  teams
} from '@/lib/db/schema';
import { stripe } from '@/lib/payments/stripe';

type PurchaseRewardInput = {
  invitedUserId: number;
  checkoutSessionId: string;
  subscriptionId: string;
};

type RewardRow = typeof friendInviteRewards.$inferSelect;

export async function grantFriendInvitePurchaseReward({
  invitedUserId,
  checkoutSessionId,
  subscriptionId
}: PurchaseRewardInput) {
  try {
    const [redemption] = await db
      .select({
        id: friendInviteRedemptions.id,
        inviteId: friendInviteRedemptions.inviteId,
        invitedUserId: friendInviteRedemptions.invitedUserId,
        inviterUserId: friendInvites.inviterUserId
      })
      .from(friendInviteRedemptions)
      .innerJoin(friendInvites, eq(friendInviteRedemptions.inviteId, friendInvites.id))
      .where(eq(friendInviteRedemptions.invitedUserId, invitedUserId))
      .limit(1);

    if (!redemption || redemption.inviterUserId === invitedUserId) {
      return;
    }

    const [created] = await db
      .insert(friendInviteRewards)
      .values({
        redemptionId: redemption.id,
        inviterUserId: redemption.inviterUserId,
        invitedUserId,
        checkoutSessionId,
        invitedSubscriptionId: subscriptionId,
        status: 'pending',
        updatedAt: new Date()
      })
      .onConflictDoNothing({
        target: friendInviteRewards.redemptionId
      })
      .returning();

    const reward = created || (await findRewardByRedemptionId(redemption.id));
    if (!reward || reward.status === 'applied') {
      return;
    }

    await applyFriendInviteReward(reward);
  } catch (error) {
    console.error('Could not grant friend invite purchase reward:', error);
  }
}

export async function applyPendingFriendInviteRewards(inviterUserId: number) {
  const rewards = await db
    .select()
    .from(friendInviteRewards)
    .where(eq(friendInviteRewards.inviterUserId, inviterUserId));

  for (const reward of rewards) {
    if (reward.status !== 'pending' && reward.status !== 'failed') {
      continue;
    }
    try {
      await applyFriendInviteReward(reward);
    } catch (error) {
      console.error('Could not apply pending friend invite reward:', error);
    }
  }
}

async function findRewardByRedemptionId(redemptionId: number) {
  const [reward] = await db
    .select()
    .from(friendInviteRewards)
    .where(eq(friendInviteRewards.redemptionId, redemptionId))
    .limit(1);

  return reward;
}

async function applyFriendInviteReward(reward: RewardRow) {
  const [lockedReward] = await db
    .update(friendInviteRewards)
    .set({
      status: 'applying',
      error: null,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(friendInviteRewards.id, reward.id),
        eq(friendInviteRewards.status, reward.status)
      )
    )
    .returning();

  if (!lockedReward) {
    return;
  }

  const [inviterTeam] = await db
    .select({
      stripeCustomerId: teams.stripeCustomerId,
      stripeSubscriptionId: teams.stripeSubscriptionId,
      subscriptionStatus: teams.subscriptionStatus
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, lockedReward.inviterUserId))
    .limit(1);

  if (!inviterTeam?.stripeCustomerId || !inviterTeam.stripeSubscriptionId) {
    await markRewardPending(lockedReward.id, 'Inviter does not have a Stripe customer or subscription yet.');
    return;
  }

  if (!['active', 'trialing'].includes(inviterTeam.subscriptionStatus || '')) {
    await markRewardPending(lockedReward.id, 'Inviter subscription is not active or trialing.');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(inviterTeam.stripeSubscriptionId, {
    expand: ['items.data.price']
  });
  const price = subscription.items.data[0]?.price;
  const amount = oneMonthCreditAmount(price);
  const currency = price?.currency;

  if (!amount || !currency) {
    await markRewardFailed(lockedReward.id, 'Could not determine inviter subscription price.');
    return;
  }

  const balanceTransaction = await stripe.customers.createBalanceTransaction(
    inviterTeam.stripeCustomerId,
    {
      amount: -amount,
      currency,
      description: 'Friend invite reward: one month free',
      metadata: {
        rewardId: String(lockedReward.id),
        redemptionId: String(lockedReward.redemptionId),
        inviterUserId: String(lockedReward.inviterUserId),
        invitedUserId: String(lockedReward.invitedUserId),
        checkoutSessionId: lockedReward.checkoutSessionId,
        invitedSubscriptionId: lockedReward.invitedSubscriptionId
      }
    }
  ).catch(async (error) => {
    await markRewardFailed(lockedReward.id, error instanceof Error ? error.message : 'Could not create Stripe balance credit.');
    throw error;
  });

  await db
    .update(friendInviteRewards)
    .set({
      stripeCustomerId: inviterTeam.stripeCustomerId,
      stripeCreditBalanceTransactionId: balanceTransaction.id,
      amount,
      currency,
      status: 'applied',
      error: null,
      updatedAt: new Date()
    })
    .where(eq(friendInviteRewards.id, lockedReward.id));
}

function oneMonthCreditAmount(price?: Stripe.Price) {
  const unitAmount = price?.unit_amount || 0;
  if (!unitAmount) return 0;

  if (price?.recurring?.interval === 'year') {
    return Math.round(unitAmount / 12);
  }

  return unitAmount;
}

async function markRewardPending(id: number, error: string) {
  await db
    .update(friendInviteRewards)
    .set({
      status: 'pending',
      error,
      updatedAt: new Date()
    })
    .where(eq(friendInviteRewards.id, id));
}

async function markRewardFailed(id: number, error: string) {
  await db
    .update(friendInviteRewards)
    .set({
      status: 'failed',
      error,
      updatedAt: new Date()
    })
    .where(eq(friendInviteRewards.id, id));
}
