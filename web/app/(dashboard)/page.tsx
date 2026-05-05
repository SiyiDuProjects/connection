'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail, Search, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language-provider';

export default function HomePage() {
  const { t } = useI18n();
  const flow = [
    { title: t('home.flow1Title'), body: t('home.flow1Body') },
    { title: t('home.flow2Title'), body: t('home.flow2Body') },
    { title: t('home.flow3Title'), body: t('home.flow3Body') }
  ];
  const contacts = [
    { name: 'Maya Chen', role: 'Senior Technical Recruiter', reason: t('home.contact1Reason') },
    { name: 'Jordan Lee', role: 'Engineering Manager', reason: t('home.contact2Reason') },
    { name: 'Avery Patel', role: t('home.contact3Role'), reason: t('home.contact3Reason') }
  ];

  return (
    <main className="bg-white">
      <section className="border-b border-gray-200">
        <div className="mx-auto grid min-h-[calc(100dvh-69px)] max-w-7xl content-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
              {t('home.eyebrow')}
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-gray-950 sm:text-6xl lg:text-7xl">
              Gaid
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              {t('home.description')}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-md">
                <Link href="/sign-up">
                  {t('home.startFree')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-md">
                <Link href="/pricing">{t('home.viewPricing')}</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gray-950" /> {t('home.accountAccess')}</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gray-950" /> {t('home.creditsShown')}</span>
            </div>
          </div>

          <div className="self-center">
            <div className="border border-gray-200 bg-gray-50 p-4 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="border border-gray-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-950">{t('home.linkedinJob')}</p>
                    <span className="text-xs text-gray-500">{t('home.chromeExtension')}</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-950">{t('home.jobTitle')}</p>
                      <p className="text-gray-600">{t('home.jobLocation')}</p>
                    </div>
                    <button className="w-full rounded-md bg-[#0a66c2] px-3 py-2 text-sm font-semibold text-white">
                      {t('home.findWithGaid')}
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-950">{t('home.topMatches')}</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{t('home.creditsLeft')}</span>
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
                    <p className="text-sm font-medium text-gray-950">{t('home.gmailDraftReady')}</p>
                    <p className="mt-1 text-sm text-gray-600">{t('home.gmailDraftBody')}</p>
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
