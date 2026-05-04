import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail, Search, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const flow = [
  { title: 'Choose a LinkedIn job', body: 'Open the job post you are applying to and start from the extension.' },
  { title: 'Find company contacts', body: 'Rank recruiters, hiring managers, team leads, and alumni by relevance.' },
  { title: 'Draft in Gmail', body: 'Reveal an email, then generate a personalized draft from your profile.' }
];

const contacts = [
  { name: 'Maya Chen', role: 'Senior Technical Recruiter', reason: 'Recruiting role, near job location, email likely' },
  { name: 'Jordan Lee', role: 'Engineering Manager', reason: 'Engineering relevance, senior contact' },
  { name: 'Avery Patel', role: 'UC Berkeley alum, Product Lead', reason: 'Alumni signal, team relevance' }
];

export default function HomePage() {
  return (
    <main className="bg-white">
      <section className="border-b border-gray-200">
        <div className="mx-auto grid min-h-[calc(100dvh-69px)] max-w-7xl content-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
              Personal cold email assistant for job seekers
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-gray-950 sm:text-6xl lg:text-7xl">
              Connection
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              Turn a LinkedIn job post into the right company contacts, verified email reveals, and Gmail drafts that use your background, role target, and preferred tone.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-md">
                <Link href="/sign-up">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-md">
                <Link href="/pricing">View pricing</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-md">
                <Link href="/connect-extension">Connect extension</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gray-950" /> Website-controlled account access</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gray-950" /> Credits shown before actions</span>
            </div>
          </div>

          <div className="self-center">
            <div className="border border-gray-200 bg-gray-50 p-4 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="border border-gray-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-950">LinkedIn job</p>
                    <span className="text-xs text-gray-500">Chrome extension</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-950">Software Engineer Intern</p>
                      <p className="text-gray-600">Figma · San Francisco Bay Area</p>
                    </div>
                    <button className="w-full rounded-md bg-[#0a66c2] px-3 py-2 text-sm font-semibold text-white">
                      Find Contacts
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-950">Top matches</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">42 credits left</span>
                  </div>
                  <div className="space-y-3">
                    {contacts.map((contact) => (
                      <div key={contact.name} className="border border-gray-200 p-3">
                        <p className="text-sm font-medium text-gray-950">{contact.name}</p>
                        <p className="text-xs text-gray-600">{contact.role}</p>
                        <p className="mt-2 text-xs text-gray-500">{contact.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-rose-700" />
                  <div>
                    <p className="text-sm font-medium text-gray-950">Gmail draft ready</p>
                    <p className="mt-1 text-sm text-gray-600">Uses your target role, background summary, preferred contact type, and tone.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        {flow.map((step, index) => (
          <div key={step.title} className="border-t border-gray-200 pt-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-gray-950 text-white">
              {index === 0 ? <Search className="h-5 w-5" /> : index === 1 ? <Users className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
            </div>
            <h2 className="text-lg font-medium text-gray-950">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{step.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
