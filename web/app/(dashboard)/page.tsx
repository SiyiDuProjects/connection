'use client';
import { Avatar, Button, Chip, Tabs, buttonVariants } from '@heroui/react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronRight, Copy, FileText, Globe, Mail, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Brand, MarketingHeader } from '@/components/reachard/design';

const people = [
  { name: 'Maya Chen', role: 'Design Lead', image: 'maya-chen', tag: 'Closest to the team', reason: 'A direct perspective on the design team and what this role could own.' },
  { name: 'Marcus Johnson', role: 'Design Recruiter', image: 'marcus-johnson', tag: 'Understand the process', reason: 'Start here for hiring timelines, portfolio expectations, and the interview process.' },
  { name: 'Priya Raman', role: 'Product Design Manager', image: 'priya-raman', tag: 'A peer perspective', reason: 'Learn how designers collaborate and make decisions across the product.' }
];
export default function HomePage() {
  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState<'people' | 'draft'>('people');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const person = people[selected];
  const chromeStoreUrl = String(process.env.NEXT_PUBLIC_CHROME_STORE_URL || '').trim();
  const draft = `Hi ${person.name.split(' ')[0]},\n\nI'm exploring the Product Designer role at Stripe and would love to better understand the team.\n\nWhat is one challenge you would want a new designer to be excited about?\n\nThanks for your time.`;
  const gmailUrl = 'https://mail.google.com/mail/?' + new URLSearchParams({ view: 'cm', fs: '1', to: '', su: 'A question about product design at Stripe', body: draft }).toString();
  async function copy() {
    try { await navigator.clipboard.writeText(draft); setCopied(true); setCopyError(''); }
    catch { setCopyError('Clipboard unavailable. Select the draft text to copy it.'); }
  }
  return <main className="rd-site">
    <MarketingHeader />
    <section className="rd-hero">
      <img className="rd-landscape" src="/images/home/hero-background.png" alt="" fetchPriority="high" />
      <div className="rd-hero-copy rd-enter">
        <Link href="/workspace-preview" className="rd-announcement"><span className="rd-mini-label">PRIVATE BETA</span>A more thoughtful way in<ChevronRight size={14} /></Link>
        <h1>Opportunity starts<br />with <span>a conversation.</span></h1>
        <p>Find the right people. Know why they matter.<br className="rd-desktop-break" /> Turn a role you want into a conversation worth having.</p>
        <div className="rd-hero-actions"><Link href={chromeStoreUrl || '/sign-up'} target={chromeStoreUrl ? '_blank' : undefined} rel={chromeStoreUrl ? 'noreferrer' : undefined} className={buttonVariants({ variant: 'primary', size: 'lg' })}>{chromeStoreUrl ? 'Add to Chrome' : 'Find your way in'} <ArrowUpRight size={17} /></Link><Link href="/workspace-preview" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>Explore the workspace <ArrowRight size={16} /></Link></div>
        <span className="rd-hero-note">A little context can open a very different door.</span>
      </div>
      <a href="#product" className="rd-scroll-cue"><ArrowDown size={15} />MEET YOUR NEXT MOVE</a>
      <span className="rd-hero-caption">LESS NOISE. MORE POSSIBILITY.</span>
    </section>
    <section id="product" className="rd-product-section">
      <div className="rd-section-caption"><span>YOUR SEARCH, WITH DIRECTION</span><span>01 / THE WORKSPACE</span></div>
      <div className="rd-section-intro"><h2>Behind every role,<br /><span>there are people.</span></h2><p>A job description is only the beginning. Reachard helps you find the person who can tell you more.</p></div>
      <div className="rd-product-window">
        <div className="rd-window-toolbar"><Brand /><span>Stripe <ChevronRight size={12} />Product Designer</span><Link href="/workspace-preview">Open workspace <ArrowUpRight size={14} /></Link></div>
        <div className="rd-product-body">
          <aside className="rd-demo-sidebar"><p className="rd-overline">YOUR WORKSPACE</p><div className="rd-demo-nav active"><Search size={15} />Find people</div><div className="rd-demo-nav"><FileText size={15} />Drafts</div><div className="rd-demo-sidebar-bottom"><Globe size={16} /><span>A world of possibilities.<br /><strong>One place to start.</strong></span></div></aside>
          <div className="rd-demo-main"><div className="rd-demo-heading"><div><p className="rd-overline">STRIPE · PRODUCT DESIGN</p><h3>Your next conversation.</h3></div><Chip size="sm">Illustrative example</Chip></div>
            <Tabs selectedKey={step} onSelectionChange={(key) => setStep(key as 'people' | 'draft')} className="my-5"><Tabs.ListContainer><Tabs.List aria-label="Product preview"><Tabs.Tab id="people">People <Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="draft">Your message <Tabs.Indicator /></Tabs.Tab></Tabs.List></Tabs.ListContainer></Tabs>
            {step === 'people' ? <div className="rd-preview-people">{people.map((p, i) => <Button variant={selected === i ? "secondary" : "ghost"} key={p.name} onClick={() => { setSelected(i); setCopied(false); }} className="h-auto min-h-16 w-full justify-start gap-3 text-left" aria-pressed={selected === i}><Avatar><Avatar.Image src={`/images/workspace/${p.image}.png`} alt="" /><Avatar.Fallback>{p.name.charAt(0)}</Avatar.Fallback></Avatar><span className="rd-person-copy"><strong>{p.name}</strong><small>{p.role} at Stripe</small></span><Chip size="sm" className="rd-person-tag">{p.tag}</Chip><ChevronRight size={15} /></Button>)}</div> : <div className="rd-preview-draft"><span className="rd-overline">TO {person.name.toUpperCase()}</span><p>{draft}</p><Button variant="secondary" onPress={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy message'}</Button><a href={gmailUrl} target="_blank" rel="noreferrer" className={buttonVariants({variant: 'primary', className: 'ml-2'})}>Open Gmail <ArrowUpRight size={14} /></a>{copyError && <small role="alert">{copyError}</small>}</div>}
            <div className="rd-demo-footnote"><Sparkles size={13} />Relevant people. A reason for every recommendation.</div>
          </div>
          <aside className="rd-demo-inspector"><Avatar size="lg"><Avatar.Image src={`/images/workspace/${person.image}.png`} alt={person.name} /><Avatar.Fallback>{person.name.charAt(0)}</Avatar.Fallback></Avatar><h4>{person.name}</h4><p>{person.role} at Stripe</p><Chip size="sm">{person.tag}</Chip><div className="rd-inspector-reason"><span className="rd-overline">WHY START HERE</span><p>{person.reason}</p></div><Button variant="primary" fullWidth onPress={() => { setStep('draft'); setCopied(false); }}><Mail size={15} />Start a conversation</Button></aside>
        </div>
      </div><p className="rd-product-note">A working preview. Select a person and try the message.</p>
    </section>
    <section id="how-it-works" className="rd-how-section"><div className="rd-section-caption"><span>THOUGHTFUL BY DESIGN</span><span>02 / HOW IT WORKS</span></div><h2>From interested<br />to <span>introduced.</span></h2><div className="rd-steps">{[
      { icon: Search, title: 'Start with a possibility.', text: 'Search a company and role in your workspace, or bring the job post you are already looking at with the Chrome extension.' },
      { icon: Sparkles, title: 'Find your way in.', text: 'Discover relevant people and understand the context behind each recommendation. Choose who makes sense for you.' },
      { icon: Mail, title: 'Make it personal.', text: 'Draft a specific, thoughtful introduction. Edit it in your own voice, then copy it when you are ready. You stay in control.' }
    ].map((item, i) => <article key={item.title}><div className="rd-step-top"><item.icon size={24} strokeWidth={1.4} /><span>0{i + 1}</span></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
    <section className="rd-closing"><span className="rd-overline">YOUR NEXT CHAPTER</span><h2>Make the first move.<br /><span>Make it count.</span></h2><Link href="/sign-up" className={buttonVariants({ variant: 'primary', size: 'lg' })}>Get started with Reachard <ArrowUpRight size={17} /></Link><p>Good conversations start with a little context.</p></section>
    <footer className="rd-footer"><Brand /><span>Thoughtful connections. Real possibilities.</span><nav><Link href="/pricing">Pricing</Link><Link href="/dashboard">Dashboard</Link><Link href={chromeStoreUrl || '/sign-up'} target={chromeStoreUrl ? '_blank' : undefined} rel={chromeStoreUrl ? 'noreferrer' : undefined}>{chromeStoreUrl ? 'Add to Chrome' : 'Create account'}</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/sign-in">Log in <ArrowUpRight size={12} /></Link></nav><small>© 2026 Reachard</small></footer>
  </main>;
}
