'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PreferencesPage() {
  const [settings, setSettings] = useState<any>({});
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/settings').then((res) => res.json()).then((payload) => setSettings(payload || {}));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form))
    });
    const payload = await response.json();
    setStatus(payload.ok ? 'Saved.' : payload.error || 'Could not save settings.');
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Preferences</h1>
      <Card>
        <CardHeader>
          <CardTitle>Outreach defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4 max-w-xl" onSubmit={submit}>
            <div>
              <Label htmlFor="targetRole">Target role</Label>
              <Input id="targetRole" name="targetRole" defaultValue={settings?.targetRole || ''} placeholder="Software Engineer Intern" />
            </div>
            <div>
              <Label htmlFor="emailTone">Email tone</Label>
              <Input id="emailTone" name="emailTone" defaultValue={settings?.emailTone || 'warm'} placeholder="warm, concise, formal" />
            </div>
            <div>
              <Label htmlFor="location">Default location</Label>
              <Input id="location" name="location" defaultValue={settings?.defaultSearchPreferences?.location || ''} placeholder="San Francisco Bay Area" />
            </div>
            <div>
              <Label htmlFor="seniority">Preferred seniority</Label>
              <Input id="seniority" name="seniority" defaultValue={settings?.defaultSearchPreferences?.seniority || ''} placeholder="Recruiter, Manager, Director" />
            </div>
            <div>
              <Label htmlFor="senderProfile">Sender profile</Label>
              <Input id="senderProfile" name="senderProfile" defaultValue={settings?.senderProfile || ''} placeholder="I am a Berkeley student..." />
            </div>
            <Button type="submit">Save preferences</Button>
            <p className="text-sm text-muted-foreground">{status}</p>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
