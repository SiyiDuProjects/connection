'use client';

import { Avatar, Button, Card, Chip, Input, Label, TextField } from '@heroui/react';
import { ArrowRight, Check, CheckCircle2, Copy, FileText, PanelLeftClose, PanelLeftOpen, Plus, Search, Sparkles, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

type Opportunity = { id: string; company: string; role: string; location: string; status: 'Saved' | 'Researching' | 'Ready' };
type Contact = { id: string; name: string; role: string; avatar: string; route: string; reason: string; ask: string; confidence: number };

const initialOpportunities: Opportunity[] = [
  { id: 'stripe', company: 'Stripe', role: 'Senior Product Designer', location: 'San Francisco, CA', status: 'Researching' },
  { id: 'notion', company: 'Notion', role: 'Product Designer', location: 'San Francisco, CA', status: 'Ready' },
  { id: 'airbnb', company: 'Airbnb', role: 'Product Designer, AI', location: 'San Francisco, CA', status: 'Saved' }
];

const contacts: Contact[] = [
  { id: 'maya', name: 'Maya Chen', role: 'Product Design Lead', avatar: '/images/workspace/maya-chen.png', route: 'Hiring context', reason: 'Closest to the team mandate and the portfolio bar for this role.', ask: 'What part of the role is hardest to understand from the outside?', confidence: 94 },
  { id: 'marcus', name: 'Marcus Johnson', role: 'Design Recruiter', avatar: '/images/workspace/marcus-johnson.png', route: 'Process signal', reason: 'Best path for timing, interview structure, and whether the search is active.', ask: 'Is the team still prioritizing systems-thinking experience for this search?', confidence: 88 },
  { id: 'priya', name: 'Priya Raman', role: 'Product Design Manager', avatar: '/images/workspace/priya-raman.png', route: 'Peer perspective', reason: 'A lower-pressure route to learn how product design decisions are made.', ask: 'Which portfolio decisions best signal judgment and ownership on the team?', confidence: 84 }
];

export function ContactWorkspace() {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [activeOpportunityId, setActiveOpportunityId] = useState('stripe');
  const [selectedContactId, setSelectedContactId] = useState('maya');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const opportunity = opportunities.find((item) => item.id === activeOpportunityId) ?? opportunities[0];
  const contact = contacts.find((item) => item.id === selectedContactId) ?? contacts[0];

  function selectOpportunity(id: string) { setActiveOpportunityId(id); setSelectedContactId('maya'); setNotice(''); }
  function markReady() {
    setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, status: item.status === 'Ready' ? 'Researching' : 'Ready' } : item));
    setNotice(opportunity.status === 'Ready' ? 'Moved back to research.' : 'Opportunity marked ready.');
  }
  function addOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company.trim() || !role.trim()) { setNotice('Add a company and role first.'); return; }
    const id = `${company}-${role}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    setOpportunities((current) => [...current, { id, company: company.trim(), role: role.trim(), location: 'Location to confirm', status: 'Saved' }]);
    setActiveOpportunityId(id); setSelectedContactId('maya'); setCompany(''); setRole(''); setNewOpen(false); setNotice('Opportunity added to this local preview.');
  }
  async function copyDraft() { await navigator.clipboard.writeText(draftText(contact, opportunity)); setCopied(true); }

  return (
    <div className={`min-h-[100dvh] bg-[#f4f4f6] text-[#18181b] lg:grid ${sidebarCollapsed ? 'lg:grid-cols-[84px_minmax(0,1fr)]' : 'lg:grid-cols-[282px_minmax(0,1fr)]'}`}>
      <aside className="border-b border-black/[0.08] bg-[#ebebee] lg:sticky lg:top-0 lg:h-[100dvh] lg:border-b-0 lg:border-r">
        <div className="flex h-[76px] items-center justify-between px-5">
          <button type="button" onClick={() => selectOpportunity(opportunity.id)} className={`flex items-center gap-3 rounded-[12px] p-1.5 transition-colors hover:bg-white/55 ${sidebarCollapsed ? 'mx-auto' : ''}`}>
            <img src="/images/brand/reachard-logo-mark.png" alt="Reachard" className="size-9 object-contain" />
            {!sidebarCollapsed ? <span className="text-[17px] font-semibold tracking-[-0.035em]">Reachard</span> : null}
          </button>
          {!sidebarCollapsed ? <Button isIconOnly variant="ghost" size="sm" onPress={() => setSidebarCollapsed(true)} className="hidden lg:inline-flex" aria-label="Collapse sidebar"><PanelLeftClose className="size-4" /></Button> : null}
        </div>

        <div className="flex gap-3 overflow-x-auto px-4 pb-4 lg:block lg:overflow-visible lg:pb-0">
          {!sidebarCollapsed ? <div className="mb-3 hidden items-center justify-between px-2 pt-6 lg:flex"><span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#85878d]">Opportunities</span><Button isIconOnly variant="ghost" size="sm" onPress={() => setNewOpen(true)} aria-label="Add opportunity"><Plus className="size-4" /></Button></div> : null}
          {opportunities.map((item) => (
            <button key={item.id} type="button" onClick={() => selectOpportunity(item.id)} title={sidebarCollapsed ? item.company : undefined} className={`flex shrink-0 items-center rounded-[14px] border text-left transition-all lg:mb-2 lg:w-full ${sidebarCollapsed ? 'h-12 justify-center border-transparent px-2' : 'min-w-[220px] gap-3 border-transparent px-3 py-3 lg:min-w-0'} ${activeOpportunityId === item.id ? 'border-white bg-white shadow-[0_8px_26px_rgb(24_24_27_/_0.07)]' : 'hover:bg-white/55'}`}>
              <CompanyMark company={item.company} />
              {!sidebarCollapsed ? <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-semibold">{item.company}</strong><span className="mt-1 block truncate text-[11px] text-[#7c7e84]">{item.role}</span></span> : null}
              {!sidebarCollapsed ? <StatusDot status={item.status} /> : null}
            </button>
          ))}
        </div>

        <div className="hidden lg:absolute lg:inset-x-0 lg:bottom-0 lg:block lg:p-4">
          {sidebarCollapsed ? <Button fullWidth variant="ghost" onPress={() => setSidebarCollapsed(false)} aria-label="Expand sidebar"><PanelLeftOpen className="size-4" /></Button> : null}
          <div className={`mt-2 flex items-center rounded-[14px] py-2 ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-2'}`}><Avatar color="success"><Avatar.Fallback>SD</Avatar.Fallback></Avatar>{!sidebarCollapsed ? <span><strong className="block text-[13px] font-medium">Siyi Du</strong><span className="mt-0.5 block text-[11px] text-[#85878d]">Berkeley · 2027</span></span> : null}</div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-black/[0.07] bg-[#f4f4f6]/88 px-5 backdrop-blur-2xl sm:px-8">
          <div className="flex min-w-0 items-center gap-2 text-[13px]"><span className="text-[#85878d]">Workspace</span><span className="text-[#bbbcc1]">/</span><span className="truncate font-medium">{opportunity.company}</span></div>
          <Button variant="secondary" onPress={() => setNewOpen(true)}><Plus className="size-4" />New opportunity</Button>
        </header>

        {notice ? <div className="fixed right-5 top-[92px] z-40 flex max-w-[360px] items-center gap-3 rounded-[14px] border border-black/[0.08] bg-white px-4 py-3 text-[13px] text-[#356047] shadow-[0_18px_50px_rgb(24_24_27_/_0.13)]"><CheckCircle2 className="size-4 shrink-0 text-[#16845b]" /><span className="flex-1">{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X className="size-4" /></button></div> : null}

        <main className="mx-auto w-full max-w-[1240px] px-5 py-9 sm:px-8 lg:py-12">
          <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0"><div className="mb-4 flex items-center gap-3"><CompanyMark company={opportunity.company} large /><span className="text-[13px] font-medium text-[#73757b]">{opportunity.company} · {opportunity.location}</span></div><h1 className="text-[clamp(34px,4vw,52px)] font-semibold leading-[0.98] tracking-[-0.052em]">{opportunity.role}</h1></div>
            <Button variant="secondary" onPress={markReady} className="self-start sm:self-auto"><span className={`size-2 rounded-full ${opportunity.status === 'Ready' ? 'bg-[#16845b]' : opportunity.status === 'Researching' ? 'bg-[#d18a36]' : 'bg-[#a1a1aa]'}`} />{opportunity.status}</Button>
          </section>

          <Card className="mt-8 p-0" variant="secondary"><Card.Content className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div className="max-w-[720px]"><p className="reachard-eyebrow">Best next move</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em]">Confirm the role mandate before you apply.</h2><p className="mt-2 text-[14px] leading-6 text-[#6c6e74]">Start with {contact.name}. One specific question should tell you whether this opportunity deserves more time.</p></div><Button variant="primary" size="lg" onPress={() => { setDraftOpen(true); setCopied(false); }}><Sparkles className="size-4" />Draft message</Button></Card.Content></Card>

          <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
            <Card className="p-0" variant="default"><Card.Header className="border-b border-black/[0.07] px-6 py-5"><Card.Title className="text-[17px]">Recommended people</Card.Title><Card.Description className="mt-1">Choose the route that answers your biggest unknown.</Card.Description></Card.Header><Card.Content className="p-2">
              {contacts.map((item) => <button key={item.id} type="button" onClick={() => setSelectedContactId(item.id)} className={`flex w-full items-center gap-4 rounded-[16px] px-4 py-4 text-left transition-colors ${selectedContactId === item.id ? 'bg-[#eef5f1]' : 'hover:bg-[#f5f5f6]'}`}><Avatar size="lg"><Avatar.Image src={item.avatar} alt={item.name} /><Avatar.Fallback>{item.name.slice(0, 1)}</Avatar.Fallback></Avatar><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-[14px] font-semibold">{item.name}</strong>{selectedContactId === item.id ? <Chip size="sm" color="success" variant="soft">Selected</Chip> : null}</span><span className="mt-1 block truncate text-[12px] text-[#777980]">{item.role} · {item.route}</span></span><span className="text-[13px] font-semibold text-[#16845b]">{item.confidence}</span></button>)}
            </Card.Content></Card>

            <Card className="p-0" variant="default"><Card.Content className="flex h-full flex-col p-6"><div className="flex items-center gap-4"><Avatar size="lg"><Avatar.Image src={contact.avatar} alt={contact.name} /><Avatar.Fallback>{contact.name.slice(0, 1)}</Avatar.Fallback></Avatar><div className="min-w-0"><h2 className="truncate text-[17px] font-semibold">{contact.name}</h2><p className="mt-1 truncate text-[12px] text-[#777980]">{contact.role}</p></div></div><dl className="mt-7 space-y-6"><div><dt className="reachard-eyebrow">Why this person</dt><dd className="mt-2 text-[14px] leading-6 text-[#606269]">{contact.reason}</dd></div><div className="border-t border-black/[0.07] pt-6"><dt className="reachard-eyebrow">What to ask</dt><dd className="mt-2 text-[14px] font-medium leading-6">“{contact.ask}”</dd></div></dl><Button variant="secondary" className="mt-auto pt-6" onPress={() => { setDraftOpen(true); setCopied(false); }}><FileText className="size-4" />Open draft</Button></Card.Content></Card>
          </section>
          <div className="mt-5 flex items-center justify-between text-[11px] text-[#8c8e94]"><span>Static local preview</span><span>No data is sent</span></div>
        </main>
      </div>

      {draftOpen ? <DraftDrawer contact={contact} opportunity={opportunity} copied={copied} onCopy={() => void copyDraft()} onClose={() => setDraftOpen(false)} onSave={() => { setDraftOpen(false); setNotice('Draft saved in this preview.'); }} /> : null}
      {newOpen ? <NewOpportunityDialog company={company} role={role} onCompany={setCompany} onRole={setRole} onSubmit={addOpportunity} onClose={() => setNewOpen(false)} /> : null}
    </div>
  );
}

function DraftDrawer({ contact, opportunity, copied, onCopy, onClose, onSave }: { contact: Contact; opportunity: Opportunity; copied: boolean; onCopy: () => void; onClose: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="Outreach draft" className="flex h-full w-full max-w-[560px] flex-col border-l border-black/[0.08] bg-[#f4f4f6] shadow-[-24px_0_80px_rgb(24_24_27_/_0.16)]"><header className="flex h-[76px] items-center justify-between border-b border-black/[0.08] px-6"><div><p className="reachard-eyebrow">Draft message</p><h2 className="mt-1 text-[15px] font-semibold">{contact.name} · {opportunity.company}</h2></div><Button isIconOnly variant="ghost" onPress={onClose} aria-label="Close"><X className="size-4" /></Button></header><div className="min-h-0 flex-1 overflow-y-auto p-6"><Card className="p-0"><Card.Header className="border-b border-black/[0.07] px-5 py-4"><p className="reachard-eyebrow">Subject</p><Card.Title className="mt-1 text-[15px]">A question about design at {opportunity.company}</Card.Title></Card.Header><Card.Content className="p-5"><pre className="whitespace-pre-wrap font-sans text-[14px] leading-7 text-[#55575d]">{draftText(contact, opportunity)}</pre></Card.Content></Card><div className="mt-4 flex items-center gap-2 rounded-[14px] bg-[#eaf3ee] px-4 py-3 text-[12px] text-[#416350]"><Check className="size-4" />One clear question · no referral ask</div></div><footer className="border-t border-black/[0.08] bg-white p-5"><div className="flex gap-3"><Button fullWidth variant="secondary" size="lg" onPress={onCopy}><Copy className="size-4" />{copied ? 'Copied' : 'Copy'}</Button><Button fullWidth variant="primary" size="lg" onPress={onSave}><Check className="size-4" />Save draft</Button></div></footer></section></div>;
}

function NewOpportunityDialog({ company, role, onCompany, onRole, onSubmit, onClose }: { company: string; role: string; onCompany: (value: string) => void; onRole: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><Card className="w-full max-w-[460px] p-0"><form onSubmit={onSubmit}><Card.Header className="flex-row items-center justify-between border-b border-black/[0.07] px-6 py-5"><Card.Title className="text-[19px]">New opportunity</Card.Title><Button isIconOnly variant="ghost" onPress={onClose} aria-label="Close"><X className="size-4" /></Button></Card.Header><Card.Content className="space-y-5 p-6"><TextField fullWidth><Label>Company</Label><Input autoFocus value={company} onChange={(event) => onCompany(event.target.value)} placeholder="e.g. Stripe" /></TextField><TextField fullWidth><Label>Role</Label><Input value={role} onChange={(event) => onRole(event.target.value)} placeholder="e.g. Product Designer" /></TextField></Card.Content><Card.Footer className="justify-end gap-3 border-t border-black/[0.07] px-6 py-5"><Button variant="ghost" onPress={onClose}>Cancel</Button><Button type="submit" variant="primary">Add opportunity<ArrowRight className="size-4" /></Button></Card.Footer></form></Card></div>;
}

function StatusDot({ status }: { status: Opportunity['status'] }) { return <span className={`size-2 rounded-full ${status === 'Ready' ? 'bg-[#16845b]' : status === 'Researching' ? 'bg-[#d18a36]' : 'bg-[#a1a1aa]'}`} />; }
function CompanyMark({ company, large = false }: { company: string; large?: boolean }) { const palette = company.length % 3 === 0 ? 'bg-[#ebe8f4] text-[#665686]' : company.length % 2 === 0 ? 'bg-[#e6f0eb] text-[#32674d]' : 'bg-[#f3eadf] text-[#855d31]'; return <span className={`flex shrink-0 items-center justify-center rounded-[11px] font-semibold ${palette} ${large ? 'size-11 text-[15px]' : 'size-9 text-[13px]'}`}>{company.slice(0, 1).toUpperCase()}</span>; }
function draftText(contact: Contact, opportunity: Opportunity) { return `Hi ${contact.name.split(' ')[0]},\n\nI’m exploring the ${opportunity.role} opportunity at ${opportunity.company}. My recent work has focused on AI-assisted product workflows, so I’m interested in how the team balances systems thinking with interaction craft.\n\n${contact.ask}\n\nThanks,\nSiyi`; }
