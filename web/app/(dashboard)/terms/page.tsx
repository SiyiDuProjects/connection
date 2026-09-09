import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';

export const metadata = {
  title: `Terms of Service | ${BRAND_NAME}`
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-28 text-foreground">
      <article className="legal-copy">
        <p className="text-sm font-semibold text-muted">Effective August 30, 2026</p>
        <h1>{BRAND_NAME} Terms of Service</h1>
        <p>
          {BRAND_NAME} is a job-search research and writing assistant. By using {BRAND_NAME}, you agree to use it lawfully and responsibly and to review all contact information and outreach before acting on it.
        </p>

        <h2>What {BRAND_NAME} provides</h2>
        <p>
          {BRAND_NAME} can identify potentially relevant company contacts, reveal available work email addresses, rank contacts for a role, and prepare outreach drafts. {BRAND_NAME} does not guarantee a referral, response, interview, job offer, email accuracy, or continued availability of any third-party data source.
        </p>

        <h2>Your responsibilities</h2>
        <ul>
          <li>Use {BRAND_NAME} for legitimate professional outreach and comply with applicable law, website rules, and anti-spam requirements.</li>
          <li>Do not use the service for harassment, bulk unsolicited messaging, surveillance, reselling personal data, or bypassing access controls.</li>
          <li>Review the recipient, email address, claims, and draft before sending. {BRAND_NAME} does not send outreach automatically.</li>
          <li>Keep your account and extension access secure.</li>
        </ul>

        <h2>Monthly memberships and included usage</h2>
        <p>
          {BRAND_NAME} charges a recurring monthly membership fee for access to its software features. The plan price, billing interval, any trial, and included monthly work email allowance are disclosed before purchase. A successful verified work email lookup uses one included lookup; searches and draft generation do not use this allowance. We do not sell individual Contact Kits or automatically charge extra for exceeding the included allowance.
        </p>
        <p>
          Subscriptions renew until canceled. You can manage or cancel renewal through the Stripe billing portal. Deleting an owner account schedules its active subscription to stop renewing. Chargebacks, refunds, promotions, and trial eligibility may affect access or balances.
        </p>

        <p>
          New verified accounts can try 3 successful work-email unlocks without a payment card. This trial does not automatically start a subscription or charge you. One trial is available per verified email address, including after deleting and recreating an account. To prevent abuse, the trial allows up to 20 people searches, 30 email-lookup attempts and 12 drafts for contacts you unlocked. Unsuccessful lookups do not use your 3 email unlocks. A paid membership is required after the free allowance or a trial feature limit is reached.
        </p>

        <h2>Third-party services and data</h2>
        <p>
          {BRAND_NAME} depends on browsers, job sites, professional-profile pages, contact-data providers, OpenAI, Stripe, and infrastructure providers. Their availability and terms can change. You are responsible for following the terms that apply to websites and services you choose to use with {BRAND_NAME}.
        </p>

        <h2>Service changes</h2>
        <p>
          We may modify, suspend, or discontinue features when necessary for security, provider availability, legal compliance, or product improvement. We will avoid materially reducing paid plan benefits during an active billing period without reasonable notice where practical.
        </p>

        <h2>Disclaimer and limitation</h2>
        <p>
          {BRAND_NAME} is provided on an as-available basis. To the extent permitted by law, {BRAND_NAME} is not liable for employment decisions, missed opportunities, third-party data errors, messages you choose to send, or indirect or consequential losses.
        </p>

        <h2>Contact</h2>
        <p>Questions about these terms can be sent to <a href="mailto:support@reachard.co">support@reachard.co</a>.</p>

        <p><Link href="/privacy">Read the Privacy Policy</Link></p>
      </article>
    </main>
  );
}
