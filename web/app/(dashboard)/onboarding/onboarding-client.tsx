'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileText, Loader2, Pencil, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, TextField, TextArea, InputGroup, Chip, Card } from '@heroui/react';
import { ResolvedOptions } from '@/components/ui/profile-controls';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/language-provider';
import {
  extractResumeText,
  getResumeTextErrorKey,
  RESUME_FILE_ACCEPT
} from '@/lib/resume-text';

type OnboardingValues = {
  name: string;
  region: string;
  school: string;
  senderProfile: string;
  resumeContext: string;
  resumeFileName: string;
  resumeUploadedAt: string;
  outreachLength: 'short' | 'concise' | 'detailed';
  outreachGoal: 'advice' | 'referral' | 'intro';
  outreachStyleNotes: string;
  defaultSearchPreferences: SearchPreferences;
};

type ResolvedItem = {
  id: string;
  label: string;
  subtitle: string;
  type: 'school' | 'location';
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

const sectionDivider = 'border-t border-[#d2d2d7] pt-8';

export function OnboardingClient({
  initial,
  redirectTo
}: {
  initial: OnboardingValues;
  redirectTo: string;
}) {
  const router = useRouter();
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const { language, t } = useI18n();
  const [values, setValues] = useState<OnboardingValues>(initial);
  const [status, setStatus] = useState('');
  const [resolving, setResolving] = useState<'school' | 'region' | ''>('');
  const [schoolOptions, setSchoolOptions] = useState<ResolvedItem[]>([]);
  const [regionOptions, setRegionOptions] = useState<ResolvedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const missing = useMemo(() => validate(values), [values]);
  const canContinue = missing.length === 0;
  const nameParts = splitName(values.name);

  function update(name: Exclude<keyof OnboardingValues, 'defaultSearchPreferences'>, value: string) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === 'school') {
        next.defaultSearchPreferences = {
          ...current.defaultSearchPreferences,
          school: current.defaultSearchPreferences.school?.label === value ? current.defaultSearchPreferences.school : undefined
        };
      }
      if (name === 'region') {
        next.defaultSearchPreferences = {
          ...current.defaultSearchPreferences,
          region: current.defaultSearchPreferences.region?.label === value ? current.defaultSearchPreferences.region : undefined
        };
      }
      return next;
    });
  }

  async function resolveField(type: 'school' | 'region') {
    const query = (type === 'school' ? values.school : values.region).trim();
    if (query.length < 2) {
      return;
    }
    setResolving(type);
    setStatus('');
    if (type === 'school') setSchoolOptions([]);
    else setRegionOptions([]);

    const path = type === 'school' ? '/api/metadata/schools' : '/api/metadata/locations';
    const response = await fetch(`${path}?q=${encodeURIComponent(query)}`);
    const payload = await response.json().catch(() => ({}));
    setResolving('');
    if (!response.ok || !payload.ok) {
      setStatus(payload.error || t(type === 'school' ? 'onboarding.schoolConfirmError' : 'onboarding.regionConfirmError'));
      return;
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (type === 'school') setSchoolOptions(items);
    else setRegionOptions(items);
    if (!items.length) setStatus(t(type === 'school' ? 'onboarding.noSchoolMatches' : 'onboarding.noRegionMatches'));
  }

  function selectResolved(type: 'school' | 'region', item: ResolvedItem) {
    setValues((current) => ({
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
    setStatus('');
  }

  function updateNamePart(part: 'first' | 'last', value: string) {
    const current = splitName(values.name);
    const first = part === 'first' ? value : current.first;
    const last = part === 'last' ? value : current.last;
    update('name', [first.trim(), last.trim()].filter(Boolean).join(' '));
  }

  async function importResumeFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractResumeText(file);
      setValues((current) => ({
        ...current,
        resumeContext: text.slice(0, 40000),
        resumeFileName: file.name,
        resumeUploadedAt: new Date().toISOString()
      }));
      setStatus(t('onboarding.resumeImported'));
    } catch (error) {
      setStatus(t(getResumeTextErrorKey(error)));
      event.target.value = '';
    }
  }

  function clearResume() {
    setValues((current) => ({
      ...current,
      resumeContext: '',
      resumeFileName: '',
      resumeUploadedAt: ''
    }));
  }

  async function submit() {
    const nextMissing = validate(values);
    if (nextMissing.length) {
      setStatus(t('onboarding.completeFields'));
      return;
    }

    setSaving(true);
    setStatus('');
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        senderName: values.name,
        resumeUploadedAt: values.resumeUploadedAt || null
      })
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !payload.ok) {
      setStatus(payload.error || t('onboarding.saveError'));
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-white px-4 pb-16 pt-20 text-[#1d1d1f]">
      <section className="mx-auto max-w-[680px]">
        <div className="mx-auto mt-11 max-w-[560px] text-center">
          <h1 className="text-[40px] font-semibold leading-[1.1] tracking-normal text-[#1d1d1f] sm:text-[44px]">
            {t('onboarding.title')}
          </h1>
          <p className="mt-4 text-[19px] leading-7 text-[#1d1d1f]">
            {t('onboarding.description')}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-[516px]">
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('onboarding.firstName')} required>
                  <Input value={nameParts.first} onChange={(event) => updateNamePart('first', event.target.value)} placeholder={t('onboarding.firstName')} />
                </Field>
                <Field label={t('onboarding.lastName')} required>
                  <Input value={nameParts.last} onChange={(event) => updateNamePart('last', event.target.value)} placeholder={t('onboarding.lastName')} />
                </Field>
              </div>
              <Field label={t('onboarding.schoolAffiliation')} required>
                <ResolveInput
                  value={values.school}
                  onChange={(value) => update('school', value)}
                  onResolve={() => resolveField('school')}
                  resolving={resolving === 'school'}
                  verified={values.defaultSearchPreferences.school?.label === values.school}
                  placeholder={t('onboarding.schoolAffiliation')}
                />
                <ResolveOptions items={schoolOptions} onSelect={(item) => selectResolved('school', item)} />
              </Field>
              <Field label={t('onboarding.region')}>
                <ResolveInput
                  value={values.region}
                  onChange={(value) => update('region', value)}
                  onResolve={() => resolveField('region')}
                  resolving={resolving === 'region'}
                  verified={Boolean(values.region) && values.defaultSearchPreferences.region?.label === values.region}
                  placeholder={t('onboarding.region')}
                />
                <ResolveOptions items={regionOptions} onSelect={(item) => selectResolved('region', item)} />
              </Field>
              <Field label={t('onboarding.extraPersonalInfo')}>
                <TextArea
                  value={values.senderProfile}
                  onChange={(event) => update('senderProfile', event.target.value)}
                  className="min-h-28"
                  placeholder={t('onboarding.extraPersonalInfo')}
                />
              </Field>
              <Field label={t('onboarding.resume')}>
                <Card variant="secondary" className="flex-row items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#6e6e73]">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-[#1d1d1f]">
                          {values.resumeFileName || t('onboarding.noResume')}
                        </p>
                        {values.resumeFileName ? (
                          <Chip size="sm">{t('onboarding.default')}</Chip>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] font-normal text-[#6e6e73]">
                        {values.resumeUploadedAt
                          ? t('onboarding.stored', { date: formatDateTime(values.resumeUploadedAt, language) })
                          : t('onboarding.resumeHelp')}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {values.resumeFileName ? (
                      <Button type="button" onClick={clearResume} variant="ghost" size="sm">
                        {t('onboarding.clear')}
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon" aria-label={values.resumeFileName ? t('onboarding.replaceResume') : t('onboarding.uploadResume')} onPress={() => resumeInputRef.current?.click()}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>
                      <input ref={resumeInputRef}
                        type="file"
                        accept={RESUME_FILE_ACCEPT}
                        onChange={importResumeFile}
                        hidden
                      />
                  </div>
                </Card>
              </Field>
            </div>

            <div className={cn(sectionDivider, 'space-y-3')}>
              <h2 className="text-[21px] font-semibold leading-6 text-[#1d1d1f]">{t('onboarding.outreach')}</h2>
              <Field label={t('onboarding.extraStyleNotes')}>
                <TextArea
                  value={values.outreachStyleNotes}
                  onChange={(event) => update('outreachStyleNotes', event.target.value.slice(0, 500))}
                  className="min-h-24"
                  placeholder={t('onboarding.extraStyleNotes')}
                />
              </Field>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#d2d2d7] pt-6">
            <p className="text-sm text-[#6e6e73]">
              {status || (missing.length
                ? t('onboarding.requiredRemaining', { count: missing.length })
                : t('onboarding.ready'))}
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                disabled={!canContinue || saving}
                onClick={submit}

              >
                {saving ? t('onboarding.saving') : t('onboarding.finish')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <TextField isRequired={required}><Label>{label}</Label>{children}</TextField>
  );
}

function ResolveInput({
  value,
  onChange,
  onResolve,
  resolving,
  verified,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  onResolve: () => void;
  resolving: boolean;
  verified: boolean;
  placeholder: string;
}) {
  const { t } = useI18n();
  return (
    <InputGroup>
      <InputGroup.Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <InputGroup.Suffix>
      <Button
        type="button"
        variant="ghost" size="icon"
        onClick={onResolve}
        disabled={resolving}
      >
        {resolving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : verified ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Search className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="sr-only">{verified ? t('onboarding.verified') : t('onboarding.search')}</span>
      </Button>
      </InputGroup.Suffix>
    </InputGroup>
  );
}

function ResolveOptions({ items, onSelect }: { items: ResolvedItem[]; onSelect: (item: ResolvedItem) => void }) {
  const { t } = useI18n();
  return <ResolvedOptions items={items} onSelect={onSelect} label={t('onboarding.search')} />;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' ')
  };
}

function validate(values: OnboardingValues) {
  const missing: string[] = [];
  const name = splitName(values.name);
  if (!name.first || !name.last) missing.push('name');
  if (!values.school.trim()) missing.push('school');
  if (!values.senderProfile.trim() && !values.resumeContext.trim()) missing.push('background');
  return missing;
}

function formatDateTime(value: string | null | undefined, language: 'en' | 'zh') {
  if (!value) return '';
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
