'use client';

import { AppHeader } from '@/components/app-header';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col min-h-screen">
      <AppHeader
        hideOnDashboard
        className="absolute inset-x-0 top-0 z-40"
      />
      {children}
    </section>
  );
}
