'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';
import { AppHeader } from '@/components/app-header';

type AccountSummary = {
  user?: {
    id?: number;
    name: string | null;
    email: string;
  };
  credits?: {
    remaining: number;
  };
  onboarding?: {
    profile?: {
      complete: boolean;
    };
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useSWR<AccountSummary>('/api/account', fetcher);

  useEffect(() => {
    if (data && data.onboarding && !data.onboarding.profile?.complete) {
      router.replace(`/onboarding?redirect=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [data, pathname, router]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <AppHeader account={data} />

      {children}
    </div>
  );
}
