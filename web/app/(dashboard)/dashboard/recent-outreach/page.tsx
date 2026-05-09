'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DashboardSidebar } from '../dashboard-sidebar';
import { RecentOutreachList, recentOutreach, type RecentUsageRow } from '../recent-outreach-list';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type AccountData = {
  user?: {
    name: string | null;
    email: string;
  };
  credits?: {
    remaining: number;
  };
  settings?: {
    senderName?: string | null;
    school?: string | null;
    region?: string | null;
    targetRole?: string | null;
  } | null;
  usage?: RecentUsageRow[];
};

type InviteData = {
  ok: boolean;
  link?: string;
};

export default function RecentOutreachPage() {
  const { data } = useSWR<AccountData>('/api/account', fetcher);
  const { data: inviteData, mutate: mutateInvite } = useSWR<InviteData>('/api/invite-friend', fetcher);
  const [inviteStatus, setInviteStatus] = useState('');
  const [inviteCopying, setInviteCopying] = useState(false);
  const outreach = recentOutreach(data?.usage);

  async function copyInviteLink() {
    setInviteCopying(true);
    setInviteStatus('');
    try {
      let link = inviteData?.link || '';
      if (!link) {
        const response = await fetch('/api/invite-friend', { method: 'GET' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok || !payload.link) {
          throw new Error(payload.error || 'Could not load invite link.');
        }
        link = payload.link;
        mutateInvite(payload, false);
      }
      try {
        await navigator.clipboard.writeText(link);
        setInviteStatus('Invite link copied.');
      } catch {
        setInviteStatus('Copy blocked. Try again from a secure browser window.');
      }
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : 'Could not copy invite link.');
    } finally {
      setInviteCopying(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-64px)] p-6">
      <section className="mx-auto grid max-w-[1240px] grid-cols-1 gap-4 2xl:grid-cols-[304px_minmax(0,1fr)]">
        <DashboardSidebar
          account={data}
          inviteCopying={inviteCopying}
          inviteStatus={inviteStatus}
          onCopyInviteLink={copyInviteLink}
        />

        <section className="flex min-h-0 flex-col overflow-visible">
          <section className="rounded-[8px] bg-white p-4 shadow-[0_18px_70px_rgba(15,23,42,0.04)]">
            <h2 className="text-base font-semibold text-slate-950">Recent outreach</h2>
            <RecentOutreachList outreach={outreach} />
          </section>
        </section>
      </section>
    </main>
  );
}
