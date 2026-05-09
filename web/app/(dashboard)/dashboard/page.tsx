'use client';

import { Check, FileText, Pencil, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import { DashboardSidebar } from './dashboard-sidebar';

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
  senderProfile: string;
};
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
  const [schoolOptions, setSchoolOptions] = useState<ResolvedItem[]>([]);
  const [schoolResolving, setSchoolResolving] = useState(false);
  const [inviteStatus, setInviteStatus] = useState('');
  const [inviteCopying, setInviteCopying] = useState(false);
  const accountSettings = data?.settings;
  const settings = { ...(accountSettings || {}), ...preferenceOverrides } as Settings;
  const name = settings?.senderName || data?.user?.name || displayName(data?.user);
  const targetRoles = settings?.targetRole || 'Add target roles';
  const inviteLink = inviteData?.link || '';
  const personal = personalDraft || {
    name: data?.user?.name || '',
    school: settings.school || '',
    senderProfile: settings.senderProfile || ''
  };

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
      senderProfile: settings.senderProfile || ''
    };
    const hasChanged =
      values.name !== currentValues.name ||
      values.school !== currentValues.school ||
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
    <main className="min-h-[calc(100dvh-64px)] p-6">
      <section className="mx-auto grid max-w-[1240px] grid-cols-1 gap-4 2xl:grid-cols-[304px_minmax(0,1fr)]">
        <DashboardSidebar
          account={data}
          inviteCopying={inviteCopying}
          inviteStatus={inviteStatus}
          onCopyInviteLink={copyInviteLink}
        />

        <section className="flex min-h-0 flex-col overflow-visible">
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <section className="rounded-[8px] bg-white px-4 pb-0 pt-4 shadow-[0_18px_70px_rgba(15,23,42,0.04)]">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-slate-950">Resume</h2>
              </div>

              <div className="-mx-4 flex min-w-0 items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-700">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {settings?.resumeFileName || (settings?.resumeContext ? 'Saved resume' : 'No resume added')}
                      </p>
                      {settings?.resumeFileName || settings?.resumeContext ? (
                        <span className="rounded-full bg-[#f3f3f3] px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Last uploaded: {settings?.resumeUploadedAt ? formatDateTime(settings.resumeUploadedAt) : 'Not available'}
                    </p>
                  </div>
                </div>
                <label
                  aria-disabled={resumeSaving || !accountSettings}
                  className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[8px] bg-white text-slate-600 transition-colors hover:bg-[#f9f9f9] hover:text-slate-950 ${
                    resumeSaving || !accountSettings ? 'pointer-events-none opacity-60' : ''
                  }`}
                  title={settings?.resumeFileName ? 'Replace resume' : 'Upload resume'}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">{settings?.resumeFileName ? 'Replace resume' : 'Upload resume'}</span>
                  <input
                    type="file"
                    accept=".txt,.md,.rtf,.pdf,.doc,.docx"
                    className="sr-only"
                    disabled={resumeSaving || !accountSettings}
                    onChange={importResumeFile}
                  />
                </label>
              </div>
              {resumeStatus ? (
                <p className="mt-2 text-sm font-medium text-slate-500">{resumeStatus}</p>
              ) : null}
            </section>

            <section className="rounded-[8px] bg-white px-4 pb-0 pt-4 shadow-[0_18px_70px_rgba(15,23,42,0.04)]">
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

            <section
              id="personal-info"
              className="rounded-[8px] bg-white px-4 pb-0 pt-4 shadow-[0_18px_70px_rgba(15,23,42,0.04)]"
            >
              <div>
                <div className="mb-3">
                  <h2 className="text-base font-semibold text-slate-950">Personal Info</h2>
                </div>
                <div>
                  <PersonalInfoField
                    label="Name"
                    value={personal.name || 'Add your name'}
                    editing={personalEditing === 'name'}
                    onEdit={() => setPersonalEditing('name')}
                  >
                    <input
                      autoFocus
                      value={personal.name}
                      onChange={(event) => updatePersonalDraft('name', event.target.value)}
                      onBlur={(event) => void commitPersonalInfo({ ...personal, name: event.currentTarget.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      disabled={personalSaving || !accountSettings}
                      placeholder="Enter your name"
                      className="h-5 w-full bg-transparent p-0 text-sm font-semibold leading-5 text-slate-950 outline-none ring-0 focus:outline-none focus:ring-0"
                    />
                  </PersonalInfoField>

                  <PersonalInfoField
                    label="School or affiliation"
                    value={personal.school || 'Add school or affiliation'}
                    editing={personalEditing === 'school'}
                    onEdit={() => setPersonalEditing('school')}
                  >
                    <div className="relative w-full">
                      <input
                        autoFocus
                        value={personal.school}
                        onChange={(event) => updatePersonalDraft('school', event.target.value)}
                        onBlur={(event) => {
                          if (event.relatedTarget instanceof HTMLElement && event.currentTarget.parentElement?.contains(event.relatedTarget)) {
                            return;
                          }
                          void commitPersonalInfo({ ...personal, school: event.currentTarget.value });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                        disabled={personalSaving || !accountSettings}
                        placeholder="University of California, Berkeley"
                        className="h-5 w-full bg-transparent p-0 pr-8 text-sm font-semibold leading-5 text-slate-950 outline-none ring-0 focus:outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={resolveSchool}
                        disabled={personalSaving || schoolResolving || !accountSettings}
                        className="absolute right-0 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-slate-500 transition-colors hover:bg-[#f9f9f9] hover:text-slate-950 disabled:opacity-60"
                        title={settings.defaultSearchPreferences?.school?.label === personal.school ? 'Verified' : 'Search school'}
                      >
                        {settings.defaultSearchPreferences?.school?.label === personal.school ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Search className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {settings.defaultSearchPreferences?.school?.label === personal.school ? 'Verified school' : 'Search school'}
                        </span>
                      </button>
                    </div>
                    {schoolOptions.length ? (
                      <ResolveOptions items={schoolOptions} onSelect={selectSchool} />
                    ) : null}
                  </PersonalInfoField>

                  <PersonalInfoField
                    label="Extra personal info"
                    value={personal.senderProfile || 'Add any personal context that should shape outreach.'}
                    editing={personalEditing === 'senderProfile'}
                    multiline
                    onEdit={() => setPersonalEditing('senderProfile')}
                    last
                  >
                    <textarea
                      autoFocus
                      value={personal.senderProfile}
                      onChange={(event) => updatePersonalDraft('senderProfile', event.target.value)}
                      onBlur={(event) => void commitPersonalInfo({ ...personal, senderProfile: event.currentTarget.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      disabled={personalSaving || !accountSettings}
                      placeholder="Add any personal context that should shape outreach."
                      className="min-h-5 w-full resize-none bg-transparent p-0 text-sm font-semibold leading-5 text-slate-950 outline-none ring-0 focus:outline-none focus:ring-0"
                    />
                  </PersonalInfoField>
                </div>
                {personalStatus ? (
                  <p className="mt-2 text-sm font-medium text-slate-500">{personalStatus}</p>
                ) : null}
              </div>
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
        <p className="text-xs font-semibold text-slate-500">{label}</p>
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
        <p className="text-xs font-semibold text-slate-500">{label}</p>
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
      <p className="text-xs font-semibold text-slate-500">{label}</p>
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
      <span className={`block min-w-0 text-sm font-semibold text-slate-950 ${multiline ? 'whitespace-pre-wrap leading-5' : 'truncate'}`}>
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
      <p className="text-xs font-semibold text-slate-500">{label}</p>
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
        className="h-5 w-full min-w-0 bg-transparent p-0 text-sm font-semibold leading-5 text-slate-950 outline-none ring-0 focus:outline-none focus:ring-0"
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
          <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
          {item.subtitle ? (
            <span className="mt-0.5 block text-xs font-medium text-slate-500">{item.subtitle}</span>
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

function displayName(user?: AccountData['user']) {
  if (!user) return 'Reachard user';
  return user.name || user.email.split('@')[0];
}

