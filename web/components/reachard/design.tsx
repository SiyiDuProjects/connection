'use client';
import { Button, Tooltip, buttonVariants } from '@heroui/react';
import { ArrowUpRight, Moon, Sun, Orbit } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="rd-brand" aria-label="Reachard home"><Orbit size={25} strokeWidth={1.8} />{!compact && <span>reachard</span>}</Link>;
}
export function ThemeSwitch() {
  const [dark, setDark] = useState(false);
  useEffect(() => { const saved = localStorage.getItem('reachard-appearance') === 'dark'; setDark(saved); document.documentElement.classList.toggle('dark', saved); }, []);
  function toggle() { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next); localStorage.setItem('reachard-appearance', next ? 'dark' : 'light'); }
  const label = dark ? 'Use light appearance' : 'Use dark appearance';
  return <Tooltip><Button isIconOnly variant="ghost" aria-label={label} onPress={toggle}>{dark ? <Sun size={17} /> : <Moon size={17} />}</Button><Tooltip.Content>{label}</Tooltip.Content></Tooltip>;
}
export function PageHeader({ actions, className = '' }: { actions: ReactNode; className?: string }) {
  return <header className={`rd-header ${className}`}><Brand /><nav aria-label="Main navigation"><Link href="/#how-it-works">How it works</Link><Link href="/pricing">Pricing</Link></nav><div className="rd-header-actions">{actions}</div></header>;
}
export function MarketingHeader() {
  return <PageHeader actions={<><ThemeSwitch /><Link className={buttonVariants({ variant: 'secondary' })} href="/sign-up">Get started <ArrowUpRight size={14} /></Link></>} />;
}
