'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/language-provider';

type Settings = {
  name?: string | null;
  senderName?: string | null;
  region?: string | null;
  school?: string | null;
  emailSignature?: string | null;
  introStyle?: 'student' | 'career-switcher' | 'experienced' | 'founder';
  emailTone?: 'warm' | 'concise' | 'confident' | 'formal';
  outreachLength?: 'short' | 'concise' | 'detailed';
  outreachGoal?: 'advice' | 'referral' | 'intro';
  outreachStyleNotes?: string | null;
  targetRole?: string | null;
  senderProfile?: string | null;
  resumeContext?: string | null;
  resumeFileName?: string | null;
  resumeUploadedAt?: string | null;
  defaultSearchPreferences?: SearchPreferences;
};

type SearchPreferences = {
  school?: {
    label: string;
    linkedinId: string;
  };
  region?: {
    label: string;
    linkedinGeoId: string;
  };
};

type ResolvedItem = {
  id: string;
  label: string;
  subtitle: string;
  type: 'school' | 'location';
};

export default function ProfilePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({});
  const [status, setStatus] = useState('');
  const [resolveStatus, setResolveStatus] = useState('');
  const [resolving, setResolving] = useState<'school' | 'region' | ''>('');
  const [schoolOptions, setSchoolOptions] = useState<ResolvedItem[]>([]);
  const [regionOptions, setRegionOptions] = useState<ResolvedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(t('profile.loadError'))))
      .then((payload) => setSettings(normalizeSettings(payload || {})))
      .catch((error) => setStatus(error.message))
      .finally(() => setLoading(false));
  }, [t]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...settings,
        senderName: settings.senderName || settings.name || '',
        defaultSearchPreferences: settings.defaultSearchPreferences || {}
      })
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (response.ok && payload.ok) {
      setStatus(t('profile.saved'));
      router.push('/dashboard');
      return;
    }
    setStatus(payload.error || t('profile.saveError'));
  }

  function update(name: keyof Settings, value: string) {
    setSettings((current) => {
      const next = { ...current, [name]: value };
      if (name === 'school') {
        next.defaultSearchPreferences = {
          ...current.defaultSearchPreferences,
          school: current.defaultSearchPreferences?.school?.label === value
            ? current.defaultSearchPreferences.school
            : undefined
        };
        setSchoolOptions([]);
      }
      if (name === 'region') {
        next.defaultSearchPreferences = {
          ...current.defaultSearchPreferences,
          region: current.defaultSearchPreferences?.region?.label === value
            ? current.defaultSearchPreferences.region
            : undefined
        };
        setRegionOptions([]);
      }
      return next;
    });
  }

  async function resolveField(type: 'school' | 'region') {
    const query = String(type === 'school' ? settings.school || '' : settings.region || '').trim();
    if (query.length < 2) {
      setResolveStatus('Enter at least 2 characters before confirming.');
      return;
    }

    setResolving(type);
    setResolveStatus('');
    if (type === 'school') setSchoolOptions([]);
    else setRegionOptions([]);

    const path = type === 'school' ? '/api/metadata/schools' : '/api/metadata/locations';
    const response = await fetch(`${path}?q=${encodeURIComponent(query)}`);
    const payload = await response.json().catch(() => ({}));
    setResolving('');
    if (!response.ok || !payload.ok) {
      setResolveStatus(payload.error || `Could not confirm ${type}.`);
      return;
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (type === 'school') setSchoolOptions(items);
    else setRegionOptions(items);
    setResolveStatus(items.length ? `Choose the matching ${type}.` : `No ${type} matches found.`);
  }

  function selectResolved(type: 'school' | 'region', item: ResolvedItem) {
    setSettings((current) => ({
      ...current,
      [type]: item.label,
      defaultSearchPreferences: {
        ...current.defaultSearchPreferences,
        ...(type === 'school'
          ? { school: { label: item.label, linkedinId: item.id } }
          : { region: { label: item.label, linkedinGeoId: item.id } })
      }
    }));
    if (type === 'school') setSchoolOptions([]);
    else setRegionOptions([]);
    setResolveStatus(`${item.label} confirmed.`);
  }

  function clearResumeContext() {
    setSettings((current) => ({ ...current, resumeContext: '', resumeFileName: '', resumeUploadedAt: null }));
    setFormVersion((value) => value + 1);
  }

  async function importResumeFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractReadableText(file);
      setSettings((current) => ({
        ...current,
        resumeContext: text.slice(0, 40000),
        resumeFileName: file.name,
        resumeUploadedAt: new Date().toISOString()
      }));
      setStatus(t('profile.resumeFileImported'));
      setFormVersion((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('profile.resumeFileUnsupported'));
      event.target.value = '';
    }
  }

  return (
    <section className="h-[calc(100dvh-64px)] overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-[760px]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-slate-950">Edit profile</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Keep only the context Reachard needs for contact search and outreach.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => router.push('/dashboard')} className="rounded-md">
              Cancel
            </Button>
            <Button type="submit" form="profile-form" disabled={loading || saving} className="rounded-md">
              {saving ? t('profile.saving') : 'Save'}
            </Button>
          </div>
        </div>
        <form id="profile-form" key={`${loading}-${formVersion}`} className="space-y-4" onSubmit={submit}>
          <Card className="rounded-[8px]">
            <CardHeader>
              <CardTitle>Personal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label={t('general.name')} id="name">
                <Input id="name" name="name" value={settings.name || ''} onChange={(event) => update('name', event.target.value)} placeholder={t('general.namePlaceholder')} disabled={loading || saving} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Region" id="region">
                  <ResolveInput
                    id="region"
                    value={settings.region || ''}
                    onChange={(value) => update('region', value)}
                    onResolve={() => resolveField('region')}
                    resolving={resolving === 'region'}
                    verified={settings.defaultSearchPreferences?.region?.label === settings.region}
                    placeholder="San Francisco Bay Area"
                    disabled={loading || saving}
                  />
                  <ResolveOptions items={regionOptions} onSelect={(item) => selectResolved('region', item)} />
                </Field>
                <Field label={t('profile.school')} id="school">
                  <ResolveInput
                    id="school"
                    value={settings.school || ''}
                    onChange={(value) => update('school', value)}
                    onResolve={() => resolveField('school')}
                    resolving={resolving === 'school'}
                    verified={settings.defaultSearchPreferences?.school?.label === settings.school}
                    placeholder={t('profile.schoolPlaceholder')}
                    disabled={loading || saving}
                  />
                  <ResolveOptions items={schoolOptions} onSelect={(item) => selectResolved('school', item)} />
                </Field>
              </div>
              {resolveStatus ? <p className="text-sm font-medium text-muted-foreground">{resolveStatus}</p> : null}
              <Field label="Extra personal info" id="senderProfile">
                <textarea id="senderProfile" name="senderProfile" value={settings.senderProfile || ''} onChange={(event) => update('senderProfile', event.target.value)} placeholder="Add any personal context that should shape outreach." disabled={loading || saving} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-[8px]">
            <CardHeader>
              <CardTitle>Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-[8px] bg-slate-50/80 p-3">
                <p className="text-sm font-semibold text-slate-950">
                  {settings.resumeFileName || 'No resume added'}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {settings.resumeFileName && settings.resumeUploadedAt
                    ? `Stored ${formatDateTime(settings.resumeUploadedAt)}`
                    : 'Add a resume file to improve outreach drafts'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Input id="resumeFile" type="file" accept=".txt,.md,.rtf,.pdf,.doc,.docx" disabled={loading || saving} onChange={importResumeFile} className="max-w-sm" />
                {settings.resumeFileName ? (
                  <Button type="button" variant="ghost" disabled={loading || saving} onClick={clearResumeContext} className="h-10 px-3">
                    {t('profile.clear')}
                  </Button>
                ) : null}
              </div>
              <input type="hidden" name="resumeFileName" value={settings.resumeFileName || ''} />
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">{loading ? t('profile.loading') : status}</p>
        </form>
      </div>
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
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

  return cleaned.slice(0, 40000);
}

function ResolveInput({
  id,
  value,
  onChange,
  onResolve,
  resolving,
  verified,
  placeholder,
  disabled
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onResolve: () => void;
  resolving: boolean;
  verified: boolean;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-12"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-8 w-8 rounded-md"
        onClick={onResolve}
        disabled={disabled || resolving}
        title={verified ? 'Verified' : 'Confirm'}
      >
        {verified ? <Check className="h-4 w-4" /> : <Search className="h-4 w-4" />}
      </Button>
      {resolving ? <span className="mt-1 block text-xs text-muted-foreground">Checking...</span> : null}
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
  if (!items.length) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-background">
      {items.map((item) => (
        <button
          key={`${item.type}-${item.id}`}
          type="button"
          onClick={() => onSelect(item)}
          className="block w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted"
        >
          <span className="block text-sm font-medium">{item.label}</span>
          {item.subtitle ? <span className="block text-xs text-muted-foreground">{item.subtitle}</span> : null}
        </button>
      ))}
    </div>
  );
}

function normalizeSettings(payload: Settings): Settings {
  const preferences = payload.defaultSearchPreferences || {};
  return {
    ...payload,
    emailTone: payload.emailTone || 'warm',
    introStyle: payload.introStyle || 'student',
    outreachLength: payload.outreachLength || 'concise',
    outreachGoal: payload.outreachGoal || 'advice',
    defaultSearchPreferences: {
      school: preferences.school?.label && preferences.school.linkedinId ? preferences.school : undefined,
      region: preferences.region?.label && preferences.region.linkedinGeoId ? preferences.region : undefined
    }
  };
}
