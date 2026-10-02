'use client';
import { BRAND_MARK_PATH, BRAND_NAME } from '@/lib/brand';
import { Button, Tooltip } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AccountEntry } from '@/components/account-entry';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="rd-brand" aria-label={`${BRAND_NAME} home`}><img src={BRAND_MARK_PATH} width={25} height={25} alt="" />{!compact && <span>{BRAND_NAME}</span>}</Link>;
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
  return <PageHeader actions={<><ThemeSwitch /><AccountEntry /></>} />;
}
