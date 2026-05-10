'use client';

import { CreditCard, FileText, History, Info, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { RecentOutreachList, recentOutreach } from './recent-outreach-list';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
  name?: string | null;
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

type InviteData = {
  ok: boolean;
  code?: string;
  link?: string;
};

type PreferenceKey = 'targetRole' | 'outreachGoal' | 'outreachLength' | 'outreachStyleNotes';
type PersonalDraft = {
  name: string;
  school: string;
  region: string;
  senderProfile: string;
};
type OutreachDraft = {
  targetRole: string;
  outreachStyleNotes: string;
};
type EditPanel = '' | 'personal' | 'resume' | 'outreach';
type ResolvedItem = {
  id: string;
  label: string;
  subtitle: string;
  type: 'school' | 'location';
};

export default function DashboardPage() {
  const { data, mutate } = useSWR<AccountData>('/api/account', fetcher);
  const { data: inviteData, mutate: mutateInvite } = useSWR<InviteData>('/api/invite-friend', fetcher);
  const [resumeStatus, setResumeStatus] = useState('');
  const [resumeSaving, setResumeSaving] = useState(false);
  const [editingPreference, setEditingPreference] = useState<PreferenceKey | ''>('');
  const [preferenceDraft, setPreferenceDraft] = useState('');
  const [preferenceStatus, setPreferenceStatus] = useState('');
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [preferenceOverrides, setPreferenceOverrides] = useState<Partial<Settings>>({});
  const preferenceSaveAbortRef = useRef<AbortController | null>(null);
  const [personalDraft, setPersonalDraft] = useState<PersonalDraft | null>(null);
  const [personalEditing, setPersonalEditing] = useState<keyof PersonalDraft | ''>('');
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalStatus, setPersonalStatus] = useState('');
  const [editPanel, setEditPanel] = useState<EditPanel>('');
  const [outreachDraft, setOutreachDraft] = useState<OutreachDraft | null>(null);
  const [schoolOptions, setSchoolOptions] = useState<ResolvedItem[]>([]);
  const [schoolResolving, setSchoolResolving] = useState(false);
  const [inviteStatus, setInviteStatus] = useState('');
  const [inviteCopying, setInviteCopying] = useState(false);
  const accountSettings = data?.settings;
  const settings = { ...(accountSettings || {}), ...preferenceOverrides } as Settings;
  const name = settings?.senderName || data?.user?.name || displayName(data?.user);
  const firstName = name.split(/\s+/).filter(Boolean)[0] || name;
  const outreach = recentOutreach(data?.usage);
  const inviteLink = inviteData?.link || '';
  const personal = personalDraft || {
    name: data?.user?.name || '',
    school: settings.school || '',
    region: settings.region || '',
    senderProfile: settings.senderProfile || ''
  };

  useEffect(() => {
    if (window.location.hash) return;

    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);

    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function importResumeFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !accountSettings) return;

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
      setEditPanel('');
    } catch (error) {
      setResumeStatus(error instanceof Error ? error.message : 'Could not read this file.');
    } finally {
      setResumeSaving(false);
      event.target.value = '';
    }
  }

  async function copyInviteLink() {
    setInviteCopying(true);
    setInviteStatus('');
    try {
      let link = inviteLink;
      if (!link) {
        const response = await fetch('/api/invite-friend', { method: 'GET' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok || !payload.link) {
          throw new Error(payload.error || 'Could not load invite link.');
        }
        link = payload.link;
        mutateInvite(payload, false);
      }
      try {
        await navigator.clipboard.writeText(link);
        setInviteStatus('Invite link copied.');
      } catch {
        setInviteStatus('Copy blocked. Try again from a secure browser window.');
      }
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : 'Could not copy invite link.');
    } finally {
      setInviteCopying(false);
    }
  }

  function startPreferenceEdit(key: PreferenceKey) {
    if (!accountSettings) return;
    setPreferenceStatus('');
    setEditingPreference(key);
    setPreferenceDraft(preferenceValue(settings, key));
  }

  async function savePreference(key: PreferenceKey, value: string, keepEditing = false) {
    if (!accountSettings) return;

    if (!keepEditing && value === preferenceValue(settings, key)) {
      setEditingPreference('');
      setPreferenceDraft('');
      setPreferenceStatus('');
      return;
    }

    preferenceSaveAbortRef.current?.abort();
    const controller = new AbortController();
    preferenceSaveAbortRef.current = controller;
    setPreferenceOverrides((current) => ({ ...current, [key]: value }));
    if (!keepEditing || editingPreference === key) {
      setPreferenceDraft(value);
    }
    setPreferenceSaving(!keepEditing);
    setPreferenceStatus('');
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [key]: value
        }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not save this preference.');
      }
      if (preferenceSaveAbortRef.current !== controller) return;
      if (!keepEditing) {
        setEditingPreference('');
        setPreferenceDraft('');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (preferenceSaveAbortRef.current !== controller) return;
      setPreferenceStatus(error instanceof Error ? error.message : 'Could not save this preference.');
    } finally {
      if (preferenceSaveAbortRef.current === controller) {
        preferenceSaveAbortRef.current = null;
        setPreferenceSaving(false);
      }
    }
  }

  function updatePersonalDraft(key: keyof PersonalDraft, value: string) {
    setPersonalStatus('');
    if (key === 'school') {
      setSchoolOptions([]);
      setPreferenceOverrides((current) => ({
        ...current,
        defaultSearchPreferences: {
          ...settings.defaultSearchPreferences,
          ...current.defaultSearchPreferences,
          school: undefined
        }
      }));
    }
    setPersonalDraft((current) => ({
      ...(current || personal),
      [key]: value
    }));
  }

  async function resolveSchool() {
    const query = personal.school.trim();
    if (query.length < 2) {
      setPersonalStatus('Enter at least 2 characters before searching for a school.');
      return;
    }

    setSchoolResolving(true);
    setPersonalStatus('');
    setSchoolOptions([]);
    try {
      const response = await fetch(`/api/metadata/schools?q=${encodeURIComponent(query)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not search schools.');
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      setSchoolOptions(items);
      setPersonalStatus(items.length ? 'Choose the matching school.' : 'No school matches found.');
    } catch (error) {
      setPersonalStatus(error instanceof Error ? error.message : 'Could not search schools.');
    } finally {
      setSchoolResolving(false);
    }
  }

  function selectSchool(item: ResolvedItem) {
    const next = {
      ...personal,
      school: item.label
    };
    const schoolPreference = {
      label: item.label,
      linkedinId: item.id
    };
    setPersonalDraft(next);
    setPreferenceOverrides((current) => ({
      ...current,
      school: item.label,
      defaultSearchPreferences: {
        ...settings.defaultSearchPreferences,
        ...current.defaultSearchPreferences,
        school: schoolPreference
      }
    }));
    setSchoolOptions([]);
    setPersonalStatus(`${item.label} confirmed.`);
    void commitPersonalInfo(next, schoolPreference);
  }

  function openPersonalEditor() {
    setPersonalStatus('');
    setSchoolOptions([]);
    setPersonalDraft({
      name: data?.user?.name || '',
      school: settings.school || '',
      region: settings.region || '',
      senderProfile: settings.senderProfile || ''
    });
    setEditPanel('personal');
  }

  function openOutreachEditor() {
    setPreferenceStatus('');
    setOutreachDraft({
      targetRole: settings.targetRole || '',
      outreachStyleNotes: settings.outreachStyleNotes || ''
    });
    setEditPanel('outreach');
  }

  function updateOutreachDraft(key: keyof OutreachDraft, value: string) {
    setPreferenceStatus('');
    setOutreachDraft((current) => ({
      ...(current || {
        targetRole: settings.targetRole || '',
        outreachStyleNotes: settings.outreachStyleNotes || ''
      }),
      [key]: value
    }));
  }

  async function saveOutreachFromModal() {
    if (!accountSettings || !outreachDraft) return;

    setPreferenceSaving(true);
    setPreferenceStatus('');
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outreachDraft)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not save outreach settings.');
      }
      setPreferenceOverrides((current) => ({ ...current, ...outreachDraft }));
      await mutate();
      setEditPanel('');
    } catch (error) {
      setPreferenceStatus(error instanceof Error ? error.message : 'Could not save outreach settings.');
    } finally {
      setPreferenceSaving(false);
    }
  }

  async function savePersonalFromModal() {
    if (!accountSettings) return;

    setPersonalSaving(true);
    setPersonalStatus('');
    const existingPreferences = settings.defaultSearchPreferences || {};
    const defaultSearchPreferences = {
      school:
        existingPreferences.school?.label === personal.school
          ? existingPreferences.school
          : undefined,
      region:
        existingPreferences.region?.label === personal.region
          ? existingPreferences.region
          : undefined
    };

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: personal.name,
          senderName: personal.name,
          school: personal.school,
          region: personal.region,
          senderProfile: personal.senderProfile,
          defaultSearchPreferences
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not save personal info.');
      }
      setPreferenceOverrides((current) => ({
        ...current,
        senderName: personal.name,
        school: personal.school,
        region: personal.region,
        senderProfile: personal.senderProfile,
        defaultSearchPreferences
      }));
      setPersonalDraft(null);
      await mutate();
      setEditPanel('');
    } catch (error) {
      setPersonalStatus(error instanceof Error ? error.message : 'Could not save personal info.');
    } finally {
      setPersonalSaving(false);
    }
  }

  async function commitPersonalInfo(
    values = personal,
    schoolPreference?: NonNullable<Settings['defaultSearchPreferences']>['school']
  ) {
    if (!accountSettings) return;

    setPersonalEditing('');
    setPersonalStatus('');
    const currentValues = {
      name: data?.user?.name || '',
      school: settings.school || '',
      region: settings.region || '',
      senderProfile: settings.senderProfile || ''
    };
    const hasChanged =
      values.name !== currentValues.name ||
      values.school !== currentValues.school ||
      values.region !== currentValues.region ||
      values.senderProfile !== currentValues.senderProfile ||
      Boolean(schoolPreference);

    if (!hasChanged) {
      setPersonalDraft(null);
      return;
    }

    setPersonalSaving(true);
    const existingPreferences = settings.defaultSearchPreferences || {};
    const defaultSearchPreferences = {
      school:
        schoolPreference ||
        (existingPreferences.school?.label === values.school
          ? existingPreferences.school
          : undefined),
      region:
        existingPreferences.region?.label === settings.region
          ? existingPreferences.region
          : undefined
    };

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          senderName: values.name,
          school: values.school,
          region: values.region,
          senderProfile: values.senderProfile,
          defaultSearchPreferences
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not save personal info.');
      }
      setPreferenceOverrides((current) => ({
        ...current,
        senderName: values.name,
        school: values.school,
        region: values.region,
        senderProfile: values.senderProfile,
        defaultSearchPreferences
      }));
      setPersonalDraft(null);
      setPersonalEditing('');
      await mutate();
      setPersonalStatus('');
    } catch (error) {
      setPersonalStatus(error instanceof Error ? error.message : 'Could not save personal info.');
    } finally {
      setPersonalSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-64px)] bg-[#f5f5f7] px-6 py-6 lg:py-8">
      <section className="mx-auto max-w-[760px]">
        <div>
          <h1 className="page-title mb-5">
            Hi, {firstName}
          </h1>
        </div>
      </section>

      <SectionIndex />

      <InviteFriendBanner
        inviteCopying={inviteCopying}
        inviteStatus={inviteStatus}
        onCopyInviteLink={copyInviteLink}
      />

      <section id="recent-outreach" className="mx-auto mt-4 max-w-[760px] rounded-[16px] border border-border bg-card px-6 py-6 shadow-apple-card">
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <h2 className="section-title">
            Recent Outreach
          </h2>
          <RecentOutreachList outreach={outreach} plain />
        </div>
      </section>

      <DashboardCard id="plan" title="Plan">
        <SettingsItem title="Credits">
          <p>{formatNumber(data?.credits?.remaining)} remaining</p>
          <p>Use credits to reveal emails and unlock contact details.</p>
        </SettingsItem>
      </DashboardCard>

      <DashboardCard id="profile" title="Profile">
        <div className="space-y-9">
          <SettingsSection title="Personal">
            <SettingsItem
              title="Personal information"
              action={<EditButton onClick={openPersonalEditor} />}
            >
              <p>{name}</p>
              <p>{data?.user?.email || 'No email available'}</p>
              <p>{settings.school || 'No school added'}</p>
              <p>{settings.region || 'No region added'}</p>
            </SettingsItem>
            <SettingsItem title="Personal context">
              <p className="max-w-[560px]">
                {settings.senderProfile || 'Add the background Reachard should use when drafting outreach.'}
              </p>
            </SettingsItem>
          </SettingsSection>

          <SettingsSection title="Outreach">
            <SettingsItem
              title="Outreach defaults"
              action={<EditButton onClick={openOutreachEditor} />}
            >
              <p>Target roles: {settings.targetRole || 'Not set'}</p>
              <p className="max-w-[560px]">
                Style notes: {settings.outreachStyleNotes || 'No extra style notes'}
              </p>
            </SettingsItem>
          </SettingsSection>
        </div>
      </DashboardCard>

      <DashboardCard id="resume" title="Resume">
        <SettingsItem
          title={settings.resumeFileName || (settings.resumeContext ? 'Saved resume' : 'No resume added')}
          action={<EditButton label={settings.resumeFileName || settings.resumeContext ? 'Replace' : 'Edit'} onClick={() => setEditPanel('resume')} />}
        >
          <p>
            Last uploaded: {settings.resumeUploadedAt ? formatDateTime(settings.resumeUploadedAt) : 'Not available'}
          </p>
          <p>{resumeStatus || 'A readable resume improves generated outreach drafts.'}</p>
        </SettingsItem>
      </DashboardCard>

      <DashboardCard id="account" title="Account">
        <SettingsItem title={data?.user?.email || 'Reachard account'}>
          <div className="flex flex-wrap items-center gap-2">
            <span>Extension</span>
            <ExtensionStatus connected={Boolean(data?.extension?.connected)} />
          </div>
        </SettingsItem>
      </DashboardCard>

      {editPanel === 'personal' ? (
        <EditPanelModal title="Edit your profile." onClose={() => setEditPanel('')}>
          <div className="space-y-4">
            <AppleTextField
              label="Name"
              value={personal.name}
              onChange={(value) => updatePersonalDraft('name', value)}
            />
            <AppleTextField
              label="School or affiliation"
              value={personal.school}
              onChange={(value) => updatePersonalDraft('school', value)}
            />
            <AppleTextField
              label="Region"
              value={personal.region}
              onChange={(value) => updatePersonalDraft('region', value)}
            />
            <AppleTextArea
              label="Extra personal info"
              value={personal.senderProfile}
              onChange={(value) => updatePersonalDraft('senderProfile', value)}
            />
          </div>
          {personalStatus ? <p className="mt-4 text-sm font-medium text-[#d70015]">{personalStatus}</p> : null}
          <ModalActions
            saving={personalSaving}
            primaryLabel="Save"
            onPrimary={() => void savePersonalFromModal()}
            onCancel={() => setEditPanel('')}
          />
        </EditPanelModal>
      ) : null}

      {editPanel === 'outreach' ? (
        <EditPanelModal title="Edit outreach defaults." onClose={() => setEditPanel('')}>
          <div className="space-y-4">
            <AppleTextField
              label="Target roles"
              value={outreachDraft?.targetRole || ''}
              onChange={(value) => updateOutreachDraft('targetRole', value)}
            />
            <AppleTextArea
              label="Extra style notes"
              value={outreachDraft?.outreachStyleNotes || ''}
              onChange={(value) => updateOutreachDraft('outreachStyleNotes', value)}
            />
          </div>
          {preferenceStatus ? <p className="mt-4 text-sm font-medium text-[#d70015]">{preferenceStatus}</p> : null}
          <ModalActions
            saving={preferenceSaving}
            primaryLabel="Save"
            onPrimary={() => void saveOutreachFromModal()}
            onCancel={() => setEditPanel('')}
          />
        </EditPanelModal>
      ) : null}

      {editPanel === 'resume' ? (
        <EditPanelModal title="Update your resume." onClose={() => setEditPanel('')}>
          <div className="rounded-[12px] border border-[#86868b] px-5 py-5">
            <p className="text-[17px] font-semibold text-[#1d1d1f]">
              {settings.resumeFileName || (settings.resumeContext ? 'Saved resume' : 'No resume added')}
            </p>
            <p className="mt-1 text-[15px] font-normal leading-5 text-[#6e6e73]">
              Upload a readable resume file so Reachard can draft with accurate context.
            </p>
            <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[980px] bg-[#0071e3] px-6 text-[17px] font-normal text-white hover:bg-[#0077ed]">
              {resumeSaving ? 'Uploading' : 'Choose file'}
              <input
                type="file"
                accept=".txt,.md,.rtf,.pdf,.doc,.docx"
                className="sr-only"
                disabled={resumeSaving || !accountSettings}
                onChange={importResumeFile}
              />
            </label>
          </div>
          {resumeStatus ? <p className="mt-4 text-sm font-medium text-[#6e6e73]">{resumeStatus}</p> : null}
          <ModalActions
            saving={resumeSaving}
            primaryLabel="Done"
            onPrimary={() => setEditPanel('')}
            onCancel={() => setEditPanel('')}
          />
        </EditPanelModal>
      ) : null}
    </main>
  );
}

function InviteFriendBanner({
  inviteCopying,
  inviteStatus,
  onCopyInviteLink
}: {
  inviteCopying: boolean;
  inviteStatus: string;
  onCopyInviteLink: () => void;
}) {
  return (
    <section className="mx-auto mt-4 max-w-[760px] rounded-[16px] border border-border bg-card px-6 py-6 shadow-apple-card">
      <p className="section-title flex items-center gap-3">
        <Info className="h-6 w-6 shrink-0 stroke-[2.1]" aria-hidden="true" />
        Invite a friend
      </p>
      <p className="secondary mt-3 max-w-[620px]">
        Invite a friend to purchase Reachard and get one month free.
      </p>
      <button
        type="button"
        onClick={onCopyInviteLink}
        disabled={inviteCopying}
        className="mt-8 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[#0071e3] px-7 text-[19px] font-normal text-white transition-colors hover:bg-[#0077ed] disabled:cursor-default disabled:opacity-60"
      >
        {inviteCopying ? 'Copying' : 'Copy invite link'}
      </button>
      {inviteStatus ? (
        <p className="mt-4 text-[15px] font-normal leading-5 text-[#6e6e73]">{inviteStatus}</p>
      ) : null}
    </section>
  );
}

function SectionIndex() {
  const items = [
    { label: 'Recent', href: '#recent-outreach', icon: History },
    { label: 'Plan', href: '#plan', icon: CreditCard },
    { label: 'Profile', href: '#profile', icon: UserRound },
    { label: 'Resume', href: '#resume', icon: FileText },
    { label: 'Account', href: '#account', icon: ShieldCheck }
  ];

  return (
    <nav className="mx-auto mt-4 flex max-w-[760px] flex-wrap items-start justify-center gap-x-7 gap-y-4" aria-label="Dashboard sections">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <a
            key={item.href}
            href={item.href}
            className="group flex min-w-[68px] flex-col items-center gap-2 text-center text-[14px] font-normal leading-tight text-[#1d1d1f]"
          >
            <Icon className="h-8 w-8 text-[#6e6e73] transition-colors group-hover:text-[#1d1d1f]" strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function DashboardCard({
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto mt-4 max-w-[760px] scroll-mt-8 rounded-[16px] border border-border bg-card px-6 py-6 shadow-apple-card">
      <h2 className="section-title">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ExtensionStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold leading-none ${
        connected
          ? 'bg-[#e8f8f3] text-[#08745f]'
          : 'bg-[#f5f5f7] text-[#6e6e73]'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          connected ? 'bg-[#12b886]' : 'bg-[#8e8e93]'
        }`}
        aria-hidden="true"
      />
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

function SettingsSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <h2 className="section-title">
        {title}
      </h2>
      <div className="space-y-7">{children}</div>
    </section>
  );
}

function SettingsItem({
  title,
  children,
  action
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <h3 className="text-[17px] font-semibold leading-[1.35] text-[#1d1d1f]">
          {title}
        </h3>
        <div className="mt-2 space-y-1 text-[17px] font-normal leading-[1.45] text-[#1d1d1f]">
          {children}
        </div>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

function EditButton({
  label = 'Edit',
  onClick
}: {
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[17px] font-normal leading-6 text-[#0066cc] underline underline-offset-2 hover:text-[#004999]"
    >
      {label}
    </button>
  );
}

function EditPanelModal({
  title,
  children,
  onClose
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-10">
      <section className="relative w-full max-w-[680px] rounded-[18px] bg-white px-6 py-12 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:px-16">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-6 top-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#e8e8ed] text-[26px] font-semibold leading-none text-[#6e6e73] hover:bg-[#dedee3]"
        >
          ×
        </button>
        <h2 className="mb-8 text-center text-[36px] font-semibold leading-tight tracking-[-0.022em] text-[#1d1d1f]">
          {title}
        </h2>
        {children}
      </section>
    </div>
  );
}

function AppleTextField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-[12px] border border-[#86868b] px-4 pb-2 pt-3 focus-within:border-[#0071e3] focus-within:shadow-[inset_0_0_0_1px_#0071e3]">
      <span className="block text-[13px] font-normal leading-4 text-[#6e6e73]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-7 w-full bg-transparent text-[18px] font-normal leading-7 text-[#1d1d1f] outline-none"
      />
    </label>
  );
}

function AppleTextArea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-[12px] border border-[#86868b] px-4 pb-3 pt-3 focus-within:border-[#0071e3] focus-within:shadow-[inset_0_0_0_1px_#0071e3]">
      <span className="block text-[13px] font-normal leading-4 text-[#6e6e73]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="mt-2 w-full resize-none bg-transparent text-[18px] font-normal leading-7 text-[#1d1d1f] outline-none"
      />
    </label>
  );
}

function ModalActions({
  saving,
  primaryLabel,
  onPrimary,
  onCancel
}: {
  saving: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-10">
      <button
        type="button"
        disabled={saving}
        onClick={onPrimary}
        className="min-h-14 w-full cursor-pointer rounded-[12px] bg-[#0071e3] px-6 text-[17px] font-normal text-white hover:bg-[#0077ed] disabled:cursor-default disabled:opacity-60"
      >
        {saving ? 'Saving' : primaryLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="mx-auto mt-5 block text-[17px] font-normal text-[#0066cc] hover:text-[#004999]"
      >
        Cancel
      </button>
    </div>
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
  onSave: (field: PreferenceKey, value: string, keepEditing?: boolean) => void;
  last?: boolean;
}) {
  if (isSelectPreference(field)) {
    return (
      <div
        className={`relative z-0 -mx-4 min-h-11 px-4 py-3 ${
          last ? '' : 'border-b border-slate-200'
        }`}
      >
        <p className="label">{label}</p>
        <div className="mt-1">
          <InlinePreferenceEditor
            field={field}
            value={editing ? draft : preferenceRawValue(field, value)}
            saving={saving}
            onChange={onDraftChange}
            onCancel={onCancel}
            onSave={(value, keepEditing) => onSave(field, value, keepEditing)}
          />
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div
        className={`relative z-[90] -mx-4 min-h-11 px-4 py-3 ${
          last ? '' : 'border-b border-slate-200'
        }`}
      >
        <p className="label">{label}</p>
        <div className="mt-1">
          <InlinePreferenceEditor
            field={field}
            value={draft}
            saving={saving}
            onChange={onDraftChange}
            onCancel={onCancel}
            onSave={(value, keepEditing) => onSave(field, value, keepEditing)}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative z-0 -mx-4 min-h-11 px-4 py-3 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <p className="label">{label}</p>
      <div className="mt-1">
        <EditableValue value={value} onEdit={() => onStart(field)} />
      </div>
    </div>
  );
}

function EditableValue({
  value,
  multiline = false,
  onEdit
}: {
  value: string;
  multiline?: boolean;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex min-h-11 w-full items-center rounded-[8px] p-2 text-left transition-colors hover:bg-[#f9f9f9] focus:outline-none"
    >
      <span className={`value block min-w-0 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>
        {value}
      </span>
    </button>
  );
}

function PersonalInfoField({
  label,
  value,
  editing,
  multiline,
  onEdit,
  last,
  children
}: {
  label: string;
  value: string;
  editing: boolean;
  multiline?: boolean;
  onEdit: () => void;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`-mx-4 min-h-11 px-4 py-3 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <p className="label">{label}</p>
      <div className="mt-1">
        {editing ? (
          <div className="flex min-h-11 w-full flex-col justify-center rounded-[8px] p-2">{children}</div>
        ) : (
          <EditableValue value={value} multiline={multiline} onEdit={onEdit} />
        )}
      </div>
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
  onSave: (value: string, keepEditing?: boolean) => void;
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
        onSave={(value) => onSave(value, true)}
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
        onSave={(value) => onSave(value, true)}
      />
    );
  }

  return (
    <div className="flex min-h-11 w-full items-center rounded-[8px] p-2">
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onSave(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') onCancel();
        }}
        className="value h-5 w-full min-w-0 bg-transparent p-0 outline-none ring-0 focus:outline-none focus:ring-0"
        placeholder={field === 'outreachStyleNotes' ? 'Extra style notes' : 'Target roles'}
      />
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
    <div className="flex w-full flex-wrap items-center gap-4 rounded-[8px]" aria-busy={saving}>
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          type="button"
          aria-pressed={optionValue === value}
          onClick={() => onSave(optionValue)}
          className={`flex min-h-11 min-w-0 items-center justify-center truncate rounded-[8px] p-2 text-sm font-semibold transition-colors focus:outline-none ${
            optionValue === value
              ? 'bg-[#f3f3f3] text-slate-950'
              : 'bg-transparent text-neutral-500 hover:bg-[#f9f9f9] hover:text-neutral-950 disabled:opacity-60'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ResolveOptions({
  items,
  onSelect
}: {
  items: ResolvedItem[];
  onSelect: (item: ResolvedItem) => void;
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-[8px] bg-white">
      {items.map((item) => (
        <button
          key={`${item.type}-${item.id}`}
          type="button"
          onClick={() => onSelect(item)}
          className="block w-full border-b border-slate-200 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-[#f9f9f9]"
        >
          <span className="value block">{item.label}</span>
          {item.subtitle ? (
            <span className="secondary mt-0.5 block">{item.subtitle}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
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

function preferenceRawValue(field: PreferenceKey, label: string) {
  if (field === 'outreachGoal') {
    if (label === 'Explore referral') return 'referral';
    if (label === 'Request intro') return 'intro';
    return 'advice';
  }
  if (field === 'outreachLength') {
    if (label === 'Short') return 'short';
    if (label === 'Detailed') return 'detailed';
    return 'concise';
  }
  return label;
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
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(value));
}

function formatNumber(value?: number) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '...';
}

function displayName(user?: AccountData['user']) {
  if (!user) return 'Reachard user';
  return user.name || user.email.split('@')[0];
}

