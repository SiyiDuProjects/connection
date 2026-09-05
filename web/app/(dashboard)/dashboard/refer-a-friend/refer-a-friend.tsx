'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Button, Card, Input } from '@heroui/react';
import { Check, Copy, Gift } from 'lucide-react';

type FriendInvite = { link: string; code: string; acceptedCount: number };

async function fetchInvite(url: string): Promise<FriendInvite> {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload.ok || !payload.link) {
    throw new Error(payload.error || 'Could not load your referral link.');
  }
  return payload;
}

export default function ReferAFriend({ preview = false }: { preview?: boolean }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<FriendInvite>(
    preview ? null : '/api/invite-friend', fetchInvite
  );
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyLink() {
    if (!data?.link) return;
    setCopyError('');
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
    } catch {
      setCopyError('Select the link above and copy it manually.');
    }
  }

  return <div className="dashboard-page-content">
    <div className="mx-auto max-w-[760px] space-y-6">
      <div className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Gift className="size-5" aria-hidden="true" /></div>
        <h2 className="text-2xl font-semibold tracking-tight">Good things are worth sharing.</h2>
        <p className="max-w-xl text-sm leading-6 text-muted">Invite a friend to Reachard. When they subscribe, you get one month free.</p>
      </div>
      <Card className="rounded-2xl">
        <Card.Header><Card.Title>Your referral link</Card.Title><Card.Description>Share it with a friend who could use a way in.</Card.Description></Card.Header>
        <Card.Content className="space-y-4">
          {error ? <div role="alert" className="space-y-3"><p className="text-sm text-danger">{error.message}</p><Button size="sm" variant="secondary" isDisabled={isValidating} onPress={() => void mutate()}>Try again</Button></div> : <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input aria-label="Your referral link" className="min-w-0 flex-1"
                readOnly disabled={!data?.link} value={data?.link || ''}
                placeholder={isLoading ? 'Loading your link…' : preview ? 'Sign in to get your referral link' : 'Referral link unavailable'}
                onFocus={event => event.currentTarget.select()} />
              <Button variant="primary" isDisabled={!data?.link} onPress={() => void copyLink()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            {data ? <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted"><span>Invite code <span className="ml-1 font-mono text-foreground">{data.code}</span></span><span>{data.acceptedCount} {data.acceptedCount === 1 ? 'friend has' : 'friends have'} joined</span></div> : null}
            {preview ? <p className="text-sm text-muted"><Link href="/sign-in" className="text-accent underline">Sign in</Link> to get your link and see how many friends joined.</p> : null}
          </>}
          <p role="status" aria-live="polite" className={copyError ? 'text-sm text-danger' : 'sr-only'}>{copyError || (copied ? 'Referral link copied.' : '')}</p>
        </Card.Content>
      </Card>
      <div className="space-y-3 text-sm leading-6">
        <h3 className="font-semibold">How it works</h3>
        <ol className="list-decimal space-y-2 pl-5 text-muted">
          <li>Your friend signs up through your link.</li>
          <li>They purchase a Reachard subscription.</li>
          <li>You receive one month of your plan as credit toward future bills.</li>
        </ol>
        <p className="text-xs leading-5 text-muted">Only friends you invite directly count. If you don’t have an active plan yet, your reward waits until you subscribe.</p>
      </div>
    </div>
  </div>;
}
