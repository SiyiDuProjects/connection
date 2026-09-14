import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';

export const metadata = {
  title: `Terms of Service | ${BRAND_NAME}`
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-28 text-foreground">
      <article className="legal-copy">
        <p className="text-sm font-semibold text-muted">Effective September 13, 2026</p>
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
          {BRAND_NAME} charges a recurring monthly membership fee. Base at $9 per month includes 50 newly unlocked, verified work emails per billing period. Its allowance refreshes at the start of each paid billing period; unused monthly unlocks do not roll over. Plus at $19 per month includes unlimited verified work email unlocks for personal use, with no monthly email cap. The price and billing interval are shown before purchase. Earlier subscriptions retain the price and allowance associated with their existing plan unless you choose to change plans.
        </p>
        <p>
          Only a newly unlocked, verified work email uses one email credit on a limited plan. Unsuccessful lookups, viewing an email already unlocked by your account, people searches and draft generation do not use email credits. We do not automatically charge overage fees. A limited plan cannot unlock more new emails after its allowance is used until the allowance refreshes or you change plans.
        </p>
        <p>
          Subscriptions renew until canceled. You can manage or cancel renewal through the Stripe billing portal. Deleting an owner account schedules its active subscription to stop renewing. Chargebacks, refunds, promotions, and trial eligibility may affect access or balances.
        </p>

        <p>
          New verified accounts can try 3 successful work-email unlocks without a payment card. This trial does not automatically start a subscription or charge you. One trial is available per verified email address, including after deleting and recreating an account. To prevent abuse, the trial allows up to 20 people searches, 30 email-lookup attempts and 12 drafts for contacts you unlocked. Unsuccessful lookups do not use your 3 email unlocks. A paid membership is required after the free allowance or a trial feature limit is reached.
        </p>

        <h2 id="personal-use">Personal use and service protection</h2>
        <p>
          Base and Plus are for one person&apos;s own professional outreach. Do not share accounts, use scripts or bots to automate bulk contact harvesting, resell contact data, or use an individual plan to run outreach for multiple people. Organizations can contact <a href="mailto:support@reachard.co">support@reachard.co</a> to discuss their needs.
        </p>
        <p>
          Plus has no monthly email allowance to exhaust. Request rate limits and temporary service protections may delay requests to protect account security and service availability. They are not a hidden monthly email cap. Access may be restricted for the prohibited uses described above; data availability and the availability of third-party providers still apply.
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
