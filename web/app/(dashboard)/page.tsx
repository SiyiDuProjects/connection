'use client';

import { buttonVariants } from '@heroui/react';
import { ArrowDown, ArrowUpRight, Chrome, Mail, MousePointer2, Users } from 'lucide-react';
import Link from 'next/link';
import { Brand, MarketingHeader } from '@/components/reachard/design';
import { ExtensionInstallLink } from '@/components/extension-install-link';
import { ExtensionDemo } from '@/components/reachard/extension-demo';
import './home.css';

const steps = [
  { icon: MousePointer2, title: 'Start with a job.', text: 'See a role you like? Open Reachard right there in your browser.' },
  { icon: Users, title: 'Find your person.', text: 'Meet relevant recruiters and employees, with a reason for every recommendation.' },
  { icon: Mail, title: 'Make it personal.', text: 'Get a tailored email draft. Add your voice, then send it when you’re ready.' }
];

export default function HomePage() {
  const chromeStoreUrl = String(process.env.NEXT_PUBLIC_CHROME_STORE_URL || '').trim();
  return (
    <main className="rd-site rh-home">
      <MarketingHeader />
      <section className="rh-hero" aria-labelledby="home-title">
        <div className="rh-copy">
          <span className="rh-eyebrow"><span>For job seekers</span>A more thoughtful way in <ArrowUpRight size={13} /></span>
          <h1 id="home-title">Find the people<br />behind the job<br /><em>you want.</em></h1>
          <p className="rh-description">A job post is just the beginning.<br />Find who to contact, why they matter,<br className="rh-copy-break" /> and what to say — right in your browser.</p>
          <div className="rh-actions"><ExtensionInstallLink variant="primary" /><Link href="/sign-up" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>Get started <ArrowUpRight size={16} /></Link></div>
          <p className="rh-compatibility"><Chrome size={15} />Your job search, with a little more context.</p>
        </div>
        <ExtensionDemo />
        <a href="#how-it-works" className="rh-down"><ArrowDown size={15} />A job. A person. A conversation.</a>
      </section>
      <section id="how-it-works" className="rh-how" aria-labelledby="how-title">
        <div className="rh-how-heading"><span className="rh-section-label">A little context changes everything</span><h2 id="how-title">From an open tab<br />to an <em>open door.</em></h2><p>Three small steps toward your next opportunity.</p></div>
        <div className="rh-steps">{steps.map((step, i) => <article key={step.title}><div className="rh-step-number"><step.icon size={21} strokeWidth={1.5} /><span>0{i + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </section>
      <section id="install" className="rh-closing" aria-labelledby="install-title">
        <img src="/images/home/hero-background.png" alt="" loading="lazy" width="1659" height="948" />
        <div><span className="rh-section-label">Your next chapter</span><h2 id="install-title">Opportunity starts<br />with <em>a conversation.</em></h2>
          <div className="rh-actions">{chromeStoreUrl && <ExtensionInstallLink variant="primary" />}<Link href="/sign-up" className={buttonVariants({ variant: chromeStoreUrl ? 'secondary' : 'primary', size: 'lg' })}>Get started <ArrowUpRight size={16} /></Link></div>
          <p>{chromeStoreUrl ? 'Add Reachard to Chrome. Bring your next opportunity a little closer.' : 'Join the private beta. Extension access is shared with beta participants.'}</p>
        </div>
      </section>
      <footer className="rd-footer rh-footer"><Brand /><nav aria-label="Footer"><Link href="/pricing">Pricing</Link><Link href="/sign-in">Log in</Link><Link href="/support">Support</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav><small>© 2026 Reachard<span>Made for your next move.</span></small></footer>
    </main>
  );
}
