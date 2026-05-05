'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Settings = {
  senderName?: string | null;
  school?: string | null;
  emailSignature?: string | null;
  introStyle?: 'student' | 'career-switcher' | 'experienced' | 'founder';
  emailTone?: 'warm' | 'concise' | 'confident' | 'formal';
  targetRole?: string | null;
  senderProfile?: string | null;
  resumeContext?: string | null;
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
          Save stable personal context once. Company, job title, JD, and contact details stay in the LinkedIn plugin context.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Personal context for AI drafts</CardTitle>
        </CardHeader>
        <CardContent>
          <form key={`${loading}-${formVersion}`} className="max-w-2xl space-y-5" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sender name" id="senderName">
                <Input id="senderName" name="senderName" defaultValue={settings.senderName || ''} placeholder="Alex Chen" disabled={loading || saving} />
              </Field>
              <Field label="School or affiliation" id="school">
                <Input id="school" name="school" defaultValue={settings.school || ''} placeholder="UC Berkeley" disabled={loading || saving} />
              </Field>
            </div>
            <Field label="Default target role / 求职方向" id="targetRole">
              <Input id="targetRole" name="targetRole" defaultValue={settings.targetRole || ''} placeholder="Software Engineer Intern, Product Manager, Data Analyst..." disabled={loading || saving} />
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
              <Field label="Default intro style" id="introStyle">
                <select id="introStyle" name="introStyle" defaultValue={settings.introStyle || 'student'} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="student">Student</option>
                  <option value="career-switcher">Career switcher</option>
                  <option value="experienced">Experienced professional</option>
                  <option value="founder">Founder / builder</option>
                </select>
              </Field>
            </div>
            <Field label="Personal background" id="senderProfile">
              <textarea id="senderProfile" name="senderProfile" defaultValue={settings.senderProfile || ''} placeholder="I am a Berkeley student focused on full-stack engineering..." disabled={loading || saving} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Email signature" id="emailSignature">
              <textarea id="emailSignature" name="emailSignature" defaultValue={settings.emailSignature || ''} placeholder="Best,\nAlex" disabled={loading || saving} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
