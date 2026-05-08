'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { ChevronDown } from 'lucide-react';

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
  resumeUploadedAt?: string | null;
  defaultSearchPreferences?: {
    school?: {
      label: string;
      linkedinId: string;
    };
    region?: {
      label: string;
      linkedinGeoId: string;
    };
  };
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

type PreferenceKey = 'targetRole' | 'outreachGoal' | 'outreachLength' | 'outreachStyleNotes';

export default function DashboardPage() {
  const { data, mutate } = useSWR<AccountData>('/api/account', fetcher);
  const [resumeStatus, setResumeStatus] = useState('');
  const [resumeSaving, setResumeSaving] = useState(false);
  const [editingPreference, setEditingPreference] = useState<PreferenceKey | ''>('');
  const [preferenceDraft, setPreferenceDraft] = useState('');
  const [preferenceStatus, setPreferenceStatus] = useState('');
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const settings = data?.settings;
  const name = settings?.senderName || data?.user?.name || displayName(data?.user);
  const targetRoles = settings?.targetRole || 'Add target roles';
  const outreach = recentOutreach(data?.usage);

  async function importResumeFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !settings) return;

    setResumeStatus('');
    setResumeSaving(true);
    try {
      const text = await extractReadableText(file);
      const uploadedAt = new Date().toISOString();
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          resumeContext: text.slice(0, 40000),
          resumeFileName: file.name,
          resumeUploadedAt: uploadedAt,
          defaultSearchPreferences: settings.defaultSearchPreferences || {}
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not save this file.');
      }
      await mutate();
      setResumeStatus('Saved.');
    } catch (error) {
      setResumeStatus(error instanceof Error ? error.message : 'Could not read this file.');
    } finally {
      setResumeSaving(false);
      event.target.value = '';
    }
  }

  async function generateInviteLink() {
    setInviteGenerating(true);
    setInviteStatus('');
    try {
      const response = await fetch('/api/invite-friend', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.link) {
        throw new Error(payload.error || 'Could not generate invite link.');
      }
      setInviteLink(payload.link);
      try {
        await navigator.clipboard.writeText(payload.link);
        setInviteStatus('Invite link copied.');
      } catch {
        setInviteStatus('Invite link generated.');
      }
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : 'Could not generate invite link.');
    } finally {
      setInviteGenerating(false);
    }
  }

  function startPreferenceEdit(key: PreferenceKey) {
    if (!settings) return;
    setPreferenceStatus('');
    setEditingPreference(key);
    setPreferenceDraft(preferenceValue(settings, key));
  }

  async function savePreference(key: PreferenceKey, value: string) {
    if (!settings) return;

    setPreferenceSaving(true);
    setPreferenceStatus('');
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [key]: value
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not save this preference.');
      }
      await mutate();
      setEditingPreference('');
      setPreferenceDraft('');
      setPreferenceStatus('Saved.');
    } catch (error) {
      setPreferenceStatus(error instanceof Error ? error.message : 'Could not save this preference.');
    } finally {
      setPreferenceSaving(false);
    }
  }

  return (
    <main className="h-[calc(100dvh-64px)] overflow-hidden px-6 py-3">
      <section
        className="mx-auto grid h-full max-w-[1240px] gap-8"
        style={{ gridTemplateColumns: '304px minmax(0, 1fr)' }}
      >
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white/78 p-4 shadow-[0_18px_70px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] bg-slate-100 text-xl font-semibold text-slate-700">
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
              Interested in <span className="font-semibold text-slate-700">{targetRoles}</span>
            </p>
            <Link
              href="/dashboard/profile"
              className={`mt-3 inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 ${buttonShadow}`}
            >
              Edit profile
            </Link>
          </div>

          <div className="mt-4 min-h-0 border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-950">Recent outreach</p>
            <RecentOutreachList outreach={outreach} compact />
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

        <section className="flex min-h-0 flex-col overflow-visible">
          <div className="mb-3">
            <h1 className="text-[28px] font-semibold leading-tight text-slate-950">
              Welcome back, {firstName(name)}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Manage your outreach preferences and recent activity.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <section className="rounded-[8px] border border-slate-200 bg-white/80 px-3 py-2 shadow-[0_18px_70px_rgba(15,23,42,0.04)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-950">Resume</h2>
                  <p className="truncate text-sm font-medium text-slate-500">
                    {settings?.resumeFileName || (settings?.resumeContext ? 'Saved' : 'No resume')}
                  </p>
                </div>
                <label className={`inline-flex h-9 shrink-0 cursor-pointer items-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 ${buttonShadow}`}>
                  {resumeSaving ? 'Reading' : settings?.resumeFileName ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    accept=".txt,.md,.rtf,.pdf,.doc,.docx"
                    className="sr-only"
                    disabled={resumeSaving || !settings}
                    onChange={importResumeFile}
                  />
                </label>
              </div>
              {resumeStatus ? (
                <p className="mt-2 text-sm font-medium text-slate-500">{resumeStatus}</p>
              ) : null}
            </section>

            <section className="rounded-[8px] border border-slate-200 bg-white/80 p-3 shadow-[0_18px_70px_rgba(15,23,42,0.04)] backdrop-blur-xl">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-slate-950">Outreach preferences</h2>
              </div>
              <PreferenceRow
                label="Target roles"
                value={targetRoles}
                field="targetRole"
                editing={editingPreference === 'targetRole'}
                draft={preferenceDraft}
                saving={preferenceSaving}
                onStart={startPreferenceEdit}
                onDraftChange={setPreferenceDraft}
                onCancel={() => setEditingPreference('')}
                onSave={savePreference}
              />
              <PreferenceRow
                label="Goal"
                value={goalLabel(settings?.outreachGoal)}
                field="outreachGoal"
                editing={editingPreference === 'outreachGoal'}
                draft={preferenceDraft}
                saving={preferenceSaving}
                onStart={startPreferenceEdit}
                onDraftChange={setPreferenceDraft}
                onCancel={() => setEditingPreference('')}
                onSave={savePreference}
              />
              <PreferenceRow
                label="Email length"
                value={lengthLabel(settings?.outreachLength)}
                field="outreachLength"
                editing={editingPreference === 'outreachLength'}
                draft={preferenceDraft}
                saving={preferenceSaving}
                onStart={startPreferenceEdit}
                onDraftChange={setPreferenceDraft}
                onCancel={() => setEditingPreference('')}
                onSave={savePreference}
              />
              <PreferenceRow
                label="Style notes"
                value={settings?.outreachStyleNotes || 'No extra notes'}
                field="outreachStyleNotes"
                editing={editingPreference === 'outreachStyleNotes'}
                draft={preferenceDraft}
                saving={preferenceSaving}
                onStart={startPreferenceEdit}
                onDraftChange={setPreferenceDraft}
                onCancel={() => setEditingPreference('')}
                onSave={savePreference}
                last
              />
              {preferenceStatus ? (
                <p className="mt-2 text-sm font-medium text-slate-500">{preferenceStatus}</p>
              ) : null}
            </section>

            <section className="rounded-[8px] border border-slate-200 bg-white/80 p-3 shadow-[0_18px_70px_rgba(15,23,42,0.04)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Invite friend</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Generate a signup link you can send directly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generateInviteLink}
                  disabled={inviteGenerating}
                  className={`inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 disabled:opacity-60 ${buttonShadow}`}
                >
                  {inviteGenerating ? 'Generating' : 'Generate link'}
                </button>
              </div>
              {inviteLink ? (
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <input
                    readOnly
                    value={inviteLink}
                    className="h-10 rounded-[8px] border border-slate-200 bg-slate-50/80 px-3 text-sm font-medium text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteLink);
                        setInviteStatus('Invite link copied.');
                      } catch {
                        setInviteStatus('Copy blocked. Select the link manually.');
                      }
                    }}
                    className={`inline-flex h-10 items-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 ${buttonShadow}`}
                  >
                    Copy
                  </button>
                </div>
              ) : null}
              {inviteStatus ? (
                <p className="mt-2 text-sm font-medium text-slate-500">{inviteStatus}</p>
              ) : null}
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
  field,
  editing,
  draft,
  saving,
  onStart,
  onDraftChange,
  onCancel,
  onSave,
  last
}: {
  label: string;
  value: string;
  field: PreferenceKey;
  editing: boolean;
  draft: string;
  saving: boolean;
  onStart: (field: PreferenceKey) => void;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onSave: (field: PreferenceKey, value: string) => void;
  last?: boolean;
}) {
  if (editing) {
    return (
      <div
        className={`relative z-[90] grid min-h-11 grid-cols-[180px_minmax(0,1fr)] items-center gap-3 px-2 py-1.5 ${
          last ? '' : 'border-b border-slate-200'
        }`}
      >
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        <InlinePreferenceEditor
          field={field}
          value={draft}
          saving={saving}
          onChange={onDraftChange}
          onCancel={onCancel}
          onSave={(value) => onSave(field, value)}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative z-0 grid min-h-11 grid-cols-[180px_minmax(0,1fr)] items-center gap-3 px-2 py-1.5 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <button
        type="button"
        onClick={() => onStart(field)}
        className="grid h-9 w-full grid-cols-[minmax(0,1fr)_20px] items-center rounded-[8px] border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 active:bg-slate-100"
      >
        <span className="truncate">{value}</span>
        {isSelectPreference(field) ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <span />}
      </button>
    </div>
  );
}

function InlinePreferenceEditor({
  field,
  value,
  saving,
  onChange,
  onCancel,
  onSave
}: {
  field: PreferenceKey;
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  if (field === 'outreachGoal') {
    return (
      <InlineSelect
        value={value || 'advice'}
        saving={saving}
        options={[
          ['advice', 'Ask advice'],
          ['referral', 'Explore referral'],
          ['intro', 'Request intro']
        ]}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  if (field === 'outreachLength') {
    return (
      <InlineSelect
        value={value || 'concise'}
        saving={saving}
        options={[
          ['short', 'Short'],
          ['concise', 'Concise'],
          ['detailed', 'Detailed']
        ]}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  const isNotes = field === 'outreachStyleNotes';
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSave(value);
          if (event.key === 'Escape') onCancel();
        }}
        className="h-9 min-w-0 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-200"
        placeholder={isNotes ? 'Extra style notes' : 'Target roles'}
      />
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="h-9 rounded-[8px] px-3 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-950"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => onSave(value)}
        disabled={saving}
        className="h-9 rounded-[8px] bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Saving' : 'Save'}
      </button>
    </div>
  );
}

function InlineSelect({
  value,
  saving,
  options,
  onSave
}: {
  value: string;
  saving: boolean;
  options: [string, string][];
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  return (
    <div className="grid h-9 grid-cols-3 gap-1 rounded-[8px] border border-slate-200 bg-white p-1">
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          type="button"
          autoFocus={optionValue === value}
          disabled={saving}
          onClick={() => onSave(optionValue)}
          className={`h-7 truncate rounded-[6px] px-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 ${
            optionValue === value
              ? 'bg-slate-950 text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
          }`}
        >
          {label}
        </button>
      ))}
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

function RecentOutreachList({
  outreach,
  compact
}: {
  outreach: ReturnType<typeof recentOutreach>;
  compact?: boolean;
}) {
  if (!outreach.length) {
    return (
      <div className="mt-3 rounded-[8px] border border-dashed border-slate-200 bg-slate-50/70 p-3">
        <p className="text-sm font-semibold text-slate-950">No outreach yet.</p>
        <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
          Drafted or unlocked emails will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? 'mt-2 divide-y divide-slate-200' : 'divide-y divide-slate-200'}>
      {outreach.map((item) => (
        <article key={item.id} className="py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm font-medium leading-5 text-slate-500">{item.detail}</p>
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

function lengthLabel(value?: Settings['outreachLength']) {
  if (value === 'short') return 'Short';
  if (value === 'detailed') return 'Detailed';
  return 'Concise';
}

function goalLabel(value?: Settings['outreachGoal']) {
  if (value === 'referral') return 'Explore referral';
  if (value === 'intro') return 'Request intro';
  return 'Ask advice';
}

function isSelectPreference(field: PreferenceKey) {
  return field === 'outreachGoal' || field === 'outreachLength';
}

function preferenceValue(settings: Settings, key: PreferenceKey) {
  if (key === 'outreachGoal') return settings.outreachGoal || 'advice';
  if (key === 'outreachLength') return settings.outreachLength || 'concise';
  return String(settings[key] || '');
}

async function extractReadableText(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const text = await file.text();
  const cleaned = text
    .replace(/\u0000/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const printableRatio = cleaned.length / Math.max(text.length, 1);

  if (!cleaned || cleaned.length < 80 || printableRatio < 0.45) {
    throw new Error(
      extension && ['pdf', 'doc', 'docx'].includes(extension)
        ? 'This file text could not be read. Export it as TXT or paste text in a readable file.'
        : 'This file does not contain enough readable text.'
    );
  }

  return cleaned;
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
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
