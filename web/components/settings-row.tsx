'use client';

import type { ReactNode } from 'react';

// SettingsRow layout copied from the supplied Pro dashboard template:
// components/heroui-dashboard-template/views/settings-page.tsx, 8179d25c.
export function SettingsRow({ children, description, label }: {
  description: string; label: string; children: ReactNode;
}) {
  return <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-10">
    <div className="flex flex-col gap-1">
      <span className="text-foreground text-sm font-medium">{label}</span>
      <p className="text-muted text-xs leading-snug">{description}</p>
    </div>
    <div className="flex min-w-0 flex-col gap-3">{children}</div>
  </div>;
}
