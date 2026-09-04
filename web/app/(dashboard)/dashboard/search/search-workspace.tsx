'use client';

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  X
} from 'lucide-react';
import { useState, type FormEvent } from 'react';

type Opportunity = {
  id: string;
  company: string;
  role: string;
  location: string;
  status: 'Saved' | 'Researching' | 'Ready';
};

type Contact = {
  id: string;
  name: string;
  role: string;
  avatar: string;
  route: string;
  reason: string;
  ask: string;
  confidence: number;
};

const initialOpportunities: Opportunity[] = [
  { id: 'stripe', company: 'Stripe', role: 'Senior Product Designer', location: 'San Francisco, CA', status: 'Researching' },
  { id: 'notion', company: 'Notion', role: 'Product Designer', location: 'San Francisco, CA', status: 'Ready' },
  { id: 'airbnb', company: 'Airbnb', role: 'Product Designer, AI', location: 'San Francisco, CA', status: 'Saved' }
];

const contacts: Contact[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    role: 'Product Design Lead',
    avatar: '/images/workspace/maya-chen.png',
    route: 'Hiring context',
    reason: 'Closest to the team mandate and the portfolio bar for this role.',
    ask: 'What part of the role is hardest to understand from the outside?',
    confidence: 94
  },
  {
    id: 'marcus',
    name: 'Marcus Johnson',
    role: 'Design Recruiter',
    avatar: '/images/workspace/marcus-johnson.png',
    route: 'Process signal',
    reason: 'Best path for timing, interview structure, and whether the search is active.',
    ask: 'Is the team still prioritizing systems-thinking experience for this search?',
    confidence: 88
  },
  {
    id: 'priya',
    name: 'Priya Raman',
    role: 'Product Design Manager',
    avatar: '/images/workspace/priya-raman.png',
    route: 'Peer perspective',
    reason: 'A lower-pressure route to learn how product design decisions are made.',
    ask: 'Which portfolio decisions best signal judgment and ownership on the team?',
    confidence: 84
  }
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

  function selectOpportunity(id: string) {
    setActiveOpportunityId(id);
    setSelectedContactId('maya');
    setNotice('');
  }

  function markReady() {
    setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, status: item.status === 'Ready' ? 'Researching' : 'Ready' } : item));
    setNotice(opportunity.status === 'Ready' ? 'Moved back to research.' : 'Opportunity marked ready.');
  }

  function addOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company.trim() || !role.trim()) {
      setNotice('Add a company and role first.');
      return;
    }
    const id = `${company}-${role}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    setOpportunities((current) => [...current, { id, company: company.trim(), role: role.trim(), location: 'Location to confirm', status: 'Saved' }]);
    setActiveOpportunityId(id);
    setSelectedContactId('maya');
    setCompany('');
    setRole('');
    setNewOpen(false);
    setNotice('Opportunity added to this local preview.');
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(draftText(contact, opportunity));
    setCopied(true);
  }

  return (
    <div className={`min-h-[100dvh] bg-[#f7f8f7] text-[#202421] lg:grid ${sidebarCollapsed ? 'lg:grid-cols-[68px_minmax(0,1fr)]' : 'lg:grid-cols-[232px_minmax(0,1fr)]'}`}>
      <aside className="border-b border-[#e3e6e4] bg-[#f1f3f1] lg:sticky lg:top-0 lg:h-[100dvh] lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-3">
          <button type="button" onClick={() => selectOpportunity(opportunity.id)} className={`flex items-center gap-2 rounded-[8px] px-2 py-1.5 hover:bg-black/[0.04] ${sidebarCollapsed ? 'mx-auto' : ''}`}>
            <img src="/images/brand/reachard-logo-mark.png" alt="Reachard" className="h-7 w-7 object-contain" />
            {!sidebarCollapsed ? <span className="text-[13px] font-semibold tracking-[-0.02em]">Reachard</span> : null}
          </button>
          {!sidebarCollapsed ? <button type="button" onClick={() => setSidebarCollapsed(true)} className="hidden h-8 w-8 items-center justify-center rounded-[7px] text-[#7b817d] hover:bg-black/[0.04] lg:inline-flex" aria-label="Collapse sidebar"><PanelLeftClose className="h-4 w-4" /></button> : null}
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 pb-3 lg:block lg:overflow-visible lg:pb-0">
          {!sidebarCollapsed ? <div className="mb-2 hidden items-center justify-between px-2 pt-5 lg:flex"><span className="text-[9px] font-semibold uppercase tracking-[0.09em] text-[#969b98]">Opportunities</span><button type="button" onClick={() => setNewOpen(true)} className="flex h-5 w-5 items-center justify-center rounded-[5px] hover:bg-black/[0.05]" aria-label="Add opportunity"><Plus className="h-3.5 w-3.5" /></button></div> : null}
          {opportunities.map((item) => (
            <button key={item.id} type="button" onClick={() => selectOpportunity(item.id)} title={sidebarCollapsed ? item.company : undefined} className={`flex shrink-0 items-center rounded-[8px] text-left lg:mb-1 lg:w-full ${sidebarCollapsed ? 'h-10 justify-center px-2' : 'min-w-[176px] gap-2.5 px-2 py-2 lg:min-w-0'} ${activeOpportunityId === item.id ? 'bg-white shadow-[0_1px_2px_rgba(16,24,19,0.035)] ring-1 ring-black/[0.04]' : 'hover:bg-black/[0.035]'}`}>
              <CompanyMark company={item.company} />
              {!sidebarCollapsed ? <span className="min-w-0 flex-1"><strong className="block truncate text-[10px] font-semibold">{item.company}</strong><span className="mt-0.5 block truncate text-[8px] text-[#8b908d]">{item.role}</span></span> : null}
              {!sidebarCollapsed ? <span className={`h-1.5 w-1.5 rounded-full ${item.status === 'Ready' ? 'bg-[#327957]' : item.status === 'Researching' ? 'bg-[#bd7e36]' : 'bg-[#afb4b1]'}`} /> : null}
            </button>
          ))}
        </div>

        <div className="hidden lg:absolute lg:inset-x-0 lg:bottom-0 lg:block lg:p-3">
          {sidebarCollapsed ? <button type="button" onClick={() => setSidebarCollapsed(false)} className="mb-2 flex h-9 w-full items-center justify-center rounded-[8px] text-[#747a76] hover:bg-black/[0.04]" aria-label="Expand sidebar"><PanelLeftOpen className="h-4 w-4" /></button> : null}
          <div className={`flex h-10 items-center rounded-[8px] ${sidebarCollapsed ? 'justify-center' : 'gap-2.5 px-2'}`}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#183e2c] text-[9px] font-semibold text-white">SD</span>{!sidebarCollapsed ? <span><strong className="block text-[10px] font-medium">Siyi Du</strong><span className="block text-[8px] text-[#8b908d]">Berkeley · 2027</span></span> : null}</div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#e4e7e5] bg-[#f7f8f7]/94 px-5 backdrop-blur-xl sm:px-7">
          <div className="flex min-w-0 items-center gap-2 text-[10px]"><span className="text-[#949a96]">Opportunity</span><span className="text-[#c8ccca]">/</span><span className="truncate font-medium">{opportunity.company}</span></div>
          <button type="button" onClick={() => setNewOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#dce1dd] bg-white px-3 text-[9px] font-semibold shadow-[0_1px_2px_rgba(16,24,19,0.025)] hover:border-[#cbd2cd]"><Plus className="h-3.5 w-3.5" />New opportunity</button>
        </header>

        {notice ? <div className="fixed right-5 top-[70px] z-40 flex max-w-[320px] items-center gap-2.5 rounded-[10px] border border-[#d8e5dd] bg-white px-3.5 py-3 text-[9px] text-[#356047] shadow-[0_12px_34px_rgba(18,29,23,0.11)]"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#2f8159]" /><span className="flex-1">{notice}</span><button type="button" onClick={() => setNotice('')}><X className="h-3.5 w-3.5" /></button></div> : null}

        <main className="mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-7 lg:py-12">
          <section className="flex flex-col gap-5 border-b border-[#e1e4e2] pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0"><div className="mb-3 flex items-center gap-2"><CompanyMark company={opportunity.company} large /><span className="text-[10px] font-medium text-[#727975]">{opportunity.company} · {opportunity.location}</span></div><h1 className="text-[28px] font-semibold leading-tight tracking-[-0.045em] text-[#181c19] sm:text-[34px]">{opportunity.role}</h1></div>
            <button type="button" onClick={markReady} className={`inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-full px-3 text-[9px] font-semibold sm:self-auto ${opportunity.status === 'Ready' ? 'bg-[#e6f2eb] text-[#2e704f]' : 'bg-[#f6eee3] text-[#8d5d28]'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{opportunity.status}</button>
          </section>

          <section className="mt-6 flex flex-col gap-4 rounded-[13px] border border-[#d7e3db] bg-[#f1f7f3] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-[660px]"><p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#4d725d]">Next move</p><h2 className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[#22372b]">Confirm the role mandate before you apply.</h2><p className="mt-1 text-[10px] leading-4 text-[#69796f]">Start with {contact.name}. One specific question should tell you whether this opportunity deserves more time.</p></div>
            <button type="button" onClick={() => { setDraftOpen(true); setCopied(false); }} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] bg-[#1a563b] px-4 text-[10px] font-semibold text-white shadow-[0_5px_14px_rgba(26,86,59,0.15)] hover:bg-[#154a32]"><Sparkles className="h-3.5 w-3.5" />Draft message</button>
          </section>

          <section className="mt-6 grid overflow-hidden rounded-[14px] border border-[#dde1de] bg-white shadow-[0_8px_28px_rgba(20,28,23,0.03)] lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="border-b border-[#e7eae8] lg:border-b-0 lg:border-r">
              <div className="border-b border-[#eceeec] px-5 py-4"><h2 className="text-[12px] font-semibold">Recommended people</h2><p className="mt-1 text-[9px] text-[#8a8f8c]">Pick the route that answers your biggest unknown.</p></div>
              <div>{contacts.map((item) => <button key={item.id} type="button" onClick={() => setSelectedContactId(item.id)} className={`flex w-full items-center gap-3 border-b border-[#eceeec] px-5 py-4 text-left last:border-b-0 ${selectedContactId === item.id ? 'bg-[#f5f9f6]' : 'hover:bg-[#fafbfa]'}`}><img src={item.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-black/[0.06]" /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-[11px] font-semibold">{item.name}</strong>{selectedContactId === item.id ? <span className="rounded-full bg-[#e5f1e9] px-2 py-0.5 text-[8px] font-semibold text-[#317052]">Selected</span> : null}</span><span className="mt-0.5 block truncate text-[9px] text-[#818783]">{item.role} · {item.route}</span></span><span className="text-[9px] font-semibold text-[#4a7d62]">{item.confidence}</span></button>)}</div>
            </div>

            <div className="flex flex-col p-5">
              <div className="flex items-center gap-3"><img src={contact.avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-black/[0.06]" /><div className="min-w-0"><h2 className="truncate text-[12px] font-semibold">{contact.name}</h2><p className="mt-0.5 truncate text-[9px] text-[#838985]">{contact.role}</p></div></div>
              <dl className="mt-5 space-y-4"><div><dt className="text-[8px] font-semibold uppercase tracking-[0.07em] text-[#979c99]">Why this person</dt><dd className="mt-1.5 text-[10px] leading-5 text-[#555d58]">{contact.reason}</dd></div><div className="border-t border-[#eceeec] pt-4"><dt className="text-[8px] font-semibold uppercase tracking-[0.07em] text-[#979c99]">What to ask</dt><dd className="mt-1.5 text-[10px] font-medium leading-5 text-[#333a35]">“{contact.ask}”</dd></div></dl>
              <button type="button" onClick={() => { setDraftOpen(true); setCopied(false); }} className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-[#dce1dd] text-[9px] font-semibold hover:bg-[#f7f9f7]"><FileText className="h-3.5 w-3.5" />Open draft</button>
            </div>
          </section>

          <div className="mt-4 flex items-center justify-between text-[8px] text-[#9a9f9c]"><span>Static local preview</span><span>No data is sent</span></div>
        </main>
      </div>

      {draftOpen ? <DraftDrawer contact={contact} opportunity={opportunity} copied={copied} onCopy={() => void copyDraft()} onClose={() => setDraftOpen(false)} onSave={() => { setDraftOpen(false); setNotice('Draft saved in this preview.'); }} /> : null}
      {newOpen ? <NewOpportunityDialog company={company} role={role} onCompany={setCompany} onRole={setRole} onSubmit={addOpportunity} onClose={() => setNewOpen(false)} /> : null}
    </div>
  );
}

function DraftDrawer({ contact, opportunity, copied, onCopy, onClose, onSave }: { contact: Contact; opportunity: Opportunity; copied: boolean; onCopy: () => void; onClose: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="Outreach draft" className="flex h-full w-full max-w-[500px] flex-col border-l border-[#dfe3e0] bg-[#f8f9f8] shadow-[-18px_0_60px_rgba(20,28,23,0.14)]"><header className="flex h-14 items-center justify-between border-b border-[#e3e6e4] px-5"><div><p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#909591]">Draft message</p><h2 className="mt-0.5 text-[11px] font-semibold">{contact.name} · {opportunity.company}</h2></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-black/[0.05]"><X className="h-4 w-4" /></button></header><div className="min-h-0 flex-1 overflow-y-auto p-5"><div className="rounded-[12px] border border-[#dde1de] bg-white"><div className="border-b border-[#eceeec] px-4 py-3"><span className="text-[8px] font-semibold uppercase tracking-[0.07em] text-[#959a97]">Subject</span><p className="mt-1 text-[11px] font-medium">A question about design at {opportunity.company}</p></div><pre className="whitespace-pre-wrap px-4 py-4 font-sans text-[11px] leading-[1.75] text-[#4d5550]">{draftText(contact, opportunity)}</pre></div><div className="mt-4 flex items-center gap-2 rounded-[9px] border border-[#dbe7df] bg-[#f2f8f4] px-3 py-2.5 text-[9px] text-[#526b5d]"><Check className="h-3.5 w-3.5" />One clear question · no referral ask</div></div><footer className="border-t border-[#e3e6e4] bg-white p-4"><div className="flex gap-2"><button type="button" onClick={onCopy} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[9px] border border-[#dce1dd] text-[10px] font-semibold"><Copy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy'}</button><button type="button" onClick={onSave} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#1a563b] text-[10px] font-semibold text-white"><Check className="h-3.5 w-3.5" />Save draft</button></div></footer></section></div>;
}

function NewOpportunityDialog({ company, role, onCompany, onRole, onSubmit, onClose }: { company: string; role: string; onCompany: (value: string) => void; onRole: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-5 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={onSubmit} className="w-full max-w-[420px] rounded-[14px] border border-[#dce1dd] bg-white p-5 shadow-[0_24px_80px_rgba(15,25,20,0.18)]"><div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold tracking-[-0.02em]">New opportunity</h2><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-[#f3f5f3]"><X className="h-4 w-4" /></button></div><label className="mt-5 block"><span className="text-[9px] font-semibold text-[#5f6661]">Company</span><input autoFocus value={company} onChange={(event) => onCompany(event.target.value)} placeholder="e.g. Stripe" className="mt-1.5 h-10 w-full rounded-[8px] border border-[#dce1dd] px-3 text-[11px] outline-none focus:border-[#79a58d]" /></label><label className="mt-3 block"><span className="text-[9px] font-semibold text-[#5f6661]">Role</span><input value={role} onChange={(event) => onRole(event.target.value)} placeholder="e.g. Product Designer" className="mt-1.5 h-10 w-full rounded-[8px] border border-[#dce1dd] px-3 text-[11px] outline-none focus:border-[#79a58d]" /></label><button type="submit" className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] bg-[#1a563b] text-[9px] font-semibold text-white">Add opportunity<ArrowRight className="h-3.5 w-3.5" /></button></form></div>;
}

function CompanyMark({ company, large = false }: { company: string; large?: boolean }) {
  const palette = company.length % 3 === 0 ? 'bg-[#ebe8f4] text-[#665686]' : company.length % 2 === 0 ? 'bg-[#e6f0eb] text-[#32674d]' : 'bg-[#f3eadf] text-[#855d31]';
  return <span className={`flex shrink-0 items-center justify-center rounded-[7px] font-semibold ${palette} ${large ? 'h-7 w-7 text-[10px]' : 'h-6 w-6 text-[9px]'}`}>{company.slice(0, 1).toUpperCase()}</span>;
}

function draftText(contact: Contact, opportunity: Opportunity) {
  return `Hi ${contact.name.split(' ')[0]},\n\nI’m exploring the ${opportunity.role} opportunity at ${opportunity.company}. My recent work has focused on AI-assisted product workflows, so I’m interested in how the team balances systems thinking with interaction craft.\n\n${contact.ask}\n\nThanks,\nSiyi`;
}
