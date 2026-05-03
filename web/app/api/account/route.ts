import { getActiveExtensionTokenInfo, getCreditBalance, getRecentUsage, getSettings, getTeamForUser, getUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [balance, usage, settings, team, extensionToken] = await Promise.all([
    getCreditBalance(user.id),
    getRecentUsage(user.id),
    getSettings(user.id),
    getTeamForUser(),
    getActiveExtensionTokenInfo(user.id)
  ]);

  return Response.json({
    user,
    credits: { balance },
    usage,
    settings,
    subscription: {
      planName: team?.planName || 'Free',
      status: team?.subscriptionStatus || 'inactive'
    },
    extension: {
      connected: Boolean(extensionToken),
      lastUsedAt: extensionToken?.lastUsedAt || null
    }
  });
}
