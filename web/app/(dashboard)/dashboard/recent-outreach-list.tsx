'use client';

import { translate as t } from '@/lib/i18n';

export type RecentUsageRow = {
  id: number;
  action: string;
  createdAt: string;
  request?: {
    companyName?: string;
    jobTitle?: string;
  };
};

export function recentOutreach(usage: RecentUsageRow[] | undefined) {
  return (usage || [])
    .filter((item) => item.action === 'email.draft' || item.action === 'contacts.reveal')
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: formatActionName(item.action),
      detail: [item.request?.jobTitle, item.request?.companyName]
        .filter(Boolean)
        .join(' @ ') || t('activity.detailFallback'),
      time: formatRelative(item.createdAt)
    }));
}

export function RecentOutreachList({
  outreach,
  compact,
  plain
}: {
  outreach: ReturnType<typeof recentOutreach>;
  compact?: boolean;
  plain?: boolean;
}) {
  if (!outreach.length) {
    return (
      <div className={plain ? 'p-0' : 'mt-3 rounded-[8px] bg-white p-4'}>
        <p className="value">{t('activity.none')}</p>
        <p className="secondary mt-1">
          {t('activity.noneHelp')}
        </p>
      </div>
    );
  }

  return (
    <div className={plain ? 'space-y-3' : compact ? 'mt-2 divide-y divide-slate-200' : 'mt-3 divide-y divide-slate-200'}>
      {outreach.map((item) => (
        <article key={item.id} className={plain ? 'p-0' : 'py-2.5'}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="value">{item.title}</p>
              <p className="secondary mt-1">{item.detail}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {item.time}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatActionName(action: string) {
  if (action === 'email.draft') return t('activity.draftCreated');
  if (action === 'contacts.reveal') return t('activity.emailUnlocked');
  return t('activity.outreach');
}

function formatRelative(value: string | undefined) {
  if (!value) return t('activity.recently');
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return t('activity.today');
  if (days === 1) return t('activity.oneDayAgo');
  return t('activity.daysAgo', { count: days });
}
