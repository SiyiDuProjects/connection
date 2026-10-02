'use client';
import Link from 'next/link';
import { Button, buttonVariants } from '@heroui/react';
import { useExtensionStatus } from './use-extension-status';
import { ExtensionInstallLink } from './extension-install-link';

export function ExtensionNextStep({ compact = false }: { compact?: boolean }) {
  const { status, check } = useExtensionStatus();
  if (status === 'checking') return <span className="text-sm text-muted" role="status">Checking extension…</span>;
  if (status === 'detected') return <div className="flex flex-wrap items-center justify-center gap-3">
    <span className="text-sm text-muted">Extension installed</span>
    <a href="https://www.linkedin.com/jobs/" className={buttonVariants({ size: 'sm', variant: compact ? 'secondary' : 'primary' })}>Open LinkedIn jobs</a>
  </div>;
  return <div className="flex flex-wrap items-center justify-center gap-2">
    {!compact && <p className="basis-full text-center text-sm text-muted">Could not confirm the extension in this browser.</p>}
    <ExtensionInstallLink label="Add to Chrome" size="sm" />
    <Button size="sm" variant="ghost" onPress={() => void check()}>Check again</Button>
    {!compact && <Link href="/getting-started" className="text-sm text-accent underline">Already installed? Reload this tab</Link>}
  </div>;
}
