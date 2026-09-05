import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { useInteractOutside } from 'react-aria/useInteractOutside';
import { enableShadowDOM } from 'react-stately/private/flags/flags';
import { Avatar, Button, Card, Chip, Label, ListBox, Select, Spinner, TextArea, Input, Tooltip } from '@heroui/react';
import { EmptyState, Segment } from '@heroui-pro/react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Comment, Copy, Envelope, MapPin, Persons, Plus, PaperPlane } from '@gravity-ui/icons';
import styles from './compiled.css';
import background from './background.png';

const roots = new WeakMap();
// React Aria must follow composed event paths across the extension's shadow root.
enableShadowDOM();
const goals = [ ['advice', 'Advice', Comment], ['referral', 'Referral', Persons], ['intro', 'Introduction', PaperPlane] ];

function StyleSelect({ label, value, options, onChange, portal }) {
  const [isOpen, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  // Non-modal portals keep the Shadow DOM host accessible. Use React Aria's
  // composed-path-aware outside interaction hook to restore light dismissal.
  useInteractOutside({ ref: popoverRef, isDisabled: !isOpen, onInteractOutside: event => {
    if (!event.composedPath().includes(triggerRef.current)) setOpen(false);
  } });
  return <Select fullWidth isOpen={isOpen} onOpenChange={setOpen} value={value} onChange={key => key && onChange(String(key))} className="ep-style-select">
    <Label>{label}</Label>
    <Select.Trigger ref={triggerRef} onPressStart={event => {
      if (isOpen && event.pointerType !== 'touch' && event.pointerType !== 'keyboard') setOpen(false);
    }}><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover ref={popoverRef} isNonModal shouldCloseOnInteractOutside={target => !triggerRef.current?.contains(target)} UNSTABLE_portalContainer={portal} className="default ep-select-popover"><ListBox aria-label={label}>{options.map(option => { const title = option[0].toUpperCase() + option.slice(1); return <ListBox.Item key={option} id={option} textValue={title}>{title}<ListBox.ItemIndicator /></ListBox.Item>; })}</ListBox></Select.Popover>
  </Select>;
}

function Extension({ model, actions, portal }) {
  const [showNotes, setShowNotes] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [pendingDraft, setPendingDraft] = useState(null);
  const body = useRef(null);
  const context = model.pageContext || {};
  const company = context.companyName || context.companyDomain || 'this company';
  const personal = context.type === 'linkedin_person';
  const title = personal ? context.personName : context.jobTitle || company;
  const values = model.emailCustomize;
  const needsProfile = model.authenticated === true && model.account?.onboarding?.profile && !model.account.onboarding.profile.complete;
  const activeDraft = draftId && model.drafts.get(draftId);
  const activeContact = draftId && model.contacts.find((contact, index) => (contact.id || contact.linkedinUrl || String(index)) === draftId);
  const recipient = activeContact && (model.revealed.get(draftId) || activeContact.email);
  const page = model.searchSheetOpen ? activeDraft ? 'draft' : 'people' : 'home';
  const status = model.prompt || model.error;
  const postedTime = Date.parse(context.jobDatePosted || '');
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [page]);
  useEffect(() => { setDraftId(null); setPendingDraft(null); setCopyStatus(''); }, [context.sourceUrl]);
  const preparedDraft = pendingDraft && model.drafts.get(pendingDraft.id);
  useEffect(() => {
    if (preparedDraft && pendingDraft?.source === context.sourceUrl && model.searchSheetOpen) {
      setDraftId(pendingDraft.id); setPendingDraft(null); setCopyStatus('');
    }
  }, [preparedDraft, pendingDraft, context.sourceUrl, model.searchSheetOpen]);

  const change = (key, value) => actions.customize({ ...values, [key]: value });
  const back = () => { setDraftId(null); actions.showResults(false); };
  function editDraft(key, value) { setCopyStatus(''); actions.editDraft(draftId, { [key]: value }); }
  const actionButton = model.action?.url && <Button variant="secondary" onPress={() => actions.openUrl(model.action.url)}>{model.action.label || 'Open website'} <ArrowUpRight width={14} /></Button>;
  async function copy() { try { await navigator.clipboard.writeText(`${activeDraft.subject || ''}\n\n${activeDraft.body || ''}`); setCopyStatus('Copied to clipboard'); } catch { setCopyStatus('Select the message text to copy it.'); } }

  return <div className={`default ep-extension ${page !== 'home' ? 'ep-workspace' : ''}`} style={{'--ep-background-image': `url(${background})`}}>
    <div className="ep-scroll" ref={body}>
      {!model.pageContext ? <section className="ep-results"><EmptyState><EmptyState.Header><EmptyState.Title>{model.contextPending ? 'Reading this page…' : 'Find your next connection'}</EmptyState.Title><EmptyState.Description>{model.contextPending ? 'Looking for the current role or company.' : 'Open a job, company website, or LinkedIn profile to get started. If you just updated Reachard, refresh that page.'}</EmptyState.Description></EmptyState.Header></EmptyState></section> : page === 'home' ? <div>
        <section className="ep-role">
          <div className="ep-role-kicker"><span className="ep-small-label">{personal ? 'CURRENT PROFILE' : context.jobTitle ? 'CURRENT ROLE' : 'CURRENT COMPANY'}</span></div>
          <h2>{title || 'Your next connection starts here.'}</h2>
          <div className="ep-company"><span>{personal ? context.personTitle : company}</span></div>
          {!personal && context.jobSalary && <p className="ep-job-salary">{context.jobSalary}</p>}
          {!personal && Number.isFinite(postedTime) && <p className="ep-job-date">Posted {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(postedTime))}</p>}
          {context.sourceUrl && <Button variant="ghost" className="ep-job-link" onPress={() => actions.openUrl(context.sourceUrl)}>{personal ? 'View profile' : context.jobTitle ? 'View job' : 'View company'} <ArrowRight width={20} /></Button>}
          {!context.jobTitle && !personal && <label className="ep-manual-role">Optional role or ask<Input aria-label="Optional role or ask" placeholder="e.g. Software Engineer" value={model.manualJobTitle} onChange={event => actions.manualRole(event.target.value)} /></label>}
          <Button className="ep-search" isDisabled={!model.pageContext || model.accountLoading} onPress={() => model.authenticated === false ? actions.openUrl(model.action?.url || 'https://reachard.co/dashboard') : needsProfile ? actions.openUrl('https://reachard.co/onboarding') : model.loading || model.contacts.length ? actions.showResults(true) : actions.search()}>{model.accountLoading ? 'Connecting your account…' : model.authenticated === false ? 'Log In to Reachard' : needsProfile ? 'Finish your profile' : model.loading ? 'Finding people…' : model.contacts.length ? `View ${model.contacts.length} connections` : personal ? 'Prepare this contact' : 'Find people here'}<ArrowRight width={18} /></Button>
        </section>
        <section className="ep-approach" aria-label="Message preferences">
          <div className="ep-section-heading"><h3>Make it personal</h3><p>Message style</p></div>
          <Segment aria-label="Message goal" selectedKey={values.goal} onSelectionChange={key => change('goal', String(key))} size="lg" className="ep-goals">{goals.map(([id, label, Icon]) => <Segment.Item key={id} id={id}><Icon width={20} />{label}</Segment.Item>)}</Segment>
          <div className="ep-style-fields"><StyleSelect label="Tone" value={values.tone} options={['warm','direct','formal','confident']} onChange={value => change('tone', value)} portal={portal} /><StyleSelect label="Length" value={values.length} options={['short','concise','detailed']} onChange={value => change('length', value)} portal={portal} /></div>
          <div className="ep-context-row"><Button variant="ghost" className="ep-add-note" aria-expanded={showNotes} onPress={() => setShowNotes(!showNotes)}><Plus width={19} />{showNotes ? 'Hide context' : values.notes ? 'Edit context' : 'Add context'}</Button></div>
          {showNotes && <TextArea aria-label="Personal context" maxLength={500} placeholder="A shared interest, a project, a reason to reach out…" value={values.notes} onChange={event => change('notes', event.target.value)} onBlur={actions.save} rows={3} className="ep-note-input" />}
          {model.customizeError && <div role="alert" className="ep-error"><p>{model.customizeError}</p><Button variant="ghost" onPress={actions.save}>Retry</Button></div>}
          {model.accountError && <div role="alert" className="ep-error"><p>{model.accountError}</p>{actionButton}</div>}
        </section>
      </div> : page === 'draft' ? <section className="ep-draft">
        <Button variant="ghost" className="ep-back" onPress={() => { setDraftId(null); setCopyStatus(''); }}><ArrowLeft width={15} />All contacts</Button>
        <div className="ep-compose-heading"><h2>Email draft</h2><Chip size="sm" variant="soft">Not sent</Chip></div>
        <p className="ep-draft-guidance">Review and edit your message below.</p>
        <div className="ep-compose">
          <div className="ep-recipient"><span>To</span><div><strong>{activeContact?.name || 'Contact'}</strong><span>{recipient || 'Email unavailable'}</span></div></div>
          <label className="ep-compose-subject"><span>Subject</span><Input aria-label="Email subject" value={activeDraft.subject || ''} onChange={event => editDraft('subject', event.target.value)} /></label>
          <label className="ep-compose-body"><span>Message</span><TextArea aria-label="Email message" value={activeDraft.body || ''} onChange={event => editDraft('body', event.target.value)} rows={12} /></label>
        </div>
        {activeDraft.personalizationNotes?.length > 0 && <details className="ep-draft-details"><summary>Personalization details</summary><p>{activeDraft.personalizationNotes.join(' · ')}</p></details>}
        {['missingContext','warnings'].map(key => activeDraft[key]?.length ? <div className="ep-draft-explanation" key={key}><strong>{key === 'missingContext' ? 'Missing context' : 'Before sending'}</strong><p>{activeDraft[key].join(' · ')}</p></div> : null)}
        {activeDraft.ai?.provider === 'template' && <p className="ep-error">AI was unavailable. This draft uses a template.</p>}
      </section> : <section className="ep-results">
        <Button variant="ghost" className="ep-back" onPress={back}><ArrowLeft width={16} />{personal ? 'Back to profile' : context.jobTitle ? 'Back to role' : 'Back to company'}</Button>
        <div className="ep-results-heading"><h2>People to contact</h2>{!model.loading && <Chip size="sm" color="accent" variant="soft">{model.contacts.length}</Chip>}</div>
        <p className="ep-results-company">{company}</p>
        {context.jobTitle && <p className="ep-results-role">{context.jobTitle}</p>}
        {model.loading ? <div className="ep-loading" role="status"><Spinner size="lg" /><p>Looking for people connected to this role.</p></div> : <>
          {status && <div role="alert" className="ep-error"><p>{status}</p>{actionButton}</div>}
          {!model.contacts.length && !status && <EmptyState><EmptyState.Header><EmptyState.Title>No close matches yet.</EmptyState.Title><EmptyState.Description>Try adjusting the role or exploring another company.</EmptyState.Description></EmptyState.Header><EmptyState.Content><Button onPress={back}>Back to this role</Button></EmptyState.Content></EmptyState>}
          {model.contacts.map((contact, index) => {
            const id = contact.id || contact.linkedinUrl || String(index);
            const email = model.revealed.get(id) || contact.email;
            const draft = model.drafts.get(id);
            const busy = model.revealing.has(id) || model.drafting.has(id);
            const name = contact.name || 'Relevant contact';
            const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
            const usefulReasons = (contact.reasons || []).filter(reason => !/^(Company match|Verified company domain|Matched the provider's current-company filter|(?:Senior IC|Manager|Director|Head|VP|C-suite|Founder) fit)$/i.test(reason));
            return <Card className="ep-person" key={id} aria-label={name}>
              <Card.Header className="ep-person-header">
                <Avatar size="sm" color="accent" variant="soft" className="ep-person-avatar" aria-hidden="true"><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
                <div className="ep-person-identity"><Card.Title>{name}</Card.Title><Card.Description>{contact.title || 'Company contact'}</Card.Description></div>
                {/^https?:\/\//i.test(contact.linkedinUrl || '') && <Tooltip><Button isIconOnly variant="ghost" size="sm" aria-label={`View ${name} on LinkedIn`} onPress={() => actions.openUrl(contact.linkedinUrl)}><ArrowUpRight width={16} /></Button><Tooltip.Content UNSTABLE_portalContainer={portal}>View LinkedIn profile</Tooltip.Content></Tooltip>}
              </Card.Header>
              <Card.Content className="ep-person-content">
                {contact.location && <p className="ep-person-location"><MapPin width={13} />{contact.location}</p>}
                {contact.education && <p className="ep-person-education">{contact.education}</p>}
                <p className="ep-person-match">{usefulReasons[0] || 'Company contact'}</p>
                {usefulReasons.length > 1 && <details className="ep-person-more"><summary>More connections</summary>{usefulReasons.slice(1).map((reason, reasonIndex) => <p key={reasonIndex}>{reason}</p>)}</details>}
                {email && <div className="ep-revealed"><span><Check width={14} />{email}</span></div>}
              </Card.Content>
              <Card.Footer className="ep-person-footer"><Button variant="secondary" size="sm" className="ep-reveal" isPending={busy} isDisabled={busy} onPress={() => { setCopyStatus(''); if (draft) { setDraftId(id); return; } setPendingDraft({id, source:context.sourceUrl}); if (email) void actions.draft(id); else void actions.reveal(id); }}>{busy ? <Spinner size="sm" color="current" /> : draft ? <PaperPlane width={16} /> : <Envelope width={16} />}{busy ? model.drafting.has(id) ? 'Writing your draft…' : 'Finding email…' : draft ? 'Open draft' : email ? 'Write email' : 'Get email & draft'}</Button></Card.Footer>
            </Card>;
          })}
        </>}
      </section>}
    </div>
    {page === 'draft' && <footer className="ep-compose-actions"><p role="status">{copyStatus || 'Opens your email app. You choose when to send.'}</p><div><Button variant="secondary" onPress={copy}><Copy width={16} />Copy</Button><Button isDisabled={!recipient} onPress={() => actions.openMail(draftId)}>Open in email app <ArrowUpRight width={16} /></Button></div></footer>}
  </div>;
}

window.ReachardUI = {
  render(host, model, actions) {
    let entry = roots.get(host);
    if (!entry) {
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style'); style.textContent = styles;
      const mount = document.createElement('div'); mount.className = 'reachard-ui-mount';
      const portal = document.createElement('div'); portal.className = 'default ep-portals';
      shadow.append(style, mount, portal);
      entry = { root: createRoot(mount), portal }; roots.set(host, entry);
    }
    entry.root.render(<I18nProvider locale="en-US"><Extension model={model} actions={actions} portal={entry.portal} /></I18nProvider>);
  },
  unmount(host) { const entry = roots.get(host); if (entry) { entry.root.unmount(); roots.delete(host); } }
};
