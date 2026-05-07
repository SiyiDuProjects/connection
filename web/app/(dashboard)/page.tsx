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
    <main className="min-h-screen overflow-hidden bg-[#062f2a] text-white">
      <section className="relative isolate min-h-screen overflow-hidden bg-[#0F766E]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_24%_16%,rgba(255,255,255,0.20),transparent_30%),radial-gradient(circle_at_78%_18%,rgba(217,185,115,0.20),transparent_26%),linear-gradient(135deg,#063f39_0%,#0F766E_48%,#04231f_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[#062f2a]" />
        <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 pb-20 pt-28 sm:px-6 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="max-w-xl">
          <p className="mb-6 inline-flex rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-sm font-medium text-emerald-50 backdrop-blur-xl">
            AI beside your job applications
          </p>
          <h1 className="text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-7xl">
            Turn job posts into warm introductions.
          </h1>
          <p className="mt-6 text-xl font-medium text-emerald-50/78">
            Find the right people behind every application.
          </p>
          <Button asChild className="mt-9 h-11 rounded-[8px] bg-white px-5 text-sm font-medium text-[#0b3d37] shadow-[0_18px_50px_rgba(2,44,34,0.30)] hover:bg-[#ecfdf5]">
            <Link href="/sign-up">
              <Chrome className="mr-2 h-4 w-4" />
              Add to Chrome
            </Link>
          </Button>
        </div>

        <BrowserScene />
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-3 md:grid-cols-3">
          {workflow.map((step, index) => (
            <div key={step} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
              <p className="text-sm font-medium text-[#d9b973]">0{index + 1}</p>
              <h2 className="mt-8 text-xl font-semibold text-white">{step}</h2>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-medium text-[#d9b973]">Reasoning engine</p>
          <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight text-white">
            Reachard explains why someone matters.
          </h2>
        </div>
        <div className="rounded-[8px] border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
          <p className="text-sm font-medium text-emerald-50/62">Why matched</p>
          <div className="mt-5 space-y-4 text-lg font-medium text-emerald-50">
            <p>Hiring-side signal</p>
            <p>Product org overlap</p>
            <p>Berkeley alumni path</p>
          </div>
        </div>
      </section>

      <section id="docs" className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[8px] border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-emerald-50/66">
            <Mail className="h-4 w-4" />
            Draft preview
          </div>
          <div className="rounded-[8px] bg-[#ecfdf5] p-5 text-base font-medium leading-7 text-[#0b3d37]">
            <p>Hi Jenny -</p>
            <p className="mt-4">
              I&apos;m a Berkeley student interested in product and payments infrastructure. I saw Stripe&apos;s Senior Product Manager role and wanted to ask one thoughtful question about the team.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="inline-flex h-9 items-center rounded-[8px] border border-white/18 bg-white/10 px-3 text-sm font-medium text-white">
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </button>
            <button className="inline-flex h-9 items-center rounded-[8px] bg-white px-3 text-sm font-medium text-[#0b3d37]">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Gmail
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-end rounded-[8px] border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Job to people to outreach.
          </h2>
          <Button asChild className="mt-8 h-11 w-fit rounded-[8px] bg-white px-5 text-sm font-medium text-[#0b3d37] shadow-none hover:bg-[#ecfdf5]">
            <Link href="/sign-up">Add to Chrome</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function BrowserScene() {
  return (
    <div className="rounded-[8px] border border-white/16 bg-white/10 p-3 shadow-[0_30px_110px_rgba(2,44,34,0.35)] backdrop-blur-xl">
      <div className="mb-3 flex h-8 items-center gap-2 rounded-[8px] bg-white/16 px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="ml-4 flex-1 rounded-[8px] bg-white/14 px-3 py-1 text-xs font-medium text-emerald-50/56">
          linkedin.com/jobs/view/senior-product-manager
        </div>
      </div>
      <div className="grid min-h-[500px] gap-3 overflow-hidden rounded-[8px] bg-[#073f39] p-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[8px] bg-[#f3fbf7] p-7">
          <p className="text-sm font-medium text-[#0F766E]/62">LinkedIn job post</p>
          <h2 className="mt-10 text-3xl font-semibold text-[#092f2a]">Senior Product Manager</h2>
          <p className="mt-2 text-base font-medium text-[#42635f]">Stripe - San Francisco</p>
          <div className="mt-10 h-3 w-4/5 rounded-full bg-[#d9ebe4]" />
          <div className="mt-3 h-3 w-2/3 rounded-full bg-[#d9ebe4]" />
          <div className="mt-3 h-3 w-3/4 rounded-full bg-[#d9ebe4]" />
        </div>

        <aside className="rounded-[8px] border border-white/10 bg-[#062f2a]/92 p-5 text-white shadow-[0_20px_60px_rgba(2,44,34,0.32)] backdrop-blur-2xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#0b3d37]">G</span>
              <span className="font-medium">Reachard</span>
            </div>
            <span className="text-xs font-medium text-emerald-50/52">job - people - outreach</span>
          </div>

          <p className="text-sm font-medium text-[#d9b973]">Best match</p>
          <div className="mt-4 space-y-4">
            {people.map((person) => (
              <article key={person.name} className="rounded-[8px] border border-white/8 bg-white/[0.07] p-4">
                <h3 className="text-base font-medium text-white">{person.name}</h3>
                <p className="mt-1 text-sm font-medium text-emerald-50/56">{person.role}</p>
                <div className="mt-4 space-y-1 text-sm font-medium text-emerald-50/76">
                  {person.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
                <button className="mt-5 h-9 rounded-[8px] bg-white px-3 text-sm font-medium text-[#0b3d37]">
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
