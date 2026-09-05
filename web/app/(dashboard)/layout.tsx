'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const AppHeader = dynamic(() => import('@/components/app-header').then((module) => module.AppHeader));

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isMarketing = isHome || pathname === '/pricing';
  const isOnboarding = pathname.startsWith('/onboarding');
  const isWorkspacePreview = pathname === '/workspace-preview';

  return (
    <section className="flex flex-col min-h-screen">
      {isWorkspacePreview || isMarketing ? null : (
        <AppHeader
          hideOnDashboard
          variant={isMarketing ? 'hero' : 'default'}
          className={
            isMarketing
              ? 'absolute inset-x-0 top-0 z-40 bg-transparent'
              : isOnboarding
                ? 'absolute inset-x-0 top-0 z-40 bg-white'
                : 'absolute inset-x-0 top-0 z-40'
          }
        />
      )}
      {children}
    </section>
  );
}
