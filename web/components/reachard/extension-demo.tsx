'use client';

import { Avatar, Button } from '@heroui/react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Chrome, Copy, Mail, MapPin, MoreHorizontal, Orbit, Pause, Play, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Presentation-only adaptation of extension-ui/index.jsx: current role → people
// with match details → email draft. No Chrome bridge, search, reveal or mail calls.
// Keep the setup brief, then hold the recommendation and finished draft to read.
const DURATION = 13000;
type Point = { x: number; y: number };
const movePointer = (from: Point, to: Point, time: number, start: number, end: number) => {
  const progress = Math.max(0, Math.min(1, (time - start) / (end - start)));
  const eased = progress * progress * (3 - 2 * progress);
  return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
};
const DRAFT = 'Hi Maya,\n\nI came across the Product Designer role at Stripe. Your team’s work on simplifying complex financial tools caught my eye.\n\nI’d love to hear what you’d want a new designer to be excited about. Would you be open to a brief conversation?\n\nThanks,\nAlex';
const contacts = [
  { name: 'Maya Chen', title: 'Design Lead', image: 'maya-chen' },
  { name: 'Marcus Johnson', title: 'Design Recruiter', image: 'marcus-johnson' },
  { name: 'Priya Raman', title: 'Product Design Manager', image: 'priya-raman' }
];

export function ExtensionDemo() {
  const container = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const searchTarget = useRef<HTMLDivElement>(null);
  const personTarget = useRef<HTMLDivElement>(null);
  const draftTarget = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<{ start: Point; search: Point; person: Point; draft: Point } | null>(null);
  const elapsed = useRef(0);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const panel = body.current;
    if (!panel) return;
    // Layout offsets ignore the scene's entrance transform and follow wrapped
    // content at every breakpoint, keeping the cursor tip on the real target.
    const point = (element: HTMLElement | null): Point => {
      if (!element) return { x: 0, y: 0 };
      let x = element.offsetWidth * 0.72;
      let y = element.offsetHeight / 2;
      for (let node: HTMLElement | null = element; node && node !== panel; node = node.offsetParent as HTMLElement | null) {
        x += node.offsetLeft;
        y += node.offsetTop;
      }
      return { x, y };
    };
    const measure = () => setAnchors({ start: { x: panel.clientWidth - 22, y: panel.clientHeight * 0.8 }, search: point(searchTarget.current), person: point(personTarget.current), draft: point(draftTarget.current) });
    const observer = new ResizeObserver(measure);
    [panel, searchTarget.current, personTarget.current, draftTarget.current].forEach(element => { if (element) observer.observe(element); });
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.15 });
    if (container.current) observer.observe(container.current);
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (visible && !document.hidden) {
        elapsed.current = (elapsed.current + Math.min(now - last, 200)) % DURATION;
        setTime(elapsed.current);
      }
      last = now;
    }, 60);
    return () => { window.clearInterval(timer); observer.disconnect(); };
  }, [paused, reducedMotion]);

  const position = reducedMotion ? 5000 : time;
  const scene = position < 2000 ? 'role' : position < 3000 ? 'search' : position < 7000 ? 'people' : 'draft';
  const reasonVisible = position >= 4000;
  const draftLength = Math.max(0, Math.min(DRAFT.length, Math.floor((position - 7400) / 7)));
  const draftReady = draftLength === DRAFT.length;
  const clickStart = position < 3000 ? 1820 : position < 5000 ? 3820 : 6820;
  const clickProgress = (position - clickStart) / 420;
  const clicking = clickProgress >= 0 && clickProgress <= 1;
  const pointerTarget = position < 3000 ? 'search' : position < 5200 ? 'person' : 'draft';
  const pointer = !anchors ? null : position < 3000
    ? movePointer(anchors.start, anchors.search, position, 600, 1450)
    : position < 5200
      ? movePointer(anchors.search, anchors.person, position, 3100, 3700)
      : movePointer(anchors.person, anchors.draft, position, 5200, 6250);
  const pointerVisible = !reducedMotion && position >= 600 && position < 7500;
  const status = scene === 'role' ? 'A role worth exploring' : scene === 'search' ? 'Finding your people' : scene === 'people' ? 'A reason to reach out' : draftReady ? 'Your next conversation starts here' : 'Finding the words';

  return (
    <figure ref={container} className="rh-demo" data-scene={scene} data-paused={paused || reducedMotion} aria-label="Illustrative Reachard extension demo: open a job, find relevant people and draft a personal email.">
      <div className="rh-collage" aria-hidden="true">
        <img className="rh-art rh-art-blue" src="/images/home/blue-texture.webp" alt="" width="1086" height="1448" fetchPriority="high" />
        <img className="rh-art rh-art-coast" src="/images/home/hero-background.png" alt="" width="1659" height="948" />
        <div className="rh-job-window">
          <div className="rh-browser-bar"><span className="rh-window-dots"><i /><i /><i /></span><span><Chrome size={11} />careers.stripe.com</span><MoreHorizontal size={14} /></div>
          <div className="rh-job-body"><span className="rh-job-brand">stripe<span>Careers <ArrowRight size={12} /></span></span><p className="rh-job-kicker">Design · San Francisco</p><h3>Product<br />Designer</h3><p>Help build the next generation<br />of financial tools.</p><div className="rh-job-pills"><span>Full time</span><span>Design</span></div><div className="rh-job-rule" /><h4>About the team</h4><p>We make complex things feel simple.<br />Join a team designing for millions<br />of ambitious businesses.</p><div className="rh-job-apply">Apply for this role <ArrowRight size={13} /></div></div>
        </div>
        <div className="rh-extension">
          <header className="rh-extension-header"><span><Orbit size={23} strokeWidth={1.8} />reachard</span><span className="rh-extension-tools"><MoreHorizontal size={17} /><X size={15} /></span></header>
          <div ref={body} className="rh-extension-body">
            <div className="rh-demo-scene rh-role-scene" data-active={scene === 'role' || scene === 'search'}>
              <span className="rh-panel-label">Current role</span><h3>Product Designer</h3><p className="rh-panel-company">Stripe <span><MapPin size={12} />San Francisco</span></p><span className="rh-view-job">View job <ArrowRight size={14} /></span>
              <div ref={searchTarget} className="rh-demo-search" data-pressed={clicking && pointerTarget === 'search'} data-loading={scene === 'search'}>{scene === 'search' ? <><span className="rh-loading-spinner" />Finding people…</> : <>Find people at Stripe <ArrowRight size={17} /></>}</div>
              <div className="rh-preferences"><h4>Make it personal</h4><p>Message style</p><div className="rh-goals"><span className="rh-goal-selected">Advice</span><span>Referral</span><span>Introduction</span></div><div className="rh-styles"><div><small>Tone</small><span>Warm <ChevronDown size={13} /></span></div><div><small>Length</small><span>Concise <ChevronDown size={13} /></span></div></div><span className="rh-context-note">A little context goes a long way.</span></div>
            </div>
            <div className="rh-demo-scene rh-people-scene" data-active={scene === 'people'}>
              <span className="rh-demo-back"><ArrowLeft size={13} />Back to role</span><div className="rh-people-heading"><h3>People at Stripe</h3><span>3</span></div><p className="rh-panel-subtitle">Product Designer · Choose your next conversation.</p>
              <div className="rh-contact-main"><div ref={personTarget} className="rh-person-target" data-pressed={clicking && pointerTarget === 'person'}><Person index={0} expanded={reasonVisible} /></div><div className="rh-match" data-visible={reasonVisible}><p>Leads the design team. Ask about the work and what they look for in a new designer.</p><span><MapPin size={12} />San Francisco, CA</span></div><div ref={draftTarget} className="rh-demo-write" data-pressed={clicking && pointerTarget === 'draft'}><Mail size={14} />Get email & draft <ArrowRight size={14} /></div></div>
              <div className="rh-contact-secondary"><Person index={1} /></div><div className="rh-contact-secondary"><Person index={2} /></div>
            </div>
            <div className="rh-demo-scene rh-draft-scene" data-active={scene === 'draft'}>
              <span className="rh-demo-back"><ArrowLeft size={13} />All contacts</span><div className="rh-compose-title"><h3>Email draft</h3><span>Not sent</span></div><div className="rh-draft-recipient"><span>To</span><Person index={0} recipient /></div><div className="rh-draft-subject"><span>Subject</span>A question about design at Stripe</div><div className="rh-email-text">{DRAFT.slice(0, draftLength)}{!draftReady && <span className="rh-type-caret" />}</div>
              <div className="rh-email-actions" data-ready={draftReady}><span><Copy size={13} />Copy</span><span>Open in email app <ArrowRight size={13} /></span></div>
            </div>
            {pointer && <div className="rh-demo-pointer" data-target={pointerTarget} data-clicking={clicking} style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)`, opacity: pointerVisible ? 1 : 0 }}>
              <span className="rh-pointer-ripple" style={{ opacity: clicking ? 1 - clickProgress : 0, transform: `translate(-50%, -50%) scale(${clicking ? 0.4 + clickProgress * 1.4 : 0.4})` }} />
              <svg width="26" height="32" viewBox="0 0 26 32" fill="none" style={{ transform: clicking ? 'scale(.88)' : 'scale(1)' }}><path d="M1.5 1.5L22.5 17.5L13.5 18.5L18.5 28L13.5 30.5L8.5 21L2 27L1.5 1.5Z" fill="#172333" stroke="white" strokeWidth="2" strokeLinejoin="round" /></svg>
            </div>}
          </div>
          <div className="rh-extension-bottom"><span><Check size={12} />You choose when to send.</span><Orbit size={14} /></div>
        </div>
        <div className="rh-live-caption"><span className="rh-caption-icon">{scene === 'draft' ? <Mail size={17} /> : scene === 'people' ? <Sparkles size={17} /> : <Search size={17} />}</span><span key={status}>{status}</span></div>
      </div>
      <figcaption><span>Illustrative demo · Sample people and messages</span><Button variant="ghost" size="sm" className="rh-pause" onPress={() => setPaused(!paused)} isDisabled={reducedMotion} aria-label={paused ? 'Resume demo animation' : 'Pause demo animation'}>{paused || reducedMotion ? <Play size={12} /> : <Pause size={12} />}{reducedMotion ? 'Reduced motion' : paused ? 'Resume' : 'Pause'}</Button></figcaption>
    </figure>
  );
}

function Person({ index, expanded = false, recipient = false }: { index: number; expanded?: boolean; recipient?: boolean }) {
  const person = contacts[index];
  return <div className="rh-person"><Avatar className="rh-avatar"><Avatar.Image src={`/images/workspace/${person.image}.png`} alt="" /><Avatar.Fallback>{person.name.charAt(0)}</Avatar.Fallback></Avatar><div><strong>{person.name}</strong><span>{person.title}</span></div>{!recipient && <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />}</div>;
}
