'use client';

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Navbar, Sidebar } from '@heroui-pro/react';

// Adapted from heroui-v3-templates/web/dashboard. Page content and navigation
// stay separate so the account dashboard and workspace share one shell.
export function DashboardFrame({ title, sidebar, actions, children, onNavigate }: {
  title: string;
  sidebar: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  onNavigate?: (href: string) => void;
}) {
  const router = useRouter();
  const navigate = useCallback((href: string) => router.push(href), [router]);
  return (
    <AppLayout
      className="default reachard-dashboard"
      navigate={onNavigate || navigate}
      sidebar={sidebar}
      sidebarCollapsible="offcanvas"
      scrollMode="content"
      navbar={
        <Navbar maxWidth="full" className="dashboard-navbar bg-background">
          <Navbar.Header>
            <AppLayout.MenuToggle aria-label="Open navigation" />
            <Sidebar.Trigger aria-label="Toggle navigation" />
            <h1 className="truncate text-base font-semibold sm:text-xl">{title}</h1>
            <Navbar.Spacer />
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </Navbar.Header>
        </Navbar>
      }
    >{children}</AppLayout>
  );
}
