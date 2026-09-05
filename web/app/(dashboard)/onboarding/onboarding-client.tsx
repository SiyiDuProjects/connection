'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileText, Loader2, Pencil, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { translate as t } from '@/lib/i18n';
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

const controlClass =
  'h-14 rounded-[12px] border border-transparent bg-transparent px-4 text-[17px] font-normal leading-none text-[#1d1d1f] shadow-[inset_0_0_0_1px_#86868b] placeholder:text-[#6e6e73] transition-shadow duration-150 ease-out focus-visible:bg-transparent focus-visible:ring-0 focus-visible:shadow-[inset_0_0_0_2px_#0071e3] md:text-[17px]';
const textareaClass =
  'w-full rounded-[12px] border border-transparent bg-transparent px-4 py-4 text-[17px] font-normal leading-6 text-[#1d1d1f] shadow-[inset_0_0_0_1px_#86868b] placeholder:text-[#6e6e73] outline-none transition-shadow duration-150 ease-out focus:ring-0 focus:shadow-[inset_0_0_0_2px_#0071e3]';
const sectionDivider = 'border-t border-[#d2d2d7] pt-8';

export function OnboardingClient({
  initial,
  redirectTo
}: {
  initial: OnboardingValues;
  redirectTo: string;
}) {
  const router = useRouter();
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
                  <Input value={nameParts.first} onChange={(event) => updateNamePart('first', event.target.value)} placeholder={t('onboarding.firstName')} className={controlClass} />
                </Field>
                <Field label={t('onboarding.lastName')} required>
                  <Input value={nameParts.last} onChange={(event) => updateNamePart('last', event.target.value)} placeholder={t('onboarding.lastName')} className={controlClass} />
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
                <textarea
                  value={values.senderProfile}
                  onChange={(event) => update('senderProfile', event.target.value)}
                  className={cn(textareaClass, 'min-h-28')}
                  placeholder={t('onboarding.extraPersonalInfo')}
                />
              </Field>
              <Field label={t('onboarding.resume')}>
                <div className="flex min-h-14 min-w-0 items-center justify-between gap-4 rounded-[12px] border border-transparent bg-transparent px-4 py-3 shadow-[inset_0_0_0_1px_#86868b]">
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
                          <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-xs font-semibold text-[#3a3a3c]">
                            {t('onboarding.default')}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] font-normal text-[#6e6e73]">
                        {values.resumeUploadedAt
                          ? t('onboarding.stored', { date: formatDateTime(values.resumeUploadedAt) })
                          : t('onboarding.resumeHelp')}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {values.resumeFileName ? (
                      <button type="button" onClick={clearResume} className="text-sm font-medium text-[#6e6e73] transition-colors hover:text-[#1d1d1f]">
                        {t('onboarding.clear')}
                      </button>
                    ) : null}
                    <label className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]" title={values.resumeFileName ? t('onboarding.replaceResume') : t('onboarding.uploadResume')}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">{values.resumeFileName ? t('onboarding.replaceResume') : t('onboarding.uploadResume')}</span>
                      <input
                        type="file"
                        accept={RESUME_FILE_ACCEPT}
                        onChange={importResumeFile}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              </Field>
            </div>

            <div className={cn(sectionDivider, 'space-y-3')}>
              <h2 className="text-[21px] font-semibold leading-6 text-[#1d1d1f]">{t('onboarding.outreach')}</h2>
              <Field label={t('onboarding.extraStyleNotes')}>
                <textarea
                  value={values.outreachStyleNotes}
                  onChange={(event) => update('outreachStyleNotes', event.target.value.slice(0, 500))}
                  className={cn(textareaClass, 'min-h-24')}
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
                className="min-h-10 rounded-full bg-[#0071e3] px-5 text-white hover:bg-[#0077ed]"
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
  return (
    <div>
      <Label className="sr-only">{label}{required ? ` ${t('onboarding.required')}` : ''}</Label>
      {children}
    </div>
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
  return (
    <div className="relative">
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cn(controlClass, 'pr-12')} />
      <button
        type="button"
        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-60"
        onClick={onResolve}
        disabled={resolving}
        title={verified ? t('onboarding.verified') : t('onboarding.search')}
      >
        {resolving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : verified ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Search className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="sr-only">{verified ? t('onboarding.verified') : t('onboarding.search')}</span>
      </button>
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
    <div className="mt-2 overflow-hidden rounded-[12px] border border-[#d2d2d7] bg-white">
      {items.map((item) => (
        <button
          key={`${item.type}-${item.id}`}
          type="button"
          onClick={() => onSelect(item)}
          className="block w-full border-b border-[#f5f5f7] px-3 py-2 text-left last:border-b-0 hover:bg-[#f5f5f7]"
        >
          <span className="block text-sm font-semibold text-[#1d1d1f]">{item.label}</span>
          {item.subtitle ? <span className="block text-xs font-medium text-[#6e6e73]">{item.subtitle}</span> : null}
        </button>
      ))}
    </div>
  );
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
