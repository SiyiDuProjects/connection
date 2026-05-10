'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Chrome, Copy, ExternalLink, Mail } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

const people = [
  {
    name: 'Jenny Wilson',
    role: 'Product Lead - Stripe',
    reasons: ['Hiring-side signal', 'Berkeley alumni path']
  },
  {
    name: 'Albert Flores',
    role: 'Recruiting - Product',
    reasons: ['Recent hiring activity', 'Product org overlap']
  }
];

export default function HomePage() {
  const [copied, setCopied] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const draftBody = useMemo(
    () =>
      "Hi Jenny -\n\nI'm a Berkeley student interested in product and payments infrastructure. I saw Stripe's Senior Product Manager role and wanted to ask one thoughtful question about the team.",
    []
  );
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(
    'Thoughtful question about the Senior Product Manager role'
  )}&body=${encodeURIComponent(draftBody)}`;

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draftBody);
    } catch {
      // Some browser contexts block clipboard writes; the click should still feel handled.
    } finally {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  function scrollToDraft() {
    document.getElementById('docs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="min-h-screen bg-white text-foreground">
      <section className="reachard-mountain-hero flex min-h-screen flex-col items-center overflow-hidden px-4 pb-20 pt-28 text-white sm:px-6 lg:pt-36">
        <div className="relative z-10 flex max-w-4xl flex-col items-center text-center">
          <h1 className="hero-title max-w-4xl text-white">
            <WordReveal
              lines={['Your next referral is', 'hiding in the job post.']}
              reduceMotion={shouldReduceMotion}
            />
          </h1>
          <motion.p
            className="hero-subtitle mt-6 max-w-2xl text-white/90"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring490(1.2)}
          >
            Reachard finds the insiders, ranks the strongest paths, and drafts the message that gets you in.
          </motion.p>
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring490(1.3)}
          >
            <Link href="/sign-up" className="reachard-mountain-button chrome-cta-button mt-9 text-white">
              <span className="reachard-mountain-button__border" aria-hidden="true" />
              <span className="relative z-10 inline-flex items-center justify-center gap-[6px]">
                <Chrome />
                <span>Add to Chrome</span>
              </span>
            </Link>
          </motion.div>
        </div>

        <div className="relative z-10 mt-14 w-full max-w-6xl lg:mt-[72px]" style={{ perspective: 800 }}>
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, z: 100, y: 200 }}
            animate={{ opacity: 1, z: 0, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    delay: 1.5,
                    z: { type: 'spring', stiffness: 400, damping: 120, mass: 3, delay: 1.5 },
                    y: { type: 'spring', stiffness: 200, damping: 40, delay: 1.5 },
                    opacity: { duration: 0.5, delay: 1.5 }
                  }
            }
            style={{ transformStyle: 'preserve-3d' }}
          >
            <BrowserScene onDraftIntro={scrollToDraft} reduceMotion={shouldReduceMotion} />
          </motion.div>
        </div>
      </section>

      <section id="docs" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="apple-card p-6">
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Mail className="h-4 w-4" />
            Draft preview
          </div>
          <div className="apple-soft-card p-5 text-base font-medium leading-7 text-foreground">
            <p>Hi Jenny -</p>
            <p className="mt-4">
              I&apos;m a Berkeley student interested in product and payments infrastructure. I saw Stripe&apos;s Senior Product Manager role and wanted to ask one thoughtful question about the team.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={copyDraft}
              className="button-text inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-foreground transition-[background,transform] duration-200 ease-out hover:bg-secondary active:scale-[0.98]"
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={gmailUrl}
              target="_blank"
              rel="noreferrer"
              className="button-text inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-primary-foreground transition-[background,transform] duration-200 ease-out hover:bg-primary/90 active:scale-[0.98]"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Gmail
            </a>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}

function spring490(delay: number) {
  return { type: 'spring' as const, stiffness: 490, damping: 130, delay };
}

function WordReveal({ lines, reduceMotion }: { lines: string[]; reduceMotion: boolean | null }) {
  return (
    <>
      {lines.map((line, lineIndex) => {
        const words = line.split(' ');
        const lineDelay = lineIndex === 0 ? 0 : 0.5;

        return (
          <span
            key={line}
            className={`hero-reveal-line ${lineIndex > 0 ? 'hero-reveal-line--second' : ''}`}
          >
            {words.map((word, wordIndex) => (
              <span key={`${word}-${wordIndex}`}>
                <motion.span
                  className="inline-block"
                  initial={reduceMotion ? false : { y: '1.45em' }}
                  animate={{ y: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 900, damping: 70, delay: lineDelay + wordIndex * 0.1 }
                  }
                >
                  {word}
                </motion.span>
                {wordIndex < words.length - 1 ? ' ' : null}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

function LandingFooter() {
  const footerSections = [
    {
      title: 'Product',
      links: [
        { label: 'Add to Chrome', href: '/sign-up' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Dashboard', href: '/dashboard' }
      ]
    },
    {
      title: 'Account',
      links: [
        { label: 'Log in', href: '/sign-in' },
        { label: 'Create account', href: '/sign-up' }
      ]
    }
  ];

  return (
    <footer className="mt-10 text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 border-b border-border pb-10 sm:grid-cols-[1fr_auto_auto] sm:gap-16">
          <div className="flex min-h-36 flex-col justify-between gap-10">
            <Link href="/" className="flex w-fit items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-base font-semibold text-primary-foreground">
                R
              </span>
              <span className="text-xl font-semibold">Reachard</span>
            </Link>

            <div className="w-fit rounded-full bg-card px-3 py-2 text-sm font-semibold text-foreground">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Contact search is available
            </div>
          </div>

          {footerSections.map((section) => (
            <nav key={section.title} aria-label={section.title} className="min-w-36">
              <h2 className="nav-link text-foreground">{section.title}</h2>
              <div className="mt-4 flex flex-col items-start gap-3">
                {section.links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-link text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          ))}
        </div>

        <div className="secondary flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright 2026 Reachard. All rights reserved.</p>
          <p>Built for focused outreach from LinkedIn job pages.</p>
        </div>
      </div>
    </footer>
  );
}

function BrowserScene({ onDraftIntro, reduceMotion }: { onDraftIntro: () => void; reduceMotion: boolean | null }) {
  return (
    <div className="rounded-[18px] border border-white/55 bg-white/55 p-3 shadow-[0_28px_90px_rgba(30,80,170,0.22)] backdrop-blur-xl">
      <motion.div
        className="mb-3 flex h-8 items-center gap-2 rounded-[12px] bg-white/55 px-3"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring490(1.7)}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="secondary ml-4 flex-1 rounded-full bg-secondary px-3 py-1">
          linkedin.com/jobs/view/senior-product-manager
        </div>
      </motion.div>
      <div className="grid min-h-[500px] gap-3 overflow-hidden rounded-[14px] bg-secondary p-4 lg:grid-cols-[1fr_360px]">
        <motion.div
          className="rounded-[14px] bg-card p-7"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring490(1.8)}
        >
          <p className="label">LinkedIn job post</p>
          <h2 className="section-title mt-10">Senior Product Manager</h2>
          <p className="secondary mt-2">Stripe - San Francisco</p>
          <div className="mt-10 h-3 w-4/5 rounded-full bg-secondary" />
          <div className="mt-3 h-3 w-2/3 rounded-full bg-secondary" />
          <div className="mt-3 h-3 w-3/4 rounded-full bg-secondary" />
        </motion.div>

        <motion.aside
          className="rounded-[14px] bg-[#1c1c1e] p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { scale: { duration: 0.5, ease: [0.4, 0, 0, 1], delay: 1.9 }, opacity: { duration: 0.5, ease: [0.4, 0, 0, 1], delay: 1.9 } }}
        >
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-primary text-xs font-semibold text-white">R</span>
              <span className="font-medium tracking-[-0.015em] text-white">Reachard</span>
            </div>
            <span className="card-text">job - people - outreach</span>
          </div>

          <p className="card-text">Best match</p>
          <div className="mt-4 space-y-4">
            {people.map((person) => (
              <article key={person.name} className="rounded-[12px] bg-white/[0.08] p-4">
                <h3 className="text-[15px] font-medium leading-[1.45] tracking-[-0.015em] text-white">{person.name}</h3>
                <p className="card-text mt-1">{person.role}</p>
                <div className="card-text mt-4 space-y-1">
                  {person.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
                {person.name === 'Jenny Wilson' ? (
                  <button
                    type="button"
                    onClick={onDraftIntro}
                    className="button-text mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-[#1d1d1f] transition-transform duration-200 ease-out active:scale-[0.98]"
                  >
                    Draft intro
                  </button>
                ) : (
                  <Link
                    href="/sign-up"
                    className="button-text mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-[#1d1d1f] transition-transform duration-200 ease-out active:scale-[0.98]"
                  >
                    View contact
                  </Link>
                )}
              </article>
            ))}
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
