'use client';

import { useState } from 'react';
import { Alert, Button, Description, FieldError, Fieldset, Form, Input, Label, ListBox, Select, Separator, TextArea, TextField } from '@heroui/react';
import { SettingsRow } from '@/components/settings-row';
import { DropZone } from '@heroui-pro/react';
import { extractResumeText, getResumeTextErrorKey, RESUME_FILE_ACCEPT } from '@/lib/resume-text';
import { translate as t } from '@/lib/i18n';

export type ProfileValues = {
  name: string; school: string; region: string; senderProfile: string;
  resumeContext: string; resumeFileName: string; resumeUploadedAt: string;
  emailTone?: 'warm' | 'concise' | 'confident' | 'formal';
  outreachLength: 'short' | 'concise' | 'detailed';
  outreachGoal: 'advice' | 'referral' | 'intro'; outreachStyleNotes: string;
  defaultSearchPreferences: {
    school?: { label: string; linkedinId: string };
    region?: { label: string; linkedinGeoId: string };
  };
};

// Native HeroUI Fieldset/Form examples and Pro DropZone anatomy. Business state
// is shared by onboarding and My profile so neither retains a separate old UI.
export function ProfileForm({ initial, onboarding = false, preview = false, onSaved }: {
  initial: ProfileValues; onboarding?: boolean; preview?: boolean; onSaved?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const disabled = saving || importing;

  function update<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setStatus('');
    setValues(current => ({ ...current, [key]: value,
      ...((key === 'school' || key === 'region') ? {
        defaultSearchPreferences: { ...current.defaultSearchPreferences, [key]: undefined },
      } : {}),
    }));
  }

  async function importResume(file?: File) {
    if (!file || disabled) return;
    setImporting(true); setStatus('');
    try {
      const text = await extractResumeText(file);
      setValues(current => ({ ...current, resumeContext: text.slice(0, 40000), resumeFileName: file.name, resumeUploadedAt: new Date().toISOString() }));
    } catch (error) { setFailed(true); setStatus(t(getResumeTextErrorKey(error))); }
    finally { setImporting(false); }
  }

  async function save() {
    if (preview || disabled) return;
    if (!values.name.trim() || !values.school.trim() || (!values.senderProfile.trim() && !values.resumeContext.trim())) {
      setFailed(true); setStatus('Add your name, school or affiliation, and either a short background or a resume.'); return;
    }
    setSaving(true); setStatus('');
    try {
      const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, senderName: values.name, resumeUploadedAt: values.resumeUploadedAt || null }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not save your profile. Please try again.');
      setFailed(false); setStatus('Your profile has been saved.'); onSaved?.();
    } catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : 'Could not save your profile. Please try again.'); }
    finally { setSaving(false); }
  }

  return <Form className="flex w-full flex-col gap-4" onSubmit={event => { event.preventDefault(); void save(); }}>
    <Separator />
        <SettingsRow label="Personal information" description={onboarding ? "Your name and school or affiliation help make introductions relevant." : "Your name, school or affiliation, and region help make your outreach relevant."}>
        <Fieldset disabled={disabled} className="w-full">
          <Fieldset.Legend className="sr-only">Personal information</Fieldset.Legend>
          <Fieldset.Group className="gap-5">
            <TextField fullWidth isRequired name="name" maxLength={100} value={values.name} onChange={value => update('name', value)}>
              <Label className="sr-only">Full name</Label><Input autoComplete="name" placeholder="Your name" /><FieldError />
            </TextField>
            <div className={onboarding ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>
              {(onboarding ? ['school'] as const : ['school', 'region'] as const).map(kind => <div className="min-w-0" key={kind}>
                <TextField fullWidth isRequired={kind === 'school'} name={kind} maxLength={160} value={values[kind]} onChange={value => update(kind, value)}>
                  <Label className="sr-only">{kind === 'school' ? 'School or affiliation' : 'Region'}</Label>
                  <Input placeholder={kind === 'school' ? 'School or organization' : 'City or region'} /><FieldError />
                </TextField>
              </div>)}
            </div>
          </Fieldset.Group>
        </Fieldset>
        </SettingsRow>
        <Separator />
        <SettingsRow label="Background and resume" description="Add a resume or a few sentences about yourself. Either is enough to get started.">
        <Fieldset disabled={disabled} className="w-full">
          <Fieldset.Legend className="sr-only">Background and resume</Fieldset.Legend>
          <Fieldset.Group className="gap-5">
            <DropZone className="w-full">
              <DropZone.Area isDisabled={disabled} onDrop={async event => {
                const file = event.items.find(item => item.kind === 'file');
                if (file?.kind === 'file') await importResume(await file.getFile());
              }}>
                <DropZone.Icon /><DropZone.Label>{importing ? 'Reading your resume…' : 'Drop your resume here'}</DropZone.Label>
                <DropZone.Description>PDF, DOCX or text. Your resume is used to personalize drafts.</DropZone.Description>
                <DropZone.Trigger isDisabled={disabled}>{values.resumeFileName ? 'Replace resume' : 'Choose a file'}</DropZone.Trigger>
              </DropZone.Area>
              <DropZone.Input accept={RESUME_FILE_ACCEPT} onSelect={files => void importResume(files[0])} />
              {values.resumeContext && <DropZone.FileList><DropZone.FileItem status="complete">
                <DropZone.FileFormatIcon format={values.resumeFileName.split('.').pop()?.toUpperCase() || 'FILE'} color="blue" />
                <DropZone.FileInfo><DropZone.FileName>{values.resumeFileName || 'Saved resume'}</DropZone.FileName><DropZone.FileMeta>Used to personalize your drafts</DropZone.FileMeta></DropZone.FileInfo>
                <DropZone.FileRemoveTrigger aria-label="Remove resume" isDisabled={disabled} onPress={() => setValues(current => ({ ...current, resumeContext: '', resumeFileName: '', resumeUploadedAt: '' }))} />
              </DropZone.FileItem></DropZone.FileList>}
            </DropZone>
            <TextField fullWidth name="senderProfile" isRequired={!values.resumeContext.trim()} maxLength={2000} value={values.senderProfile} onChange={value => update('senderProfile', value)}>
              <Label>A little about you</Label><TextArea rows={4} placeholder="What are you studying or working on, and what would you like to do next?" /><FieldError />
            </TextField>
          </Fieldset.Group>
        </Fieldset>
        </SettingsRow>
        {!onboarding && <><Separator /><SettingsRow label="Outreach preferences" description="Set the tone, length and goal of your drafts, with any extra guidance below.">
        <Fieldset disabled={disabled} className="w-full">
          <Fieldset.Legend className="sr-only">Outreach preferences</Fieldset.Legend>
          <Fieldset.Group className="gap-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <PreferenceSelect label="Tone" value={values.emailTone || 'warm'} options={['warm', 'concise', 'confident', 'formal']} onChange={value => update('emailTone', value as ProfileValues['emailTone'])} />
              <PreferenceSelect label="Length" value={values.outreachLength} options={['short', 'concise', 'detailed']} onChange={value => update('outreachLength', value as ProfileValues['outreachLength'])} />
              <PreferenceSelect label="Goal" value={values.outreachGoal} options={['advice', 'referral', 'intro']} onChange={value => update('outreachGoal', value as ProfileValues['outreachGoal'])} />
            </div>
            <TextField fullWidth name="outreachStyleNotes" maxLength={500} value={values.outreachStyleNotes} onChange={value => update('outreachStyleNotes', value)}><Label>Style notes</Label><TextArea rows={3} placeholder="Anything else your drafts should sound like…" /><FieldError /></TextField>
          </Fieldset.Group>
        </Fieldset></SettingsRow></>}
      <Separator />
      <footer className="flex flex-col gap-4 pt-2">
        {status && <Alert status={failed ? 'danger' : 'success'}><Alert.Indicator /><Alert.Content><Alert.Description>{status}</Alert.Description></Alert.Content></Alert>}
        <div className="flex justify-end"><Button type="submit" variant="primary" isPending={saving} isDisabled={preview || disabled}>{onboarding ? 'Continue to dashboard' : 'Save changes'}</Button></div>
      </footer>
  </Form>;
}

function PreferenceSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <Select fullWidth value={value} onChange={key => { if (key != null) onChange(String(key)); }}>
    <Label>{label}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{options.map(option => <ListBox.Item key={option} id={option} textValue={option}>{option.charAt(0).toUpperCase() + option.slice(1)}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
}
