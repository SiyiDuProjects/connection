'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/language-provider';

type Settings = {
  senderName?: string | null;
  school?: string | null;
  emailSignature?: string | null;
  introStyle?: 'student' | 'career-switcher' | 'experienced' | 'founder';
  emailTone?: 'warm' | 'concise' | 'confident' | 'formal';
  senderProfile?: string | null;
  resumeContext?: string | null;
};

export default function ProfilePage() {
  const [settings, setSettings] = useState<Settings>({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(t('profile.loadError'))))
      .then((payload) => setSettings(payload || {}))
      .catch((error) => setStatus(error.message))
      .finally(() => setLoading(false));
  }, [t]);

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
    setStatus(response.ok && payload.ok ? t('profile.saved') : payload.error || t('profile.saveError'));
  }

  function clearResumeContext() {
    setSettings((current) => ({ ...current, resumeContext: '' }));
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
              <Field label={t('profile.senderName')} id="senderName">
                <Input id="senderName" name="senderName" defaultValue={settings.senderName || ''} placeholder={t('profile.senderNamePlaceholder')} disabled={loading || saving} />
              </Field>
              <Field label={t('profile.school')} id="school">
                <Input id="school" name="school" defaultValue={settings.school || ''} placeholder={t('profile.schoolPlaceholder')} disabled={loading || saving} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('profile.emailTone')} id="emailTone">
                <select id="emailTone" name="emailTone" defaultValue={settings.emailTone || 'warm'} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="warm">{t('profile.warm')}</option>
                  <option value="concise">{t('profile.concise')}</option>
                  <option value="confident">{t('profile.confident')}</option>
                  <option value="formal">{t('profile.formal')}</option>
                </select>
              </Field>
              <Field label={t('profile.introStyle')} id="introStyle">
                <select id="introStyle" name="introStyle" defaultValue={settings.introStyle || 'student'} disabled={loading || saving} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="student">{t('profile.student')}</option>
                  <option value="career-switcher">{t('profile.careerSwitcher')}</option>
                  <option value="experienced">{t('profile.experienced')}</option>
                  <option value="founder">{t('profile.founder')}</option>
                </select>
              </Field>
            </div>
            <Field label={t('profile.personalBackground')} id="senderProfile">
              <textarea id="senderProfile" name="senderProfile" defaultValue={settings.senderProfile || ''} placeholder={t('profile.personalBackgroundPlaceholder')} disabled={loading || saving} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label={t('profile.emailSignature')} id="emailSignature">
              <textarea id="emailSignature" name="emailSignature" defaultValue={settings.emailSignature || ''} placeholder={t('profile.emailSignaturePlaceholder')} disabled={loading || saving} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label={t('profile.resumeContext')} id="resumeContext">
              <textarea id="resumeContext" name="resumeContext" defaultValue={settings.resumeContext || ''} placeholder={t('profile.resumeContextPlaceholder')} disabled={loading || saving} className="min-h-56 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
