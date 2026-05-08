'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Chrome, Home, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut } from '@/app/(login)/actions';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db/schema';
import useSWR, { mutate } from 'swr';
import {
  ExtensionSessionBridge,
  clearExtensionSessionBeforeSignOut
} from '@/components/extension-session-bridge';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/components/language-provider';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const router = useRouter();
  const { t } = useI18n();

  async function handleSignOut() {
    await clearExtensionSessionBeforeSignOut();
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  if (!user) {
    return (
      <>
        <Link
          href="/sign-in"
          className="hidden text-sm font-medium text-slate-500 hover:text-slate-950 sm:inline-flex"
        >
          Log in
        </Link>
        <Button asChild className="h-9 rounded-[8px] bg-slate-950 px-4 text-sm font-medium text-white shadow-none hover:bg-slate-800">
          <Link href="/sign-up">
            <Chrome className="mr-2 h-4 w-4" />
            Add to Chrome
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <ExtensionSessionBridge user={user} />
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Link href="/dashboard" aria-label={t('nav.dashboard')}>
          <Avatar className="cursor-pointer size-9">
            <AvatarImage alt={user.name || ''} />
            <AvatarFallback>
              {user.email
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
          </Link>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex flex-col gap-1">
          <DropdownMenuItem className="cursor-pointer">
            <Link href="/dashboard" className="flex w-full items-center">
              <Home className="mr-2 h-4 w-4" />
              <span>{t('nav.dashboard')}</span>
            </Link>
          </DropdownMenuItem>
          <form action={handleSignOut} className="w-full">
            <button type="submit" className="flex w-full">
              <DropdownMenuItem className="w-full flex-1 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('nav.signOut')}</span>
              </DropdownMenuItem>
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function Header() {
  const pathname = usePathname();

  if (pathname.startsWith('/dashboard')) return null;

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
            G
          </span>
          <span className="text-base font-semibold text-slate-950">Reachard</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Suspense fallback={<div className="h-9" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col min-h-screen">
      <Header />
      {children}
    </section>
  );
}
