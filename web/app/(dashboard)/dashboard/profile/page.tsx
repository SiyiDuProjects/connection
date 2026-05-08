'use client';

import { useEffect, useState } from 'react';
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
    setStatus(response.ok && payload.ok ? t('profile.saved') : payload.error || t('profile.saveError'));
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
    setSettings((current) => ({ ...current, resumeContext: '', resumeFileName: '' }));
    setFormVersion((value) => value + 1);
  }

  async function importResumeFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'md'].includes(extension || '')) {
      setStatus(t('profile.resumeFileUnsupported'));
      event.target.value = '';
      return;
    }

    const text = await file.text();
    setSettings((current) => ({
      ...current,
      resumeContext: text.slice(0, 40000),
      resumeFileName: file.name
    }));
    setStatus(t('profile.resumeFileImported'));
    setFormVersion((value) => value + 1);
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-lg font-medium lg:text-2xl">{t('profile.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('profile.subtitle')}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form key={`${loading}-${formVersion}`} className="max-w-2xl space-y-5" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('general.name')} id="name">
                <Input id="name" name="name" defaultValue={settings.name || ''} placeholder={t('general.namePlaceholder')} disabled={loading || saving} />
              </Field>
              <Field label={t('profile.senderName')} id="senderName">
                <Input id="senderName" name="senderName" defaultValue={settings.senderName || ''} placeholder={t('profile.senderNamePlaceholder')} disabled={loading || saving} />
              </Field>
            </div>
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
            <Field label="Target roles" id="targetRole">
              <Input id="targetRole" name="targetRole" value={settings.targetRole || ''} onChange={(event) => update('targetRole', event.target.value)} placeholder="Software Engineer Intern, Product Manager, Data Analyst" disabled={loading || saving} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('profile.emailTone')} id="emailTone">
                <select id="emailTone" name="emailTone" value={settings.emailTone || 'warm'} onChange={(event) => update('emailTone', event.target.value)} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="warm">{t('profile.warm')}</option>
                  <option value="concise">{t('profile.concise')}</option>
                  <option value="confident">{t('profile.confident')}</option>
                  <option value="formal">{t('profile.formal')}</option>
                </select>
              </Field>
              <Field label={t('profile.introStyle')} id="introStyle">
                <select id="introStyle" name="introStyle" value={settings.introStyle || 'student'} onChange={(event) => update('introStyle', event.target.value)} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="student">{t('profile.student')}</option>
                  <option value="career-switcher">{t('profile.careerSwitcher')}</option>
                  <option value="experienced">{t('profile.experienced')}</option>
                  <option value="founder">{t('profile.founder')}</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Outreach length" id="outreachLength">
                <select id="outreachLength" name="outreachLength" value={settings.outreachLength || 'concise'} onChange={(event) => update('outreachLength', event.target.value)} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="short">Short</option>
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                </select>
              </Field>
              <Field label="Outreach goal" id="outreachGoal">
                <select id="outreachGoal" name="outreachGoal" value={settings.outreachGoal || 'advice'} onChange={(event) => update('outreachGoal', event.target.value)} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="advice">Ask advice</option>
                  <option value="referral">Explore referral</option>
                  <option value="intro">Request intro</option>
                </select>
              </Field>
            </div>
            <Field label="Extra style notes" id="outreachStyleNotes">
              <textarea id="outreachStyleNotes" name="outreachStyleNotes" value={settings.outreachStyleNotes || ''} onChange={(event) => update('outreachStyleNotes', event.target.value)} placeholder="Example: sound less formal, mention curiosity about product work." disabled={loading || saving} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label={t('profile.personalBackground')} id="senderProfile">
              <textarea id="senderProfile" name="senderProfile" value={settings.senderProfile || ''} onChange={(event) => update('senderProfile', event.target.value)} placeholder={t('profile.personalBackgroundPlaceholder')} disabled={loading || saving} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label={t('profile.emailSignature')} id="emailSignature">
              <textarea id="emailSignature" name="emailSignature" value={settings.emailSignature || ''} onChange={(event) => update('emailSignature', event.target.value)} placeholder={t('profile.emailSignaturePlaceholder')} disabled={loading || saving} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label={t('profile.resumeContext')} id="resumeContext">
              <div className="flex flex-wrap items-center gap-3">
                <Input id="resumeFile" type="file" accept=".txt,.md,.pdf,.doc,.docx" disabled={loading || saving} onChange={importResumeFile} className="max-w-sm" />
                <input type="hidden" name="resumeFileName" value={settings.resumeFileName || ''} />
                {settings.resumeFileName ? (
                  <span className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                    {settings.resumeFileName}
                  </span>
                ) : null}
              </div>
              <textarea id="resumeContext" name="resumeContext" value={settings.resumeContext || ''} onChange={(event) => update('resumeContext', event.target.value)} placeholder={t('profile.resumeContextPlaceholder')} disabled={loading || saving} className="min-h-56 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {t('profile.privacyNote')}
                </p>
                <Button type="button" variant="ghost" disabled={loading || saving} onClick={clearResumeContext}>
                  {t('profile.clear')}
                </Button>
              </div>
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading || saving} className="rounded-md">
                {saving ? t('profile.saving') : t('profile.save')}
              </Button>
              <p className="text-sm text-muted-foreground">{loading ? t('profile.loading') : status}</p>
            </div>
          </form>
        </CardContent>
      </Card>
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
