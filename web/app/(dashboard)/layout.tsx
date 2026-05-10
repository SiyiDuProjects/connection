'use client';

import { AppHeader } from '@/components/app-header';
import { usePathname } from 'next/navigation';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isOnboarding = pathname.startsWith('/onboarding');

  return (
    <section className="flex flex-col min-h-screen">
      <AppHeader
        hideOnDashboard
        variant={isHome ? 'hero' : 'default'}
        className={
          isHome
            ? 'absolute inset-x-0 top-0 z-40 bg-transparent'
            : isOnboarding
              ? 'absolute inset-x-0 top-0 z-40 bg-white'
              : 'absolute inset-x-0 top-0 z-40'
        }
      />
      {children}
    </section>
  );
}
