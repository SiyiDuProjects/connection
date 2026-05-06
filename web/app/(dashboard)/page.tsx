'use client';

import Link from 'next/link';
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

const workflow = [
  'Open a job post',
  'Find the right people',
  'Draft thoughtful outreach'
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.10),transparent_40%)] text-slate-950">
      <section className="mx-auto grid min-h-[calc(100dvh-56px)] max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="max-w-xl">
          <p className="mb-6 inline-flex rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 backdrop-blur-xl">
            AI beside your job applications
          </p>
          <h1 className="text-5xl font-semibold leading-none text-slate-950 sm:text-6xl lg:text-7xl">
            Turn job posts into warm introductions.
          </h1>
          <p className="mt-6 text-xl font-medium text-slate-500">
            Find the right people behind every application.
          </p>
          <Button asChild className="mt-9 h-11 rounded-[8px] bg-slate-950 px-5 text-sm font-medium text-white shadow-none hover:bg-slate-800">
            <Link href="/sign-up">
              <Chrome className="mr-2 h-4 w-4" />
              Add to Chrome
            </Link>
          </Button>
        </div>

        <BrowserScene />
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-3 md:grid-cols-3">
          {workflow.map((step, index) => (
            <div key={step} className="rounded-[8px] border border-slate-900/[0.06] bg-white/70 p-6 backdrop-blur-xl">
              <p className="text-sm font-medium text-slate-400">0{index + 1}</p>
              <h2 className="mt-8 text-xl font-semibold text-slate-950">{step}</h2>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-medium text-slate-500">Reasoning engine</p>
          <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight text-slate-950">
            Gaid explains why someone matters.
          </h2>
        </div>
        <div className="rounded-[8px] border border-slate-900/[0.06] bg-white/72 p-6 backdrop-blur-xl">
          <p className="text-sm font-medium text-slate-500">Why matched</p>
          <div className="mt-5 space-y-4 text-lg font-medium text-slate-800">
            <p>Hiring-side signal</p>
            <p>Product org overlap</p>
            <p>Berkeley alumni path</p>
          </div>
        </div>
      </section>

      <section id="docs" className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[8px] border border-slate-900/[0.06] bg-white/72 p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Mail className="h-4 w-4" />
            Draft preview
          </div>
          <div className="rounded-[8px] bg-[#f8fafc] p-5 text-base font-medium leading-7 text-slate-700">
            <p>Hi Jenny -</p>
            <p className="mt-4">
              I&apos;m a Berkeley student interested in product and payments infrastructure. I saw Stripe&apos;s Senior Product Manager role and wanted to ask one thoughtful question about the team.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="inline-flex h-9 items-center rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </button>
            <button className="inline-flex h-9 items-center rounded-[8px] bg-slate-950 px-3 text-sm font-medium text-white">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Gmail
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-end rounded-[8px] border border-slate-900/[0.06] bg-white/72 p-6 backdrop-blur-xl">
          <h2 className="text-3xl font-semibold leading-tight text-slate-950">
            Job to people to outreach.
          </h2>
          <Button asChild className="mt-8 h-11 w-fit rounded-[8px] bg-slate-950 px-5 text-sm font-medium text-white shadow-none hover:bg-slate-800">
            <Link href="/sign-up">Add to Chrome</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function BrowserScene() {
  return (
    <div className="rounded-[8px] border border-slate-900/[0.06] bg-white/72 p-3 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-xl">
      <div className="mb-3 flex h-8 items-center gap-2 rounded-[8px] bg-white/70 px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="ml-4 flex-1 rounded-[8px] bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400">
          linkedin.com/jobs/view/senior-product-manager
        </div>
      </div>
      <div className="grid min-h-[500px] gap-3 overflow-hidden rounded-[8px] bg-[#eef2f7] p-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[8px] bg-white p-7">
          <p className="text-sm font-medium text-slate-400">LinkedIn job post</p>
          <h2 className="mt-10 text-3xl font-semibold text-slate-950">Senior Product Manager</h2>
          <p className="mt-2 text-base font-medium text-slate-500">Stripe - San Francisco</p>
          <div className="mt-10 h-3 w-4/5 rounded-full bg-slate-100" />
          <div className="mt-3 h-3 w-2/3 rounded-full bg-slate-100" />
          <div className="mt-3 h-3 w-3/4 rounded-full bg-slate-100" />
        </div>

        <aside className="rounded-[8px] border border-white/10 bg-slate-950/75 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] backdrop-blur-2xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-950">G</span>
              <span className="font-medium">Gaid</span>
            </div>
            <span className="text-xs font-medium text-slate-400">job - people - outreach</span>
          </div>

          <p className="text-sm font-medium text-slate-400">Best match</p>
          <div className="mt-4 space-y-4">
            {people.map((person) => (
              <article key={person.name} className="rounded-[8px] bg-white/[0.06] p-4">
                <h3 className="text-base font-medium text-white">{person.name}</h3>
                <p className="mt-1 text-sm font-medium text-slate-400">{person.role}</p>
                <div className="mt-4 space-y-1 text-sm font-medium text-slate-300">
                  {person.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
                <button className="mt-5 h-9 rounded-[8px] bg-white px-3 text-sm font-medium text-slate-950">
                  {person.name === 'Jenny Wilson' ? 'Draft intro' : 'View contact'}
                </button>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
