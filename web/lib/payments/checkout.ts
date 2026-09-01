import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { creditLedger, teamMembers, teams, users } from '@/lib/db/schema';
import { resolveSubscriptionPlan, stripe } from '@/lib/payments/stripe';
import {
  applyPendingFriendInviteRewards,
  grantFriendInvitePurchaseReward
} from '@/lib/payments/friend-invite-rewards';
import { recordProductEvent } from '@/lib/product-events';

export async function handleSuccessfulCheckoutSession(
  sessionId: string,
  options: { expectedUserId?: number } = {}
) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['customer', 'subscription'],
  });

  if (!['paid', 'no_payment_required'].includes(session.payment_status)) {
    return null;
  }

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

  const reachardPlan = await resolveSubscriptionPlan(subscription);
  const productId = reachardPlan.productId;

  if (!productId) {
    throw new Error('No product ID found for this subscription.');
  }

  const userId = session.client_reference_id;
  if (!userId) {
    throw new Error("No user ID found in session's client_reference_id.");
  }
  const parsedUserId = Number(userId);
  if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
    throw new Error("Invalid user ID found in session's client_reference_id.");
  }
  if (options.expectedUserId !== undefined && parsedUserId !== options.expectedUserId) {
    throw new Error('Checkout session does not belong to the signed-in user.');
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, parsedUserId))
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

  await db.transaction(async (tx) => {
    await tx
      .update(teams)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeProductId: productId,
        planName: reachardPlan.name,
        subscriptionStatus: subscription.status,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, userTeam.teamId));

    await tx
      .insert(creditLedger)
      .values({
        userId: user.id,
        amount: reachardPlan.monthlyCredits,
        action: 'subscription.initial_grant',
        metadata: {
          subscriptionId,
          checkoutSessionId: session.id,
          planName: reachardPlan.name
        }
      })
      .onConflictDoNothing();
  });
  await grantFriendInvitePurchaseReward({
    invitedUserId: user.id,
    checkoutSessionId: session.id,
    subscriptionId
  });
  await applyPendingFriendInviteRewards(user.id);

  await recordProductEvent(
    user.id,
    session.payment_status === 'paid' ? 'subscription.paid' : 'subscription.started',
    {
      checkoutSessionId: session.id,
      subscriptionId,
      planName: reachardPlan.name
    }
  );

  return user;
}
