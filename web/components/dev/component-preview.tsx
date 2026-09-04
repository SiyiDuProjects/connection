'use client';

import { useState } from 'react';
import { Chip, Tabs } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AccountDropdown } from '@/components/ui/account-menu';
import { PreferenceOptions, ProfileActions, ProfileModal, ProfileTextArea, ProfileTextField, ResolvedOptions } from '@/components/ui/profile-controls';
import { Brand, ThemeSwitch } from '@/components/reachard/design';

export function ComponentPreview() {
  const [name, setName] = useState('Alex Morgan');
  const [notes, setNotes] = useState('I would love to learn more about the team.');
  const [goal, setGoal] = useState('advice');
  const [modal, setModal] = useState(false);
  const [status, setStatus] = useState('');
  const [choice, setChoice] = useState('');
  return <main className="min-h-screen bg-background px-5 py-8">
    <header className="mx-auto mb-10 flex max-w-4xl items-center justify-between"><Brand /><div className="flex items-center gap-2"><ThemeSwitch /><AccountDropdown initials="AM" labels={{menu:'Account menu',account:'View account',settings:'Settings',signOut:'Sign out'}} onAccount={() => setModal(true)} onSettings={() => setModal(true)} onSignOut={() => setStatus('Sign out selected (preview only)')} /></div></header>
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-3xl font-semibold">Shared components</h1>
      <p className="mb-8 text-muted">Local preview of the components used in account settings and onboarding.</p>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent className="space-y-5">
          <ProfileTextField label="Name" value={name} onChange={setName} />
          <ProfileTextArea label="Introduction" value={notes} onChange={setNotes} />
          <Button onPress={() => setModal(true)}>Edit preferences</Button>
          <Chip size="sm" color="accent" className="ml-3">Connected</Chip>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Actions and choices</CardTitle></CardHeader><CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3"><Button>Continue</Button><Button variant="secondary">Save draft</Button><Button variant="destructive">Remove</Button><Button disabled>Saving</Button></div>
          <PreferenceOptions label="Outreach goal" value={goal} onChange={setGoal} options={[['advice','Ask advice'],['referral','Explore referral'],['intro','Request intro']]} />
          <Tabs defaultSelectedKey="people"><Tabs.ListContainer><Tabs.List aria-label="Preview tabs"><Tabs.Tab id="people">People<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="drafts">Drafts<Tabs.Indicator /></Tabs.Tab></Tabs.List></Tabs.ListContainer><Tabs.Panel id="people"><ResolvedOptions label="School matches" items={[{type:'school',id:'1',label:'UC Berkeley',subtitle:'Berkeley, California'},{type:'school',id:'2',label:'Hanyang University',subtitle:'Seoul, South Korea'}]} onSelect={(item) => setChoice(item.label)} />{choice && <p role="status" className="mt-3 text-muted">Selected: {choice}</p>}</Tabs.Panel><Tabs.Panel id="drafts"><p className="py-4 text-muted">No saved drafts.</p></Tabs.Panel></Tabs>
        </CardContent></Card>
      </div>
      {status && <p role="status" className="mt-6 text-muted">{status}</p>}
    </div>
    {modal && <ProfileModal title="Outreach preferences" closeLabel="Close preferences" onClose={() => setModal(false)}><div className="space-y-5"><PreferenceOptions label="Outreach goal" value={goal} onChange={setGoal} options={[['advice','Ask advice'],['referral','Explore referral'],['intro','Request intro']]} /><ProfileTextArea label="Style notes" value={notes} onChange={setNotes} /></div><ProfileActions saving={false} primaryLabel="Save preferences" cancelLabel="Cancel" onPrimary={() => { setStatus('Preferences saved in this preview'); setModal(false); }} onCancel={() => setModal(false)} /></ProfileModal>}
  </main>;
}
