'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Avatar, Button, Dropdown, Label, buttonVariants } from '@heroui/react';
import { signOut } from '@/app/(login)/actions';
import { ExtensionSessionBridge, clearExtensionSessionBeforeSignOut } from '@/components/extension-session-bridge';
import { PageHeader, ThemeSwitch } from '@/components/reachard/design';

type HeaderUser = { id?: number; name: string | null; email: string };
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function AppHeader({ hideOnDashboard = false, className }: { hideOnDashboard?: boolean; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useSWR<HeaderUser | null>('/api/user', fetcher);
  async function handleSignOut() {
    await clearExtensionSessionBeforeSignOut();
    await signOut();
    await mutate('/api/user', null, false);
    router.push('/');
  }
  if (hideOnDashboard && pathname.startsWith('/dashboard')) return null;
  return <>
    {user && <ExtensionSessionBridge user={user} />}
    <PageHeader className={className} actions={<><ThemeSwitch />{user ? <Dropdown>
      <Button variant="ghost" aria-label="Account menu">
        <Avatar size="sm" color="accent"><Avatar.Fallback>{(user.name || user.email).slice(0, 1).toUpperCase()}</Avatar.Fallback></Avatar>
      </Button>
      <Dropdown.Popover><Dropdown.Menu aria-label="Account">
        <Dropdown.Item id="dashboard" href="/dashboard" textValue="Dashboard"><Label>Dashboard</Label></Dropdown.Item>
        <Dropdown.Item id="settings" href="/dashboard/general" textValue="Settings"><Label>Settings</Label></Dropdown.Item>
        <Dropdown.Item id="sign-out" variant="danger" textValue="Log out" onAction={() => void handleSignOut()}><Label>Log out</Label></Dropdown.Item>
      </Dropdown.Menu></Dropdown.Popover>
    </Dropdown> : <Link className={buttonVariants({ variant: 'secondary' })} href="/sign-up">Get started</Link>}</>} />
  </>;
}
