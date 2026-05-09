import Stripe from 'stripe';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { creditLedger, teamMembers, teams, users } from '@/lib/db/schema';
import { stripe } from '@/lib/payments/stripe';
import {
  applyPendingFriendInviteRewards,
  grantFriendInvitePurchaseReward
} from '@/lib/payments/friend-invite-rewards';

export async function handleSuccessfulCheckoutSession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['customer', 'subscription'],
  });

  if (!session.customer || typeof session.customer === 'string') {
    throw new Error('Invalid customer data from Stripe.');
  }

  const customerId = session.customer.id;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    throw new Error('No subscription found for this session.');
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price.product'],
  });

  const plan = subscription.items.data[0]?.price;

  if (!plan) {
    throw new Error('No plan found for this subscription.');
  }

  const productId = (plan.product as Stripe.Product).id;

  if (!productId) {
    throw new Error('No product ID found for this subscription.');
  }

  const userId = session.client_reference_id;
  if (!userId) {
    throw new Error("No user ID found in session's client_reference_id.");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(userId)))
    .limit(1);

  if (!user) {
    throw new Error('User not found in database.');
  }

  const [userTeam] = await db
    .select({
      teamId: teamMembers.teamId,
    })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (!userTeam) {
    throw new Error('User is not associated with any team.');
  }

  await db
    .update(teams)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeProductId: productId,
      planName: (plan.product as Stripe.Product).name,
      subscriptionStatus: subscription.status,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, userTeam.teamId));

  await grantInitialSubscriptionCredits(user.id, subscriptionId, session.id);
  await grantFriendInvitePurchaseReward({
    invitedUserId: user.id,
    checkoutSessionId: session.id,
    subscriptionId
  });
  await applyPendingFriendInviteRewards(user.id);

  return user;
}

async function grantInitialSubscriptionCredits(
  userId: number,
  subscriptionId: string,
  checkoutSessionId: string
) {
  const existingGrant = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.action, 'subscription.initial_grant'),
        sql`${creditLedger.metadata}->>'subscriptionId' = ${subscriptionId}`
      )
    )
    .limit(1);

  if (existingGrant.length > 0) {
    return;
  }

  await db.insert(creditLedger).values({
    userId,
    amount: Number(process.env.MONTHLY_CREDITS || 20),
    action: 'subscription.initial_grant',
    metadata: { subscriptionId, checkoutSessionId }
  });
}
