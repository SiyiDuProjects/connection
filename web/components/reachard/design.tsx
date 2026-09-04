'use client';
import { Button, buttonVariants } from '@heroui/react';
import { ArrowUpRight, Moon, Sun, Orbit } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="rd-brand" aria-label="Reachard home"><Orbit size={25} strokeWidth={1.8} />{!compact && <span>reachard</span>}</Link>;
}
export function ThemeSwitch() {
  const [dark, setDark] = useState(false);
  useEffect(() => { const saved = localStorage.getItem('reachard-appearance') === 'dark'; setDark(saved); document.documentElement.classList.toggle('dark', saved); }, []);
  function toggle() { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next); localStorage.setItem('reachard-appearance', next ? 'dark' : 'light'); }
  return <Button isIconOnly variant="ghost" aria-label={dark ? 'Use light appearance' : 'Use dark appearance'} onPress={toggle}>{dark ? <Sun size={17} /> : <Moon size={17} />}</Button>;
}
export function MarketingHeader() {
  const chromeStoreUrl = String(process.env.NEXT_PUBLIC_CHROME_STORE_URL || '').trim();
  return <header className="rd-header"><Brand /><nav aria-label="Main navigation"><Link href="/#how-it-works">How it works</Link><Link href="/pricing">Pricing</Link><Link href="/dashboard">Dashboard</Link><Link href="/workspace-preview">The workspace <ArrowUpRight size={13} /></Link></nav><div className="rd-header-actions"><ThemeSwitch /><Link className="rd-login-link" href="/sign-in">Log in</Link><Link className={buttonVariants({ variant: 'primary' })} href={chromeStoreUrl || '/sign-up'} target={chromeStoreUrl ? '_blank' : undefined} rel={chromeStoreUrl ? 'noreferrer' : undefined}>{chromeStoreUrl ? 'Add to Chrome' : 'Get started'} <ArrowUpRight size={14} /></Link></div></header>;
}
