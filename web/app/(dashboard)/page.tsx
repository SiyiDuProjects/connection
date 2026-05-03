import Link from 'next/link';
import { ArrowRight, Mail, Search, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  {
    icon: Search,
    title: 'Read the LinkedIn job',
    body: 'Open a job post and let the extension capture company, role, and location context.'
  },
  {
    icon: Users,
    title: 'Find relevant contacts',
    body: 'Search for recruiters, hiring managers, and team leads ranked against the role.'
  },
  {
    icon: Mail,
    title: 'Draft outreach',
    body: 'Reveal emails and create Gmail drafts using your saved profile and tone.'
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="border-b bg-white">
        <div className="mx-auto grid min-h-[calc(100dvh-69px)] max-w-7xl content-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-gray-500">
              LinkedIn jobs to warm outreach
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-gray-950 sm:text-6xl lg:text-7xl">
              Find the right contact for every job post.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              Connection turns a LinkedIn job into relevant company contacts,
              verified email reveals, and outreach drafts backed by your
              website account, plan, and credits.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-md">
                <Link href="/sign-up">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-md">
                <Link href="/pricing">Pricing</Link>
              </Button>
            </div>
          </div>

          <div className="self-center border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <div className="space-y-5">
              {steps.map((step) => (
                <div key={step.title} className="flex gap-4 border-b border-gray-200 pb-5 last:border-0 last:pb-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-950 text-white">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-medium text-gray-950">{step.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-3 border-t border-gray-200 pt-5 text-sm text-gray-600">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gray-950" />
              <p>
                Authorization is checked server-side. The extension only stores
                a bound token and never decides access locally.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
