'use client';

import { CreditCard, FileText, History, Info, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Button, Card, Chip, Input } from '@heroui/react';
import { ProfileTextField, ProfileTextArea, PreferenceOptions, ProfileModal, ProfileActions, ResolvedOptions } from '@/components/ui/profile-controls';
import { RecentOutreachList, recentOutreach } from './recent-outreach-list';
import { useI18n } from '@/components/language-provider';
import {
  extractResumeText,
  getResumeTextErrorKey,
  RESUME_FILE_ACCEPT
} from '@/lib/resume-text';

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

type PreferenceKey = 'outreachGoal' | 'outreachLength' | 'outreachStyleNotes';
type PersonalDraft = {
  name: string;
  school: string;
  region: string;
  senderProfile: string;
};
type OutreachDraft = {
  emailTone: NonNullable<Settings['emailTone']>;
  outreachLength: NonNullable<Settings['outreachLength']>;
  outreachGoal: NonNullable<Settings['outreachGoal']>;
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
  const { language, t } = useI18n();
  const { data, mutate } = useSWR<AccountData>('/api/account', fetcher);
  const { data: inviteData, mutate: mutateInvite } = useSWR<InviteData>('/api/invite-friend', fetcher);
  const resumeInputRef = useRef<HTMLInputElement>(null);
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
  const name = settings?.senderName || data?.user?.name || displayName(data?.user, t('sidebar.reachardUser'));
  const firstName = name.split(/\s+/).filter(Boolean)[0] || name;
  const outreach = recentOutreach(data?.usage, language);
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
      const text = await extractResumeText(file);
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
        throw new Error(payload.error || t('dashboard.fileSaveError'));
      }
      await mutate();
      setResumeStatus(t('dashboard.saved'));
      setEditPanel('');
    } catch (error) {
      setResumeStatus(t(getResumeTextErrorKey(error)));
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
          throw new Error(payload.error || t('dashboard.inviteLoadError'));
        }
        link = payload.link;
        mutateInvite(payload, false);
      }
      try {
        await navigator.clipboard.writeText(link);
        setInviteStatus(t('dashboard.inviteCopied'));
      } catch {
        setInviteStatus(t('dashboard.inviteCopyBlocked'));
      }
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : t('dashboard.inviteCopyError'));
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
        throw new Error(payload.error || t('dashboard.preferenceSaveError'));
      }
      if (preferenceSaveAbortRef.current !== controller) return;
      if (!keepEditing) {
        setEditingPreference('');
        setPreferenceDraft('');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (preferenceSaveAbortRef.current !== controller) return;
      setPreferenceStatus(error instanceof Error ? error.message : t('dashboard.preferenceSaveError'));
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
      emailTone: settings.emailTone || 'warm',
      outreachLength: settings.outreachLength || 'concise',
      outreachGoal: settings.outreachGoal || 'advice',
      outreachStyleNotes: settings.outreachStyleNotes || ''
    });
    setEditPanel('outreach');
  }

  function updateOutreachDraft<Key extends keyof OutreachDraft>(key: Key, value: OutreachDraft[Key]) {
    setPreferenceStatus('');
    setOutreachDraft((current) => ({
      ...(current || {
        emailTone: settings.emailTone || 'warm',
        outreachLength: settings.outreachLength || 'concise',
        outreachGoal: settings.outreachGoal || 'advice',
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
        throw new Error(payload.error || t('dashboard.outreachSaveError'));
      }
      setPreferenceOverrides((current) => ({ ...current, ...outreachDraft }));
      await mutate();
      setEditPanel('');
    } catch (error) {
      setPreferenceStatus(error instanceof Error ? error.message : t('dashboard.outreachSaveError'));
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
        throw new Error(payload.error || t('dashboard.personalSaveError'));
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
      setPersonalStatus(error instanceof Error ? error.message : t('dashboard.personalSaveError'));
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
        throw new Error(payload.error || t('dashboard.personalSaveError'));
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
      setPersonalStatus(error instanceof Error ? error.message : t('dashboard.personalSaveError'));
    } finally {
      setPersonalSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-64px)] bg-[#f5f5f7] px-6 py-6 lg:py-8">
      <section className="mx-auto max-w-[760px]">
        <div>
          <h1 className="page-title mb-5">
            {t('dashboard.greeting', { name: firstName })}
          </h1>
        </div>
      </section>

      <SectionIndex />

      <InviteFriendBanner
        inviteCopying={inviteCopying}
        inviteStatus={inviteStatus}
        onCopyInviteLink={copyInviteLink}
      />

      <Card id="recent-outreach" className="mx-auto mt-4 max-w-[760px]">
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <h2 className="section-title">
            {t('dashboard.recentOutreach')}
          </h2>
          <RecentOutreachList outreach={outreach} plain />
        </div>
      </Card>

      <DashboardCard id="plan" title={t('dashboard.plan')}>
        <SettingsItem title={t('dashboard.credits')}>
          <p>{t('dashboard.creditsRemaining', { count: formatNumber(data?.credits?.remaining, language) })}</p>
          <p>{t('dashboard.creditsHelp')}</p>
        </SettingsItem>
      </DashboardCard>

      <DashboardCard id="profile" title={t('dashboard.profile')}>
        <div className="space-y-9">
          <SettingsSection title={t('dashboard.personal')}>
            <SettingsItem
              title={t('dashboard.personalInformation')}
              action={<EditButton onClick={openPersonalEditor} />}
            >
              <p>{name}</p>
              <p>{data?.user?.email || t('dashboard.noEmail')}</p>
              <p>{settings.school || t('dashboard.noSchool')}</p>
              <p>{settings.region || t('dashboard.noRegion')}</p>
            </SettingsItem>
            <SettingsItem title={t('dashboard.personalContext')}>
              <p className="max-w-[560px]">
                {settings.senderProfile || t('dashboard.personalContextEmpty')}
              </p>
            </SettingsItem>
          </SettingsSection>

          <SettingsSection title={t('dashboard.outreach')}>
            <SettingsItem
              title={t('dashboard.outreachDefaults')}
              action={<EditButton onClick={openOutreachEditor} />}
            >
              <p>{t('dashboard.emailToneValue', { value: toneLabel(settings.emailTone) })}</p>
              <p>{t('dashboard.outreachLengthValue', { value: lengthLabel(settings.outreachLength) })}</p>
              <p>{t('dashboard.outreachGoalValue', { value: goalLabel(settings.outreachGoal) })}</p>
              <p className="max-w-[560px]">
                {t('dashboard.styleNotes', { value: settings.outreachStyleNotes || t('dashboard.noStyleNotes') })}
              </p>
            </SettingsItem>
          </SettingsSection>
        </div>
      </DashboardCard>

      <DashboardCard id="resume" title={t('dashboard.resume')}>
        <SettingsItem
          title={settings.resumeFileName || (settings.resumeContext ? t('dashboard.savedResume') : t('dashboard.noResume'))}
          action={<EditButton label={settings.resumeFileName || settings.resumeContext ? t('common.replace') : t('common.edit')} onClick={() => setEditPanel('resume')} />}
        >
          <p>
            {t('dashboard.lastUploaded', { value: settings.resumeUploadedAt ? formatDateTime(settings.resumeUploadedAt, language) : t('dashboard.notAvailable') })}
          </p>
          <p>{resumeStatus || t('dashboard.resumeHelp')}</p>
        </SettingsItem>
      </DashboardCard>

      <DashboardCard id="account" title={t('dashboard.account')}>
        <SettingsItem title={data?.user?.email || t('dashboard.reachardAccount')}>
          <div className="flex flex-wrap items-center gap-2">
            <span>{t('dashboard.extension')}</span>
            <ExtensionStatus connected={Boolean(data?.extension?.connected)} />
          </div>
        </SettingsItem>
      </DashboardCard>

      {editPanel === 'personal' ? (
        <EditPanelModal title={t('dashboard.editProfileTitle')} onClose={() => setEditPanel('')}>
          <div className="space-y-4">
            <ProfileTextField
              label={t('dashboard.name')}
              value={personal.name}
              onChange={(value) => updatePersonalDraft('name', value)}
            />
            <ProfileTextField
              label={t('dashboard.schoolAffiliation')}
              value={personal.school}
              onChange={(value) => updatePersonalDraft('school', value)}
            />
            <ProfileTextField
              label={t('dashboard.region')}
              value={personal.region}
              onChange={(value) => updatePersonalDraft('region', value)}
            />
            <ProfileTextArea
              label={t('dashboard.extraPersonalInfo')}
              value={personal.senderProfile}
              onChange={(value) => updatePersonalDraft('senderProfile', value)}
            />
          </div>
          {personalStatus ? <p className="mt-4 text-sm font-medium text-[#d70015]">{personalStatus}</p> : null}
          <ModalActions
            saving={personalSaving}
            primaryLabel={t('common.save')}
            onPrimary={() => void savePersonalFromModal()}
            onCancel={() => setEditPanel('')}
          />
        </EditPanelModal>
      ) : null}

      {editPanel === 'outreach' ? (
        <EditPanelModal title={t('dashboard.editOutreachTitle')} onClose={() => setEditPanel('')}>
          <div className="space-y-4">
            <PreferenceOptions
              label={t('dashboard.emailTone')}
              value={outreachDraft?.emailTone || 'warm'}
              options={[
                ['warm', t('dashboard.toneWarm')],
                ['concise', t('dashboard.toneDirect')],
                ['confident', t('dashboard.toneConfident')],
                ['formal', t('dashboard.toneFormal')]
              ]}
              onChange={(value) => updateOutreachDraft('emailTone', value as OutreachDraft['emailTone'])}
            />
            <PreferenceOptions
              label={t('dashboard.outreachLength')}
              value={outreachDraft?.outreachLength || 'concise'}
              options={[
                ['short', t('dashboard.lengthShort')],
                ['concise', t('dashboard.lengthConcise')],
                ['detailed', t('dashboard.lengthDetailed')]
              ]}
              onChange={(value) => updateOutreachDraft('outreachLength', value as OutreachDraft['outreachLength'])}
            />
            <PreferenceOptions
              label={t('dashboard.outreachGoal')}
              value={outreachDraft?.outreachGoal || 'advice'}
              options={[
                ['advice', t('dashboard.goalAdvice')],
                ['referral', t('dashboard.goalReferral')],
                ['intro', t('dashboard.goalIntro')]
              ]}
              onChange={(value) => updateOutreachDraft('outreachGoal', value as OutreachDraft['outreachGoal'])}
            />
            <ProfileTextArea
              label={t('dashboard.extraStyleNotes')}
              value={outreachDraft?.outreachStyleNotes || ''}
              onChange={(value) => updateOutreachDraft('outreachStyleNotes', value)}
            />
          </div>
          {preferenceStatus ? <p className="mt-4 text-sm font-medium text-[#d70015]">{preferenceStatus}</p> : null}
          <ModalActions
            saving={preferenceSaving}
            primaryLabel={t('common.save')}
            onPrimary={() => void saveOutreachFromModal()}
            onCancel={() => setEditPanel('')}
          />
        </EditPanelModal>
      ) : null}

      {editPanel === 'resume' ? (
        <EditPanelModal title={t('dashboard.updateResumeTitle')} onClose={() => setEditPanel('')}>
          <div className="rounded-[12px] border border-[#86868b] px-5 py-5">
            <p className="text-[17px] font-semibold text-[#1d1d1f]">
              {settings.resumeFileName || (settings.resumeContext ? t('dashboard.savedResume') : t('dashboard.noResume'))}
            </p>
            <p className="mt-1 text-[15px] font-normal leading-5 text-[#6e6e73]">
              {t('dashboard.uploadResumeHelp')}
            </p>
            <Button className="mt-5" isDisabled={resumeSaving || !accountSettings} onPress={() => resumeInputRef.current?.click()}>{resumeSaving ? t('dashboard.uploading') : t('dashboard.chooseFile')}</Button>
              <input ref={resumeInputRef}
                type="file"
                accept={RESUME_FILE_ACCEPT}
                hidden
                disabled={resumeSaving || !accountSettings}
                onChange={importResumeFile}
              />
          </div>
          {resumeStatus ? <p className="mt-4 text-sm font-medium text-[#6e6e73]">{resumeStatus}</p> : null}
          <ModalActions
            saving={resumeSaving}
            primaryLabel={t('common.done')}
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
  const { t } = useI18n();
  return (
    <Card className="mx-auto mt-4 max-w-[760px]">
      <Card.Title className="flex items-center gap-3">
        <Info className="h-6 w-6 shrink-0 stroke-[2.1]" aria-hidden="true" />
        {t('dashboard.inviteFriend')}
      </Card.Title>
      <p className="secondary mt-3 max-w-[620px]">
        {t('dashboard.inviteBody')}
      </p>
      <Button
        type="button"
        onClick={onCopyInviteLink}
        isDisabled={inviteCopying}
        className="mt-6 w-fit"
      >
        {inviteCopying ? t('common.copying') : t('dashboard.copyInviteLink')}
      </Button>
      {inviteStatus ? (
        <p className="mt-4 text-[15px] font-normal leading-5 text-[#6e6e73]">{inviteStatus}</p>
      ) : null}
    </Card>
  );
}

function SectionIndex() {
  const { t } = useI18n();
  const items = [
    { label: t('dashboard.recent'), href: '#recent-outreach', icon: History },
    { label: t('dashboard.plan'), href: '#plan', icon: CreditCard },
    { label: t('dashboard.profile'), href: '#profile', icon: UserRound },
    { label: t('dashboard.resume'), href: '#resume', icon: FileText },
    { label: t('dashboard.account'), href: '#account', icon: ShieldCheck }
  ];

  return (
    <nav className="mx-auto mt-4 flex max-w-[760px] flex-wrap items-start justify-center gap-x-7 gap-y-4" aria-label={t('dashboard.sections')}>
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
    <Card id={id} className="mx-auto mt-4 max-w-[760px] scroll-mt-8"><Card.Header><Card.Title>{title}</Card.Title></Card.Header><Card.Content>{children}</Card.Content></Card>
  );
}

function ExtensionStatus({ connected }: { connected: boolean }) {
  const { t } = useI18n();
  return <Chip size="sm" color={connected ? 'accent' : 'default'} variant="soft">{connected ? t('dashboard.connected') : t('dashboard.notConnected')}</Chip>;
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
  label,
  onClick
}: {
  label?: string;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
    >
      {label || t('common.edit')}
    </Button>
  );
}

function EditPanelModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  return <ProfileModal title={title} onClose={onClose} closeLabel={t('common.close')}>{children}</ProfileModal>;
}

function ModalActions({ saving, primaryLabel, onPrimary, onCancel }: { saving: boolean; primaryLabel: string; onPrimary: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return <ProfileActions saving={saving} primaryLabel={saving ? t('common.saving') : primaryLabel} cancelLabel={t('common.cancel')} onPrimary={onPrimary} onCancel={onCancel} />;
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
        <p className="profile-label">{label}</p>
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
        <p className="profile-label">{label}</p>
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
      <p className="profile-label">{label}</p>
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
    <Button
      type="button"
      onClick={onEdit}
      variant="ghost" fullWidth className="h-auto min-h-11 justify-start text-left"
    >
      <span className={`value block min-w-0 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>
        {value}
      </span>
    </Button>
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
      <p className="profile-label">{label}</p>
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
      <Input
        aria-label="Extra style notes"
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
        className="w-full"
        placeholder="Extra style notes"
      />
    </div>
  );
}

function InlineSelect({ value, saving, options, onSave }: { value: string; saving: boolean; options: [string, string][]; onCancel: () => void; onSave: (value: string) => void }) {
  const { t } = useI18n();
  return <PreferenceOptions label={t('onboarding.outreach')} value={value} options={options} onChange={onSave} isDisabled={saving} />;
}

function ResolveOptions({ items, onSelect }: { items: ResolvedItem[]; onSelect: (item: ResolvedItem) => void }) {
  const { t } = useI18n();
  return <ResolvedOptions items={items} onSelect={onSelect} label={t('onboarding.search')} />;
}

function lengthLabel(value?: Settings['outreachLength']) {
  if (value === 'short') return 'Short';
  if (value === 'detailed') return 'Detailed';
  return 'Concise';
}

function toneLabel(value?: Settings['emailTone']) {
  if (value === 'concise') return 'Direct';
  if (value === 'confident') return 'Confident';
  if (value === 'formal') return 'Formal';
  return 'Warm';
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

function formatDateTime(value: string | null | undefined, language: 'en' | 'zh') {
  if (!value) return '';
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(value));
}

function formatNumber(value: number | undefined, language: 'en' | 'zh') {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '...';
}

function displayName(user: AccountData['user'] | undefined, fallback: string) {
  if (!user) return fallback;
  return user.name || user.email.split('@')[0];
}
