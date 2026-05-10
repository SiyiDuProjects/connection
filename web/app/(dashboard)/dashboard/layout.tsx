import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { getCreditBalance, getSettings, getUser } from '@/lib/db/queries';
import { getOnboardingStatus } from '@/lib/onboarding';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const [settings, credits] = await Promise.all([
    getSettings(user.id),
    getCreditBalance(user.id)
  ]);
  const onboarding = getOnboardingStatus(user, settings);
  if (!onboarding.complete) {
    const pathname = (await headers()).get('x-pathname') || '/dashboard';
    redirect(`/onboarding?redirect=${encodeURIComponent(pathname)}`);
  }

  return (
    <div className="min-h-[100dvh] bg-[#f5f5f7] text-foreground">
      <AppHeader
        className="bg-[#f5f5f7]"
        account={{
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          },
          credits: {
            remaining: credits
          }
        }}
      />

      {children}
    </div>
  );
}
