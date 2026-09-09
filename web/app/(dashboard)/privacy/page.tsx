import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';

export const metadata = {
  title: `Privacy Policy | ${BRAND_NAME}`
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-28 text-foreground">
      <article className="legal-copy">
        <p className="text-sm font-semibold text-muted">Last updated September 7, 2026</p>
        <h1>{BRAND_NAME} Privacy Policy</h1>
        <p>
          {BRAND_NAME} helps job seekers identify relevant company contacts and prepare personalized outreach. This policy explains what the {BRAND_NAME} website and browser extension process and why.
        </p>

        <h2>Information we process</h2>
        <ul>
          <li>Account information such as name, email address, authentication data, subscription status, and remaining included usage.</li>
          <li>Profile information you choose to save, including school, region, resume context, and outreach preferences.</li>
          <li>Job, company, and public professional-profile context from the page where you invoke {BRAND_NAME}, including the page URL, job description, company, title, and selected contact.</li>
          <li>Product usage and reliability data, such as searches, reveals, drafts, request status, and timestamps.</li>
        </ul>

        <h2>How the extension works</h2>
        <p>
          The extension reads supported page content locally so it can recognize a job, company, or professional-profile page. Job, company, and profile details are sent to {BRAND_NAME} when you ask it to search, reveal a work email, or create a draft. When you choose Sign in from a page, its URL may also be included in the sign-in return link so you can resume where you left off. {BRAND_NAME} does not sell browsing history, run advertising profiles, or send messages on your behalf.
        </p>
        <p>
          Authentication tokens and recent account status are stored in Chrome local storage. Configured {BRAND_NAME} URLs may use Chrome sync storage. The extension keeps current search results and drafts while its panel is open. They are not a durable saved-contact or sent-mail archive.
        </p>

        <h2>Service providers</h2>
        <p>We share only the information needed to deliver the requested feature with service providers such as:</p>
        <ul>
          <li>Treg for company-contact search and work-email lookups through providers including Icypeas and Apollo; RapidAPI for school and location suggestions;</li>
          <li>OpenAI for contact-query planning and outreach drafting;</li>
          <li>Stripe for subscriptions and billing;</li>
          <li>Resend for account verification, password recovery, and account security emails;</li>
          <li>database, hosting, security, and infrastructure providers used to operate {BRAND_NAME}.</li>
        </ul>
        <p>We do not request personal email addresses or phone numbers from the contact reveal flow.</p>

        <h2>Retention and deletion</h2>
        <p>
          Account profile and resume context are retained while your account is active. Deleting an account revokes extension access, schedules an owner subscription to stop renewing, removes saved profile settings and verification tokens, clears cached API results, removes the account name and password hash, and replaces the sign-in email with a random deletion identifier. Limited billing, security, fraud-prevention, and usage records may be retained where reasonably necessary for accounting, legal obligations, or dispute handling.
        </p>

        <p>We retain a fingerprint of the verified email address used for a free trial to prevent repeated claims after account deletion.</p>

        <h2>Your choices</h2>
        <ul>
          <li>You can edit saved profile and outreach settings from the dashboard.</li>
          <li>You can disconnect the extension by signing out or revoking its token.</li>
          <li>You can delete your account from Settings.</li>
          <li>You always review and send outreach yourself.</li>
        </ul>

        <h2>Chrome Web Store Limited Use</h2>
        <p>
          {BRAND_NAME}&apos;s use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. We use extension data only to provide or improve the user-facing {BRAND_NAME} features described above.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy as the product or its providers change. Material changes to extension data practices will be disclosed before they take effect.
        </p>

        <p>
          For privacy requests, use the account controls in {BRAND_NAME} or email <a href="mailto:support@reachard.co">support@reachard.co</a>.
        </p>
        <p><Link href="/terms">Read the Terms of Service</Link></p>
      </article>
    </main>
  );
}
