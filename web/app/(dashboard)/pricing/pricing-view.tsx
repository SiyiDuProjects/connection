'use client';
import { BRAND_NAME } from '@/lib/brand';

import { useState } from 'react';
import { Button, Card, Tabs } from '@heroui/react';
import { Building2, Chrome, Mail, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { MarketingHeader } from '@/components/reachard/design';
import { SubmitButton } from './submit-button';

type Plan = {
  name: 'Base' | 'Plus';
  credits: number;
  price: number | null;
  currency: string;
  interval: string | null;
  trialDays: number;
  priceId: string | null;
};

export function PricingView({ plans, checkoutAction }: {
  plans: Plan[];
  checkoutAction?: (formData: FormData) => Promise<void>;
}) {
  const [audience, setAudience] = useState('individuals');
  return (
    <main className="rd-site rd-pricing min-h-screen">
      <MarketingHeader />
      <section className="rd-plans" aria-labelledby="pricing-title">
        <div className="rd-plans-heading">
          <p>Pricing</p>
          <h1 id="pricing-title">Choose your membership.</h1>
          <span>{audience === 'individuals' ? 'Monthly plans. Cancel anytime.' : `${BRAND_NAME} for the people you support.`}</span>
          {audience === 'individuals' ? <p><Link href="/sign-up" className="underline">Start with 3 free email unlocks.</Link> No card required.</p> : null}
        </div>

        <Tabs className="rd-pricing-tabs" selectedKey={audience} onSelectionChange={key => setAudience(String(key))}>
          <Tabs.ListContainer className="mx-auto w-fit max-w-full">
            <Tabs.List aria-label="Plan audience">
              <Tabs.Tab id="individuals">Individuals<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="organizations">Teams &amp; Agencies<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="individuals">
        <div className="rd-plan-grid">
          {plans.map((plan) => {
            const featured = plan.name === 'Plus';
            const configured = Boolean(plan.priceId && typeof plan.price === 'number' && plan.interval);
            return (
              <Card key={plan.name} className="rd-plan-card">
                <Card.Header className={`rd-plan-panel ${featured ? 'rd-plan-panel-plus' : ''}`}>
                  <Sparkles size={20} aria-hidden="true" />
                  <h2 className="rd-plan-name">{plan.name}</h2>
                  <p className="rd-plan-allowance">Monthly membership</p>
                  <div className="rd-plan-price">
                    <strong>{configured
                      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: plan.currency, maximumFractionDigits: 2 }).format(plan.price! / 100)
                      : '—'}</strong>
                    <span>/ month</span>
                  </div>
                  <p className="rd-plan-billing">{configured && plan.trialDays > 0 ? `${plan.trialDays}-day free trial` : 'Billed monthly'}</p>
                  {configured && checkoutAction ? (
                    <form action={checkoutAction} className="w-full">
                      <input type="hidden" name="priceId" value={plan.priceId!} />
                      <SubmitButton plan={plan.name} featured={featured} />
                    </form>
                  ) : <Button isDisabled variant={featured ? 'primary' : 'secondary'} fullWidth>Currently unavailable</Button>}
                </Card.Header>
                <Card.Content className="rd-plan-features">
                  <ul>
                    <li><Chrome size={16} aria-hidden="true" />Chrome extension</li>
                    <li><Mail size={16} aria-hidden="true" />{plan.credits} verified work emails included monthly</li>
                    <li><Sparkles size={16} aria-hidden="true" />Personalized email drafts</li>
                  </ul>
                </Card.Content>
              </Card>
            );
          })}
        </div>
        <p className="rd-plan-note">One monthly subscription. Searches and drafts included. Email allowance is used only when a verified work email is found.</p>
          </Tabs.Panel>
          <Tabs.Panel id="organizations">
            <Card className="rd-plan-card rd-org-card">
              <Card.Header className="rd-plan-panel rd-plan-panel-plus">
                <Building2 size={22} aria-hidden="true" />
                <h2 className="rd-plan-name">Teams &amp; Agencies</h2>
                <p className="rd-org-description">For study abroad agencies, career advisors and teams supporting job seekers.</p>
              </Card.Header>
              <Card.Content className="rd-org-content">
                <p>Tell us about your organization and how you’d like to use {BRAND_NAME}.</p>
                <a className="button button--primary w-full" href="mailto:support@reachard.co?subject=Teams%20%26%20Agencies%20inquiry">
                  <Mail size={16} aria-hidden="true" />Contact us
                </a>
              </Card.Content>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </section>
      <footer className="rd-pricing-footer"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></footer>
    </main>
  );
}
