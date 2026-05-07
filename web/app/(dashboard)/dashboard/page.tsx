'use client';

import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const buttonShadow = 'transition-all hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]';

type UsageRow = {
  id: number;
  action: string;
  credits: number;
  status: string;
  createdAt: string;
  request?: {
    companyName?: string;
    jobTitle?: string;
    targetRole?: string;
  };
};

type Settings = {
  senderName?: string | null;
  region?: string | null;
  school?: string | null;
  emailSignature?: string | null;
  introStyle?: 'student' | 'career-switcher' | 'experienced' | 'founder' | null;
  emailTone?: 'warm' | 'concise' | 'confident' | 'formal' | null;
  targetRole?: string | null;
  outreachLength?: 'short' | 'concise' | 'detailed' | null;
  outreachGoal?: 'advice' | 'referral' | 'intro' | null;
  outreachStyleNotes?: string | null;
  senderProfile?: string | null;
  resumeContext?: string | null;
  resumeFileName?: string | null;
};

type AccountData = {
  user?: {
    name: string | null;
    email: string;
  };
  credits: {
    remaining: number;
    balance: number;
  };
  settings?: Settings | null;
  subscription?: {
    planName?: string;
    status?: string;
  };
  extension?: {
    connected: boolean;
    lastUsedAt: string | null;
  };
  usage: UsageRow[];
};

export default function DashboardPage() {
  const { data } = useSWR<AccountData>('/api/account', fetcher);
  const settings = data?.settings;
  const name = settings?.senderName || data?.user?.name || displayName(data?.user);
  const targetRoles = settings?.targetRole || 'Add target roles';
  const outreach = recentOutreach(data?.usage);

  return (
    <main className="h-[calc(100dvh-64px)] overflow-hidden px-6 py-3">
      <section
        className="mx-auto grid h-full max-w-[1240px] gap-8"
        style={{ gridTemplateColumns: '304px minmax(0, 1fr)' }}
      >
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white/78 p-4 shadow-[0_18px_70px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,rgba(96,165,250,0.18),rgba(129,140,248,0.22))] text-xl font-semibold text-indigo-600">
              {initialsFromName(name)}
            </span>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">{name}</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {settings?.school || 'Add school or affiliation'}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {settings?.region || 'Add region'}
            </p>
            <p className="mx-auto mt-2 max-w-[210px] text-sm font-medium leading-5 text-slate-500">
              Interested in <span className="font-semibold text-indigo-600">{targetRoles}</span>
            </p>
            <Link
              href="/dashboard/profile"
              className={`mt-3 inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 ${buttonShadow}`}
            >
              Edit profile
            </Link>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-950">Outreach style</p>
            <StatusItem label={toneLabel(settings?.emailTone)} detail="Tone" />
            <StatusItem label={lengthLabel(settings?.outreachLength)} detail="Length" />
            <StatusItem label={introStyleLabel(settings?.introStyle)} detail="Intro style" />
          </div>

          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-950">Prioritizing</p>
            <StatusItem label="Alumni" />
            <StatusItem label="Hiring managers" />
            <StatusItem label="Recent hires" />
          </div>

          <div className="mt-auto rounded-[8px] border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {data?.extension?.connected ? 'Extension active' : 'Extension inactive'}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {data?.extension?.connected ? 'Ready in your browser' : 'Connect when ready'}
                </p>
              </div>
              <span className={`h-3 w-3 rounded-full ${data?.extension?.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm font-medium">
            <span className="text-slate-500">
              {formatNumber(data?.credits?.remaining)} credits
            </span>
            <Link href="/pricing" className="font-semibold text-indigo-600">
              View plans
            </Link>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="mb-3">
            <h1 className="text-[28px] font-semibold leading-tight text-slate-950">
              Welcome back, {firstName(name)}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Manage your outreach preferences and recent activity.
            </p>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
            <section className="rounded-[8px] border border-slate-200 bg-white/80 p-3 shadow-[0_18px_70px_rgba(15,23,42,0.04)] backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-950">Outreach preferences</h2>
                <Link
                  href="/dashboard/profile"
                  className={`inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 ${buttonShadow}`}
                >
                  Edit
                </Link>
              </div>
              <PreferenceRow label="Tone" value={toneDescription(settings?.emailTone)} />
              <PreferenceRow label="Target roles" value={targetRoles} />
              <PreferenceRow label="Prioritize" value="Alumni, hiring managers, recent hires" />
              <PreferenceRow label="Email length" value={lengthLabel(settings?.outreachLength)} last />
            </section>

            <section className="rounded-[8px] border border-slate-200 bg-white/80 p-3 shadow-[0_18px_70px_rgba(15,23,42,0.04)] backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-950">Resume & context</h2>
                <Link
                  href="/dashboard/profile"
                  className={`inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 ${buttonShadow}`}
                >
                  Replace
                </Link>
              </div>
              <div className="rounded-[8px] bg-slate-50/80 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {settings?.resumeFileName || 'No resume added'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {settings?.resumeContext ? 'Resume context saved' : 'Add resume context to improve outreach drafts'}
                  </p>
                </div>
              </div>
            </section>

            <section
              id="recent-outreach"
              className="min-h-0 rounded-[8px] border border-slate-200 bg-white/80 p-3 shadow-[0_18px_70px_rgba(15,23,42,0.04)] backdrop-blur-xl"
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-950">Recent outreach</h2>
              </div>
              {outreach.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {outreach.map((item) => (
                    <article key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">{item.detail}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {item.time}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[96px] flex-col justify-center rounded-[8px] border border-dashed border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-sm font-semibold text-slate-950">No outreach yet.</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    Drafted or unlocked emails will appear here.
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

function PreferenceRow({
  label,
  value,
  last
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <Link
      href="/dashboard/profile"
      className={`grid grid-cols-[180px_1fr] items-center gap-3 rounded-[6px] px-2 py-2 transition-colors hover:bg-slate-50 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <p className="text-sm font-medium text-slate-500">{value}</p>
    </Link>
  );
}

function StatusItem({
  label,
  detail
}: {
  label: string;
  detail?: string;
}) {
  return (
    <div className="mt-2.5">
      <div>
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        {detail ? <p className="text-xs font-medium text-slate-500">{detail}</p> : null}
      </div>
    </div>
  );
}

function recentOutreach(usage: UsageRow[] | undefined) {
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

function formatActionName(action: string) {
  if (action === 'email.draft') return 'Draft created';
  if (action === 'contacts.reveal') return 'Email unlocked';
  return 'Outreach';
}

function toneLabel(value?: Settings['emailTone']) {
  if (value === 'concise') return 'Concise';
  if (value === 'confident') return 'Confident';
  if (value === 'formal') return 'Formal';
  return 'Thoughtful';
}

function toneDescription(value?: Settings['emailTone']) {
  if (value === 'concise') return 'Concise, direct, casual';
  if (value === 'confident') return 'Confident, thoughtful, casual';
  if (value === 'formal') return 'Formal, thoughtful, polished';
  return 'Concise, thoughtful, casual';
}

function lengthLabel(value?: Settings['outreachLength']) {
  if (value === 'short') return 'Short';
  if (value === 'detailed') return 'Detailed';
  return 'Concise';
}

function introStyleLabel(value?: Settings['introStyle']) {
  if (value === 'career-switcher') return 'Career switcher';
  if (value === 'experienced') return 'Experienced';
  if (value === 'founder') return 'Founder';
  return 'Warm';
}

function displayName(user?: AccountData['user']) {
  if (!user) return 'Reachard user';
  return user.name || user.email.split('@')[0];
}

function firstName(value: string) {
  return value.split(' ')[0] || value;
}

function initialsFromName(value: string) {
  return value
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatRelative(value?: string) {
  if (!value) return 'recently';
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function formatNumber(value?: number) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '...';
}
