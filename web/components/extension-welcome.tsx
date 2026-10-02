'use client';
import { BRAND_NAME } from '@/lib/brand';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Modal, buttonVariants } from '@heroui/react';
import { Puzzle } from 'lucide-react';
import { useExtensionStatus } from '@/components/use-extension-status';

export function ExtensionWelcome({ userId }: { userId: number }) {
  const { status } = useExtensionStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const key = `reachard-extension-welcome-v1:${userId}`;

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(key) === 'seen'; } catch { /* Storage may be restricted. */ }
    if (!seen && !dismissed && status === 'unconfirmed') setIsOpen(true);
    if (status === 'detected') setIsOpen(false);
  }, [status, key, dismissed]);

  function close() {
    setDismissed(true); setIsOpen(false);
    try { localStorage.setItem(key, 'seen'); } catch { /* Keep dismissal for this visit. */ }
  }

  return <ExtensionWelcomeDialog isOpen={isOpen} onClose={close} />;
}

export function ExtensionWelcomeDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <Modal.Backdrop isOpen={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <Modal.Container size="sm"><Modal.Dialog>
      <Modal.CloseTrigger />
      <Modal.Header><Modal.Icon><Puzzle size={24} /></Modal.Icon><Modal.Heading>Your next step is in your browser</Modal.Heading></Modal.Header>
      <Modal.Body><p>{BRAND_NAME} finds people and helps you write outreach right on a job page. Get the extension, pin it, then open a role you like.</p><p className="mt-3 text-sm text-muted">Your Dashboard keeps your profile, activity and account in one place.</p></Modal.Body>
      <Modal.Footer className="flex-wrap">
        <Button variant="tertiary" onPress={onClose}>Later</Button>
        <Link href="/getting-started" onClick={onClose} className={buttonVariants({ variant: 'primary' })}>Set up {BRAND_NAME}</Link>
      </Modal.Footer>
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
}
