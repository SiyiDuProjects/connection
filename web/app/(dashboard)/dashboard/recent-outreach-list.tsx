'use client';

import { Chip } from '@heroui/react';

import { useI18n } from '@/components/language-provider';
import { translate, type Language } from '@/lib/i18n';

export type RecentUsageRow = {
  id: number;
  action: string;
  createdAt: string;
  request?: {
    companyName?: string;
    jobTitle?: string;
  };
};

export function recentOutreach(usage: RecentUsageRow[] | undefined, language: Language = 'en') {
  return (usage || [])
    .filter((item) => item.action === 'email.draft' || item.action === 'contacts.reveal')
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: formatActionName(item.action, language),
      detail: [item.request?.jobTitle, item.request?.companyName]
        .filter(Boolean)
        .join(' @ ') || translate(language, 'activity.detailFallback'),
      time: formatRelative(item.createdAt, language)
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
  const { t } = useI18n();
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
            <Chip size="sm" className="shrink-0">
              {item.time}
            </Chip>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatActionName(action: string, language: Language) {
  if (action === 'email.draft') return translate(language, 'activity.draftCreated');
  if (action === 'contacts.reveal') return translate(language, 'activity.emailUnlocked');
  return translate(language, 'activity.outreach');
}

function formatRelative(value: string | undefined, language: Language) {
  if (!value) return translate(language, 'activity.recently');
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return translate(language, 'activity.today');
  if (days === 1) return translate(language, 'activity.oneDayAgo');
  return translate(language, 'activity.daysAgo', { count: days });
}
