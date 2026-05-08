'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type OnboardingValues = {
  name: string;
  senderName: string;
  region: string;
  school: string;
  targetRole: string;
  senderProfile: string;
  resumeContext: string;
  resumeFileName: string;
  emailSignature: string;
  introStyle: 'student' | 'career-switcher' | 'experienced' | 'founder';
  emailTone: 'warm' | 'concise' | 'confident' | 'formal';
  outreachLength: 'short' | 'concise' | 'detailed';
  outreachGoal: 'advice' | 'referral' | 'intro';
  outreachStyleNotes: string;
  defaultSearchPreferences: SearchPreferences;
};

const steps = ['Identity', 'Background', 'Custom'];

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

export function OnboardingClient({
  initial,
  redirectTo
}: {
  initial: OnboardingValues;
  redirectTo: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<OnboardingValues>(initial);
  const [status, setStatus] = useState('');
  const [resolveStatus, setResolveStatus] = useState('');
  const [resolving, setResolving] = useState<'school' | 'region' | ''>('');
  const [schoolOptions, setSchoolOptions] = useState<ResolvedItem[]>([]);
  const [regionOptions, setRegionOptions] = useState<ResolvedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const missing = useMemo(() => validate(values), [values]);
  const canContinue = step === 0
    ? !missing.some((field) => ['name', 'region', 'school', 'targetRole'].includes(field))
    : step === 1
      ? !missing.includes('background')
      : missing.length === 0;

  function update(name: keyof OnboardingValues, value: string) {
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
    setValues((current) => ({
      ...current,
      [type === 'school' ? 'school' : 'region']: item.label,
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

  async function submit() {
    const nextMissing = validate(values);
    if (nextMissing.length) {
      setStatus('Complete the highlighted fields before continuing.');
      return;
    }

    setSaving(true);
    setStatus('');
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        senderName: values.senderName || values.name
      })
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !payload.ok) {
      setStatus(payload.error || 'Could not save your profile.');
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-3xl">
        <div className="mb-7">
          <p className="text-sm font-semibold text-indigo-600">Reachard setup</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Build your outreach profile</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Reachard needs stable personal context before the extension can find contacts and draft outreach.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`h-10 rounded-[8px] border text-sm font-semibold ${
                step === index ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
          {step === 0 ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" required>
                  <Input value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="Alex Chen" />
                </Field>
                <Field label="Sender name">
                  <Input value={values.senderName} onChange={(event) => update('senderName', event.target.value)} placeholder="Alex" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Region" required>
                  <ResolveInput
                    value={values.region}
                    onChange={(value) => update('region', value)}
                    onResolve={() => resolveField('region')}
                    resolving={resolving === 'region'}
                    verified={values.defaultSearchPreferences.region?.label === values.region}
                    placeholder="San Francisco Bay Area"
                  />
                  <ResolveOptions items={regionOptions} onSelect={(item) => selectResolved('region', item)} />
                </Field>
                <Field label="School or identity" required>
                  <ResolveInput
                    value={values.school}
                    onChange={(value) => update('school', value)}
                    onResolve={() => resolveField('school')}
                    resolving={resolving === 'school'}
                    verified={values.defaultSearchPreferences.school?.label === values.school}
                    placeholder="UC Berkeley"
                  />
                  <ResolveOptions items={schoolOptions} onSelect={(item) => selectResolved('school', item)} />
                </Field>
              </div>
              {resolveStatus ? <p className="text-sm font-medium text-slate-500">{resolveStatus}</p> : null}
              <Field label="Target role" required>
                <Input value={values.targetRole} onChange={(event) => update('targetRole', event.target.value)} placeholder="Software Engineer Intern, Product Manager, Data Analyst" />
              </Field>
            </div>
          ) : step === 1 ? (
            <div className="space-y-5">
              <Field label="Personal background" required>
                <textarea value={values.senderProfile} onChange={(event) => update('senderProfile', event.target.value)} className="min-h-28 w-full rounded-md border border-input px-3 py-2 text-sm" placeholder="A truthful short summary of your education, projects, internships, skills, and focus." />
              </Field>
              <Field label="Resume context">
                <textarea value={values.resumeContext} onChange={(event) => update('resumeContext', event.target.value.slice(0, 40000))} className="min-h-44 w-full rounded-md border border-input px-3 py-2 text-sm" placeholder="Paste resume text or extra context. Personal background or resume context is required." />
              </Field>
              <Field label="Email signature">
                <textarea value={values.emailSignature} onChange={(event) => update('emailSignature', event.target.value)} className="min-h-20 w-full rounded-md border border-input px-3 py-2 text-sm" placeholder={'Best,\nAlex'} />
              </Field>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Default tone" value={values.emailTone} onChange={(value) => update('emailTone', value)}>
                  <option value="warm">Warm</option>
                  <option value="concise">Concise</option>
                  <option value="confident">Confident</option>
                  <option value="formal">Formal</option>
                </SelectField>
                <SelectField label="Default goal" value={values.outreachGoal} onChange={(value) => update('outreachGoal', value)}>
                  <option value="advice">Ask advice</option>
                  <option value="referral">Explore referral</option>
                  <option value="intro">Request intro</option>
                </SelectField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Default length" value={values.outreachLength} onChange={(value) => update('outreachLength', value)}>
                  <option value="short">Short</option>
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                </SelectField>
                <SelectField label="Intro style" value={values.introStyle} onChange={(value) => update('introStyle', value)}>
                  <option value="student">Student</option>
                  <option value="career-switcher">Career switcher</option>
                  <option value="experienced">Experienced professional</option>
                  <option value="founder">Founder / builder</option>
                </SelectField>
              </div>
              <Field label="Extra style notes">
                <textarea value={values.outreachStyleNotes} onChange={(event) => update('outreachStyleNotes', event.target.value.slice(0, 500))} className="min-h-24 w-full rounded-md border border-input px-3 py-2 text-sm" placeholder="Example: sound less formal, mention curiosity about product work." />
              </Field>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <p className="text-sm text-slate-500">{status || (missing.length ? `${missing.length} required item${missing.length === 1 ? '' : 's'} remaining.` : 'Ready to save.')}</p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="rounded-md" disabled={step === 0 || saving} onClick={() => setStep((value) => Math.max(0, value - 1))}>
                Back
              </Button>
              {step < steps.length - 1 ? (
                <Button type="button" className="rounded-md" disabled={!canContinue || saving} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>
                  Continue
                </Button>
              ) : (
                <Button type="button" className="rounded-md" disabled={!canContinue || saving} onClick={submit}>
                  {saving ? 'Saving...' : 'Finish setup'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required ? ' *' : ''}</Label>
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
    <div className="flex gap-2">
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <Button type="button" variant="outline" className="h-10 shrink-0 rounded-md" onClick={onResolve} disabled={resolving}>
        {resolving ? 'Checking...' : verified ? 'Verified' : 'Confirm'}
      </Button>
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
    <div className="mt-2 overflow-hidden rounded-[8px] border border-slate-200 bg-white">
      {items.map((item) => (
        <button
          key={`${item.type}-${item.id}`}
          type="button"
          onClick={() => onSelect(item)}
          className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
        >
          <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
          {item.subtitle ? <span className="block text-xs font-medium text-slate-500">{item.subtitle}</span> : null}
        </button>
      ))}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Field label={label} required>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        {children}
      </select>
    </Field>
  );
}

function validate(values: OnboardingValues) {
  const missing: string[] = [];
  if (!values.name.trim()) missing.push('name');
  if (!values.region.trim() || values.defaultSearchPreferences.region?.label !== values.region) missing.push('region');
  if (!values.school.trim() || values.defaultSearchPreferences.school?.label !== values.school) missing.push('school');
  if (!values.targetRole.trim()) missing.push('targetRole');
  if (!values.emailTone.trim()) missing.push('emailTone');
  if (!values.outreachGoal.trim()) missing.push('outreachGoal');
  if (!values.senderProfile.trim() && !values.resumeContext.trim()) missing.push('background');
  return missing;
}
