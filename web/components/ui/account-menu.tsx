'use client';

import { Avatar, Button, Dropdown, Label } from '@heroui/react';
import { ChevronDown } from 'lucide-react';

type Props = {
  initials: string;
  labels: { menu: string; account: string; settings: string; signOut: string };
  onAccount: () => void;
  onSettings: () => void;
  onSignOut: () => void;
};

export function AccountDropdown({ initials, labels, onAccount, onSettings, onSignOut }: Props) {
  return <Dropdown>
    <Button aria-label={labels.menu} variant="ghost">
      <Avatar size="sm"><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
      <ChevronDown size={16} aria-hidden="true" />
    </Button>
    <Dropdown.Popover placement="bottom end">
      <Dropdown.Menu aria-label={labels.menu}>
        <Dropdown.Item id="account" onAction={onAccount} textValue={labels.account}><Label>{labels.account}</Label></Dropdown.Item>
        <Dropdown.Item id="settings" onAction={onSettings} textValue={labels.settings}><Label>{labels.settings}</Label></Dropdown.Item>
        <Dropdown.Item id="logout" variant="danger" onAction={onSignOut} textValue={labels.signOut}><Label>{labels.signOut}</Label></Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>;
}
