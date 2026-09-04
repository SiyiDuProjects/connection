import { getActiveExtensionTokenInfo, getCreditBalance, getRecentUsage, getSettings, getTeamForUser, getUser } from '@/lib/db/queries';
import { getOnboardingStatus } from '@/lib/onboarding';
import { toPublicUser } from '@/lib/auth/public-user';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const accountData = await Promise.all([
      getCreditBalance(user.id),
      getRecentUsage(user.id),
      getSettings(user.id),
      getTeamForUser(),
      getActiveExtensionTokenInfo(user.id)
    ]).catch((error) => {
    console.error('Could not load account data:', error);
    return null;
  });
  if (!accountData) {
    return Response.json(
      { ok: false, error: 'Account data is temporarily unavailable.' },
      { status: 503 }
    );
  }
  const [balance, usage, settings, team, extensionToken] = accountData;

  const onboardingProfile = getOnboardingStatus(user, settings);
  const successfulSearch = usage.find((item) => item.action === 'contacts.search' && item.status === 'success');
  const successfulDraft = usage.find((item) => item.action === 'email.draft' && item.status === 'success');

  return Response.json({
    ok: true,
    user: toPublicUser(user),
    credits: {
      balance,
      remaining: balance,
      status: isBetaUnlimitedUsage() ? 'unlimited' : balance > 0 ? 'available' : 'empty',
      unlimited: isBetaUnlimitedUsage(),
      costs: {
        search: creditCost('CONTACT_SEARCH_CREDITS', 0),
        reveal: creditCost('CONTACT_REVEAL_CREDITS', 1),
        draft: creditCost('EMAIL_DRAFT_CREDITS', 0)
      }
    },
    usage,
    settings,
    subscription: {
      planName: team?.planName || 'Free',
      status: team?.subscriptionStatus || 'inactive'
    },
    extension: {
      connected: Boolean(extensionToken),
      lastUsedAt: extensionToken?.lastUsedAt || null
    },
    onboarding: {
      profile: {
        complete: onboardingProfile.complete,
        completedFields: onboardingProfile.completedFields,
        totalFields: onboardingProfile.totalFields,
        missingFields: onboardingProfile.missingFields
      },
      extension: {
        connected: Boolean(extensionToken),
        lastUsedAt: extensionToken?.lastUsedAt || null
      },
      linkedIn: {
        recentSuccessfulSearchAt: successfulSearch?.createdAt || null
      },
      draft: {
        recentSuccessfulDraftAt: successfulDraft?.createdAt || null
      },
      billing: {
        planName: team?.planName || 'Free',
        status: team?.subscriptionStatus || 'inactive',
        creditsRemaining: balance
      }
    }
  });
}

function creditCost(name: string, fallback: number) {
  if (isBetaUnlimitedUsage()) return 0;
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return value;
}

function isBetaUnlimitedUsage() {
  const configured = String(process.env.BETA_UNLIMITED_USAGE || '').trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(configured)) return false;
  if (['1', 'true', 'yes', 'on'].includes(configured)) return true;

  return true;
}
