export type RecentUsageRow = {
  id: number;
  action: string;
  createdAt: string;
  request?: {
    companyName?: string;
    jobTitle?: string;
    targetRole?: string;
  };
};

export function recentOutreach(usage: RecentUsageRow[] | undefined) {
  return (usage || [])
    .filter((item) => item.action === 'email.draft' || item.action === 'contacts.reveal')
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: formatActionName(item.action),
      detail: [item.request?.jobTitle || item.request?.targetRole, item.request?.companyName]
        .filter(Boolean)
        .join(' @ ') || 'Outreach activity',
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
        <p className="value">No outreach yet.</p>
        <p className="secondary mt-1">
          Drafted or unlocked emails will appear here.
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
  if (action === 'email.draft') return 'Draft created';
  if (action === 'contacts.reveal') return 'Email unlocked';
  return 'Outreach';
}

function formatRelative(value?: string) {
  if (!value) return 'recently';
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}
