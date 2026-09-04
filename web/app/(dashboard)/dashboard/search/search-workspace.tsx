'use client';

import { Avatar, Button, Card, Chip, Input, Label, Modal, Tabs, TextArea, TextField, Toast, toast } from '@heroui/react';
import { ArrowLeft, ArrowUpRight, Bookmark, Building2, Check, ChevronRight, Copy, FileText, Globe, Mail, Plus, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { PreferenceOptions } from '@/components/ui/profile-controls';
import { Brand, ThemeSwitch } from '@/components/reachard/design';

type Opportunity = { id: string; company: string; role: string; status?: 'Saved' | 'Researching' | 'Ready' };
type Person = { id: string; name: string; role: string; category: string; photo: string; signal: string; reason: string; question: string };
type Draft = { id: string; name: string; company: string; text: string; subject: string };
const startingOpportunities: Opportunity[] = [
  { id: 'stripe', company: 'Stripe', role: 'Product Designer', status: 'Researching' },
  { id: 'notion', company: 'Notion', role: 'Product Designer', status: 'Ready' },
  { id: 'airbnb', company: 'Airbnb', role: 'Design Engineer', status: 'Saved' }
];
const peopleByCompany: Record<string, Person[]> = {
  stripe: [
    { id: 'maya', name: 'Maya Chen', role: 'Product Design Lead', category: 'Team', photo: 'maya-chen', signal: 'Closest to the team', reason: 'Leads the design discipline this role would join. A useful first perspective on the team’s priorities and the kind of ownership a new designer could take.', question: 'What is one challenge you would want a new designer to be excited about?' },
    { id: 'marcus', name: 'Marcus Johnson', role: 'Design Recruiter', category: 'Recruiters', photo: 'marcus-johnson', signal: 'Hiring process context', reason: 'A recruiting perspective can help clarify the interview process, timing, and how to present relevant work.', question: 'What does the team most want to see in a designer’s portfolio for this role?' },
    { id: 'priya', name: 'Priya Raman', role: 'Product Design Manager', category: 'Team', photo: 'priya-raman', signal: 'A peer perspective', reason: 'A manager in the design organization can offer perspective on collaboration, product decisions, and the day-to-day work.', question: 'How does the design team balance systems thinking with hands-on product craft?' }
  ],
  notion: [
    { id: 'priya-notion', name: 'Priya Raman', role: 'Product Design Manager', category: 'Team', photo: 'priya-raman', signal: 'Product team perspective', reason: 'This sample contact illustrates a route into understanding the product team’s working style.', question: 'What kind of product ambiguity does this team find most interesting right now?' }
  ],
  airbnb: []
};
const storageKey = 'reachard-studio-preview-v1';
function setNotice(message: string) { toast(message, { timeout: 5000 }); }

export function ContactWorkspace() {
  const [opportunities, setOpportunities] = useState(startingOpportunities);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeId, setActiveId] = useState('stripe');
  const [selectedId, setSelectedId] = useState('maya');
  const [view, setView] = useState<'people' | 'saved' | 'drafts'>('people');
  const [filter, setFilter] = useState('All people');
  const [saved, setSaved] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [ready, setReady] = useState(false);
  const [companyQuery, setCompanyQuery] = useState('Stripe');
  const [roleQuery, setRoleQuery] = useState('Product Designer');
  const [newOpen, setNewOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [subject, setSubject] = useState('');
  const [draftIdentity, setDraftIdentity] = useState({ id: '', name: '', company: '' });
  const [tone, setTone] = useState<'Thoughtful' | 'Concise'>('Thoughtful');
  const opportunity = opportunities.find(item => item.id === activeId) ?? opportunities[0];
  const allPeople = peopleByCompany[opportunity.company.toLowerCase()] ?? [];
  const filteredPeople = allPeople.filter(person => (filter === 'All people' || person.category === filter) && (view !== 'saved' || saved.includes(person.id)));
  const selected = filteredPeople.find(person => person.id === selectedId) ?? filteredPeople[0];

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (raw) {
        if (Array.isArray(raw.saved) && raw.saved.every((v: unknown) => typeof v === 'string')) setSaved(raw.saved);
        if (Array.isArray(raw.drafts) && raw.drafts.every((v: Draft) => v && typeof v.id === 'string' && typeof v.text === 'string' && typeof v.name === 'string' && typeof v.company === 'string' && typeof v.subject === 'string')) setDrafts(raw.drafts);
        if (Array.isArray(raw.opportunities) && raw.opportunities.length && raw.opportunities.every((v: Opportunity) => v && typeof v.id === 'string' && typeof v.company === 'string' && typeof v.role === 'string')) setOpportunities(raw.opportunities);
      }
    } catch { /* A broken browser cache should not prevent a preview. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ opportunities, saved, drafts })); }
    catch { setNotice('Browser storage is unavailable. Changes will last for this visit.'); }
  }, [opportunities, saved, drafts, ready]);

  function selectOpportunity(item: Opportunity) {
    setActiveId(item.id); setCompanyQuery(item.company); setRoleQuery(item.role); setFilter('All people'); setView('people'); setSelectedId('');
  }
  function markReady() {
    const status = opportunity.status === 'Ready' ? 'Researching' : 'Ready';
    setOpportunities(items => items.map(item => item.id === opportunity.id ? { ...item, status } : item));
    setNotice(status === 'Ready' ? 'Opportunity marked ready.' : 'Moved back to research.');
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const company = companyQuery.trim();
    if (!company) return;
    const existing = opportunities.find(item => item.company.toLowerCase() === company.toLowerCase() && item.role.toLowerCase() === roleQuery.trim().toLowerCase());
    const next = existing ?? { id: crypto.randomUUID(), company, role: roleQuery.trim() || 'Explore the team' };
    if (!existing) setOpportunities(items => [...items, next]);
    selectOpportunity(next);
    setNotice(peopleByCompany[company.toLowerCase()]?.length ? `Showing example people for ${company}.` : `Saved ${company}. This preview has no live search results.`);
  }
  function addOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const company = String(data.get('company') || '').trim();
    if (!company) return;
    const item = { id: crypto.randomUUID(), company, role: String(data.get('role') || '').trim() || 'Explore the team' };
    setOpportunities(items => [...items, item]); selectOpportunity(item); setNewOpen(false); setNotice('Opportunity saved in this browser.');
  }
  function toggleSave(person: Person) {
    const alreadySaved = saved.includes(person.id);
    setSaved(items => alreadySaved ? items.filter(id => id !== person.id) : [...items, person.id]);
    setNotice(alreadySaved ? 'Person removed from saved.' : `${person.name} saved.`);
  }
  function makeDraft(person: Person, style: 'Thoughtful' | 'Concise') {
    return style === 'Concise'
      ? `Hi ${person.name.split(' ')[0]},\n\nI'm interested in ${opportunity.role} opportunities at ${opportunity.company}. ${person.question}\n\nThanks for your time.`
      : `Hi ${person.name.split(' ')[0]},\n\nI'm exploring the ${opportunity.role} opportunity at ${opportunity.company} and would love to understand the team beyond the job description.\n\n${person.question}\n\nI know your time is valuable, so even a brief perspective would mean a lot.\n\nThank you.`;
  }
  function openComposer() {
    if (!selected) return;
    setDraftIdentity({ id: `${opportunity.id}:${selected.id}`, name: selected.name, company: opportunity.company });
    setSubject(`A question about ${opportunity.role.toLowerCase()} at ${opportunity.company}`);
    setTone('Thoughtful'); setDraftText(makeDraft(selected, 'Thoughtful')); setComposerOpen(true);
  }
  function changeTone(style: 'Thoughtful' | 'Concise') {
    setTone(style);
    if (selected && draftIdentity.id === `${opportunity.id}:${selected.id}`) setDraftText(makeDraft(selected, style));
  }
  function saveDraft() {
    const draft = { ...draftIdentity, text: draftText, subject };
    setDrafts(items => [...items.filter(item => item.id !== draft.id), draft]); setNotice('Draft saved in this browser.'); setComposerOpen(false);
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(`${subject}\n\n${draftText}`); setNotice('Message copied. Ready for your email app.'); }
    catch { setNotice('Clipboard unavailable. Select and copy the message text.'); }
  }

  return <div className="hu-workspace" data-sidebar-collapsed={sidebarCollapsed || undefined}>
    <aside className="hu-sidebar"><Brand />
      <nav aria-label="Workspace sections">
        <Button fullWidth variant={view === 'people' ? 'secondary' : 'ghost'} onPress={() => { setView('people'); setFilter('All people'); }}><Search size={18} />Find people</Button>
        <Button fullWidth variant={view === 'saved' ? 'secondary' : 'ghost'} onPress={() => { setView('saved'); setFilter('All people'); }}><Bookmark size={18} />Saved people{saved.length > 0 && <Chip size="sm" variant="soft">{saved.length}</Chip>}</Button>
        <Button fullWidth variant={view === 'drafts' ? 'secondary' : 'ghost'} onPress={() => setView('drafts')}><FileText size={18} />Drafts{drafts.length > 0 && <Chip size="sm" variant="soft">{drafts.length}</Chip>}</Button>
      </nav>
      <div className="hu-side-heading"><span>Opportunities</span><Button isIconOnly size="sm" variant="ghost" aria-label="Add opportunity" onPress={() => setNewOpen(true)}><Plus size={16} /></Button></div>
      <div className="hu-opportunities">{opportunities.map(item => <Button key={item.id} fullWidth variant={item.id === activeId ? 'secondary' : 'ghost'} onPress={() => selectOpportunity(item)}><Building2 size={18} /><span><strong>{item.company}</strong><small>{item.role}</small></span></Button>)}</div>
      <div className="hu-sidebar-bottom"><Avatar><Avatar.Fallback><Users size={18} /></Avatar.Fallback></Avatar><span>Your workspace<small>Private beta</small></span><ThemeSwitch /></div>
    </aside>
    <div className="hu-content">
      <header className="hu-toolbar"><div><Button isIconOnly variant="ghost" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onPress={() => setSidebarCollapsed(value => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</Button><Link href="/">Reachard</Link><ChevronRight size={15}/><span>{view === 'drafts' ? 'Drafts' : 'Find people'}</span></div><div><span className="hu-mobile-theme"><ThemeSwitch /></span><Button variant="secondary" onPress={() => setNewOpen(true)}><Plus size={17} />New opportunity</Button></div></header>
      <main className="hu-main">
        <div className="hu-page-heading"><div><h1>{view === 'drafts' ? 'Your drafts' : view === 'saved' ? 'Your shortlist' : 'Who’s your next conversation?'}</h1><p>{view === 'drafts' ? 'Thoughtful introductions, ready when you are.' : view === 'saved' ? 'People you want to come back to.' : 'Find the people who can bring an opportunity into focus.'}</p></div><div className="flex flex-wrap items-center gap-2"><Chip variant="soft" size="sm">Example workspace</Chip><Button size="sm" variant="secondary" onPress={markReady} aria-label={opportunity.status === 'Ready' ? 'Move back to research' : 'Mark opportunity ready'}>{opportunity.status || 'Researching'}<Check size={14}/></Button></div></div>
        {view !== 'drafts' ? <>
          <Card className="hu-search-card"><Card.Content><form onSubmit={search} className="hu-search-form"><TextField isRequired fullWidth><Label>Company</Label><Input value={companyQuery} onChange={e => setCompanyQuery(e.target.value)} placeholder="Search a company" required /></TextField><TextField fullWidth><Label>Role or interest <span className="hu-optional">Optional</span></Label><Input value={roleQuery} onChange={e => setRoleQuery(e.target.value)} placeholder="e.g. Product Designer" /></TextField><Button type="submit" variant="primary" size="lg"><Search size={18}/>Find people</Button></form></Card.Content></Card>
          <div className="hu-results-layout">
            <div className="hu-people-column">
              <div className="hu-results-heading"><h2>{view === 'saved' ? 'Saved people' : 'Recommended people'}</h2><span>{filteredPeople.length} results</span></div>
              <Tabs selectedKey={filter} onSelectionChange={key => setFilter(String(key))}>
                <Tabs.ListContainer><Tabs.List aria-label="Filter people">{['All people','Team','Recruiters'].map(value => <Tabs.Tab key={value} id={value}>{value}<Tabs.Indicator /></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
                {['All people','Team','Recruiters'].map(value => <Tabs.Panel key={value} id={value}>
                  <div className="hu-person-list">{filteredPeople.map(person => <Card key={person.id} className="hu-person-card" data-selected={selected?.id === person.id || undefined}>
                    <Card.Content className="hu-person-content"><Button variant="ghost" className="hu-person-select" onClick={() => setSelectedId(person.id)} aria-pressed={selected?.id === person.id}><Avatar size="lg"><Avatar.Image src={`/images/workspace/${person.photo}.png`} alt="" /><Avatar.Fallback>{person.name.charAt(0)}</Avatar.Fallback></Avatar><span><strong>{person.name}</strong><small>{person.role}</small></span></Button><Button isIconOnly variant="ghost" aria-label={`${saved.includes(person.id) ? 'Unsave' : 'Save'} ${person.name}`} onPress={() => toggleSave(person)}><Bookmark size={18} fill={saved.includes(person.id) ? 'currentColor' : 'none'}/></Button></Card.Content>
                    <Card.Footer className="hu-person-footer"><Chip variant="soft" color={selected?.id === person.id ? 'accent' : 'default'} size="sm">{person.signal}</Chip><span>{opportunity.company}</span>{selected?.id === person.id && <Check size={16} />}</Card.Footer>
                  </Card>)}</div>
                  {!filteredPeople.length && <Card><Card.Content><div className="hu-empty"><Search size={30}/><h3>{view === 'saved' ? 'Your shortlist starts here.' : 'A new place to begin.'}</h3><p>{view === 'saved' ? 'Save a person to keep them close.' : 'This company has no example contacts. Try Stripe to explore the preview.'}</p><Button variant="secondary" onPress={() => selectOpportunity(startingOpportunities[0])}>Explore Stripe example<ArrowUpRight size={16}/></Button></div></Card.Content></Card>}
                </Tabs.Panel>)}
              </Tabs>
              <p className="hu-example-note">Example people for exploring the experience. Live search isn’t connected.</p>
            </div>
            {selected ? <Card className="hu-profile-card"><Card.Header><div className="hu-profile-top"><Avatar size="lg" className="hu-profile-avatar"><Avatar.Image src={`/images/workspace/${selected.photo}.png`} alt={selected.name}/><Avatar.Fallback>{selected.name.charAt(0)}</Avatar.Fallback></Avatar><Chip size="sm" variant="soft">Your next connection</Chip></div><Card.Title>{selected.name}</Card.Title><Card.Description>{selected.role} at {opportunity.company}</Card.Description></Card.Header><Card.Content><div className="hu-context-block"><span><Sparkles size={16}/>Why this person</span><p>{selected.reason}</p></div><div className="hu-question-block"><span>A good first question</span><p>“{selected.question}”</p></div></Card.Content><Card.Footer className="hu-profile-footer"><Button fullWidth size="lg" variant="primary" onPress={openComposer}><Mail size={18}/>Draft an introduction</Button><small>You decide what to say and when to send.</small></Card.Footer></Card> : <Card><Card.Content><div className="hu-empty"><Users size={32}/><p>Choose someone to see the context behind your next conversation.</p></div></Card.Content></Card>}
          </div>
        </> : <div className="hu-drafts">{drafts.length ? drafts.map(draft => <Card key={draft.id}><Card.Header><Card.Title>{draft.subject}</Card.Title><Card.Description>To {draft.name} · {draft.company}</Card.Description></Card.Header><Card.Content><p>{draft.text.slice(0,155)}…</p></Card.Content><Card.Footer><Button variant="secondary" onPress={() => { setDraftIdentity({id:draft.id,name:draft.name,company:draft.company});setDraftText(draft.text);setSubject(draft.subject);setComposerOpen(true);}}>Edit draft<ArrowUpRight size={16}/></Button></Card.Footer></Card>) : <Card><Card.Content><div className="hu-empty"><FileText size={32}/><h3>One good introduction.</h3><p>Choose a person, make the message yours, and save it here.</p><Button variant="primary" onPress={() => setView('people')}>Find people</Button></div></Card.Content></Card>}</div>}
        <footer className="hu-footer"><span>Good connections start with context.</span><Link href="/sign-up">Create your account <ArrowUpRight size={14}/></Link></footer>
      </main>
    </div>
    <Modal isOpen={newOpen} onOpenChange={setNewOpen}><Modal.Backdrop><Modal.Container size="md"><Modal.Dialog className="rd-modal"><Modal.Header><Modal.Heading>A new possibility.</Modal.Heading><Modal.CloseTrigger aria-label="Close new opportunity" /></Modal.Header><Modal.Body className="space-y-4"><p className="rd-modal-description">A company you are curious about. A role you can see yourself in.</p><form className="space-y-4" id="new-opportunity-form" onSubmit={addOpportunity}><TextField isRequired><Label>Company</Label><Input name="company" placeholder="e.g. Figma" required autoFocus /></TextField><TextField><Label>Role or interest · optional</Label><Input name="role" placeholder="e.g. Product Designer" /></TextField></form></Modal.Body><Modal.Footer><Button variant="ghost" onPress={() => setNewOpen(false)}>Cancel</Button><Button variant="primary" type="submit" form="new-opportunity-form">Add opportunity<Plus size={14} /></Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
    <Modal isOpen={composerOpen} onOpenChange={setComposerOpen}><Modal.Backdrop><Modal.Container size="lg"><Modal.Dialog className="rd-modal"><Modal.Header><div><p className="rd-overline" style={{ marginBottom: 8 }}>ONE THOUGHTFUL INTRODUCTION</p><Modal.Heading>Start the conversation.</Modal.Heading></div><Modal.CloseTrigger aria-label="Close draft" /></Modal.Header><Modal.Body className="space-y-4"><div className="rd-composer-to"><span>To</span><strong>{draftIdentity.name}</strong><span>· {draftIdentity.company}</span></div><PreferenceOptions label="Message tone" value={tone} onChange={value => changeTone(value as 'Thoughtful' | 'Concise')} options={[["Thoughtful", "Thoughtful"], ["Concise", "Concise"]]} isDisabled={!selected || draftIdentity.id !== `${opportunity.id}:${selected.id}`} /><TextField><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></TextField><TextField><Label>Your message</Label><TextArea rows={8} value={draftText} onChange={e => setDraftText(e.target.value)} /></TextField><p className="rd-modal-description" style={{ margin: 0 }}>An example starting point. Make it yours before sending.</p></Modal.Body><Modal.Footer><Button variant="secondary" onPress={() => void copyDraft()}><Copy size={14} />Copy message</Button><Button variant="primary" onPress={saveDraft}><Check size={14} />Save draft</Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
    <Toast.Provider placement="bottom" />
  </div>;
}
