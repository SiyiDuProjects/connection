import { getActiveExtensionTokenInfo, getCreditBalance, getRecentUsage, getSettings, getTeamForUser, getUser } from '@/lib/db/queries';
import { getOnboardingStatus } from '@/lib/onboarding';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const [balanceResult, usageResult, settingsResult, teamResult, extensionTokenResult] = await Promise.allSettled([
    getCreditBalance(user.id),
    getRecentUsage(user.id),
    getSettings(user.id),
    getTeamForUser(),
    getActiveExtensionTokenInfo(user.id)
  ]);

  const balance = balanceResult.status === 'fulfilled' ? balanceResult.value : 0;
  const usage = usageResult.status === 'fulfilled' ? usageResult.value : [];
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
  const team = teamResult.status === 'fulfilled' ? teamResult.value : null;
  const extensionToken = extensionTokenResult.status === 'fulfilled' ? extensionTokenResult.value : null;

  const onboardingProfile = getOnboardingStatus(user, settings);
  const successfulSearch = usage.find((item) => item.action === 'contacts.search' && item.status === 'success');
  const successfulDraft = usage.find((item) => item.action === 'email.draft' && item.status === 'success');

  return Response.json({
    ok: true,
    user,
    credits: {
      balance,
      remaining: balance,
      status: balance > 0 ? 'available' : 'empty',
      costs: {
        search: Number(process.env.CONTACT_SEARCH_CREDITS || 0),
        reveal: Number(process.env.CONTACT_REVEAL_CREDITS || 1),
        draft: Number(process.env.EMAIL_DRAFT_CREDITS || 0)
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
