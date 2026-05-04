'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Settings = {
  targetRole?: string | null;
  emailTone?: 'warm' | 'concise' | 'confident' | 'formal';
  senderProfile?: string | null;
  resumeContext?: string | null;
  defaultSearchPreferences?: {
    location?: string;
    seniority?: string;
    contactRole?: string;
  } | null;
};

export default function PreferencesPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Could not load preferences.')))
      .then((payload) => setSettings(payload || {}))
      .catch((error) => setStatus(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form))
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    setStatus(response.ok && payload.ok ? 'Saved.' : payload.error || 'Could not save settings.');
  }

  function clearResumeContext() {
    setSettings((current) => ({ ...current, resumeContext: '' }));
    setFormVersion((value) => value + 1);
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-lg font-medium lg:text-2xl">AI Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste your resume or background once. Connection uses it with each
          LinkedIn job and selected contact when generating Gmail drafts.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Resume context and outreach defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <form key={`${loading}-${formVersion}`} className="max-w-2xl space-y-5" onSubmit={submit}>
            <Field label="Target role" id="targetRole">
              <Input id="targetRole" name="targetRole" defaultValue={settings.targetRole || ''} placeholder="Software Engineer Intern" disabled={loading || saving} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email tone" id="emailTone">
                <select id="emailTone" name="emailTone" defaultValue={settings.emailTone || 'warm'} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="warm">Warm</option>
                  <option value="concise">Concise</option>
                  <option value="confident">Confident</option>
                  <option value="formal">Formal</option>
                </select>
              </Field>
              <Field label="Target contact" id="contactRole">
                <select id="contactRole" name="contactRole" defaultValue={settings.defaultSearchPreferences?.contactRole || 'recruiter'} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="recruiter">Recruiter</option>
                  <option value="hiring-manager">Hiring manager</option>
                  <option value="team-lead">Team lead</option>
                  <option value="alumni">Alumni</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default location" id="location">
                <Input id="location" name="location" defaultValue={settings.defaultSearchPreferences?.location || ''} placeholder="San Francisco Bay Area" disabled={loading || saving} />
              </Field>
              <Field label="Preferred seniority" id="seniority">
                <select id="seniority" name="seniority" defaultValue={settings.defaultSearchPreferences?.seniority || 'recruiter'} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="recruiter">Recruiter</option>
                  <option value="hiring-manager">Hiring manager</option>
                  <option value="team-lead">Team lead</option>
                  <option value="alumni">Alumni</option>
                  <option value="executive">Executive</option>
                </select>
              </Field>
            </div>
            <Field label="Personal background" id="senderProfile">
              <textarea id="senderProfile" name="senderProfile" defaultValue={settings.senderProfile || ''} placeholder="I am a Berkeley student focused on full-stack engineering..." disabled={loading || saving} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Resume context" id="resumeContext">
              <textarea id="resumeContext" name="resumeContext" defaultValue={settings.resumeContext || ''} placeholder="Paste your resume, projects, internships, education, skills, links, and truthful background context." disabled={loading || saving} className="min-h-56 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Stored in your account settings and sent to OpenAI only when you generate a draft. OpenAI API data is not used to train models.
                </p>
                <Button type="button" variant="ghost" disabled={loading || saving} onClick={clearResumeContext}>
                  Clear
                </Button>
              </div>
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading || saving} className="rounded-md">
                {saving ? 'Saving...' : 'Save AI profile'}
              </Button>
              <p className="text-sm text-muted-foreground">{loading ? 'Loading...' : status}</p>
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
