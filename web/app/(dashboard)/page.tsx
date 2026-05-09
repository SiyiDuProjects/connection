'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Chrome, Copy, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 pb-14 pt-24 sm:px-6 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="max-w-xl">
          <h1 className="text-5xl font-semibold leading-none text-foreground sm:text-6xl lg:text-7xl">
            Your next referral is hiding in the job post.
          </h1>
          <p className="mt-6 text-xl font-medium leading-8 text-muted-foreground">
            Reachard finds the insiders, ranks the strongest paths, and drafts the message that gets you in.
          </p>
          <Button asChild className="mt-9 px-5">
            <Link href="/sign-up">
              <Chrome className="mr-2 h-4 w-4" />
              Add to Chrome
            </Link>
          </Button>
        </div>

        <BrowserScene onDraftIntro={scrollToDraft} />
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
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-[background,transform] duration-200 ease-out hover:bg-secondary active:scale-[0.98]"
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={gmailUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background,transform] duration-200 ease-out hover:bg-primary/90 active:scale-[0.98]"
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
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <div className="mt-4 flex flex-col items-start gap-3">
                {section.links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-3 pt-5 text-sm font-medium text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright 2026 Reachard. All rights reserved.</p>
          <p>Built for focused outreach from LinkedIn job pages.</p>
        </div>
      </div>
    </footer>
  );
}

function BrowserScene({ onDraftIntro }: { onDraftIntro: () => void }) {
  return (
    <div className="rounded-[18px] border border-border bg-card p-3 shadow-apple-float">
      <div className="mb-3 flex h-8 items-center gap-2 rounded-[12px] bg-card px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="ml-4 flex-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          linkedin.com/jobs/view/senior-product-manager
        </div>
      </div>
      <div className="grid min-h-[500px] gap-3 overflow-hidden rounded-[14px] bg-secondary p-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[14px] bg-card p-7">
          <p className="text-sm font-medium text-muted-foreground">LinkedIn job post</p>
          <h2 className="mt-10 text-3xl font-semibold text-foreground">Senior Product Manager</h2>
          <p className="mt-2 text-base font-medium text-muted-foreground">Stripe - San Francisco</p>
          <div className="mt-10 h-3 w-4/5 rounded-full bg-secondary" />
          <div className="mt-3 h-3 w-2/3 rounded-full bg-secondary" />
          <div className="mt-3 h-3 w-3/4 rounded-full bg-secondary" />
        </div>

        <aside className="rounded-[14px] bg-[#1c1c1e] p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-primary text-xs font-semibold text-white">R</span>
              <span className="font-medium">Reachard</span>
            </div>
            <span className="text-xs font-medium text-white/55">job - people - outreach</span>
          </div>

          <p className="text-sm font-medium text-white/55">Best match</p>
          <div className="mt-4 space-y-4">
            {people.map((person) => (
              <article key={person.name} className="rounded-[12px] bg-white/[0.08] p-4">
                <h3 className="text-base font-medium text-white">{person.name}</h3>
                <p className="mt-1 text-sm font-medium text-white/55">{person.role}</p>
                <div className="mt-4 space-y-1 text-sm font-medium text-white/75">
                  {person.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
                {person.name === 'Jenny Wilson' ? (
                  <button
                    type="button"
                    onClick={onDraftIntro}
                    className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#1d1d1f] transition-transform duration-200 ease-out active:scale-[0.98]"
                  >
                    Draft intro
                  </button>
                ) : (
                  <Link
                    href="/sign-up"
                    className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#1d1d1f] transition-transform duration-200 ease-out active:scale-[0.98]"
                  >
                    View contact
                  </Link>
                )}
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
