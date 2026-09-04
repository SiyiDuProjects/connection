import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Reachard'
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-28 text-foreground">
      <article className="legal-copy">
        <p className="text-sm font-semibold text-muted-foreground">Effective August 30, 2026</p>
        <h1>Reachard Privacy Policy</h1>
        <p>
          Reachard helps job seekers identify relevant company contacts and prepare personalized outreach. This policy explains what the Reachard website and browser extension process and why.
        </p>

        <h2>Information we process</h2>
        <ul>
          <li>Account information such as name, email address, authentication data, subscription status, and Contact Kit balance.</li>
          <li>Profile information you choose to save, including school, region, resume context, and outreach preferences.</li>
          <li>Job, company, and public professional-profile context from the page where you invoke Reachard, including the page URL, job description, company, title, and selected contact.</li>
          <li>Product usage and reliability data, such as searches, reveals, drafts, request status, and timestamps.</li>
        </ul>

        <h2>How the extension works</h2>
        <p>
          The extension reads supported page content locally so it can recognize a job, company, or professional-profile page. Page context is sent to Reachard only when you ask it to search, reveal a work email, or create a draft. Reachard does not sell browsing history, run advertising profiles, or send messages on your behalf.
        </p>
        <p>
          Authentication tokens and recent account status are stored in Chrome local storage. Non-sensitive preferences such as language and configured Reachard URLs may use Chrome sync storage. A short recent-find history is stored locally on the device.
        </p>

        <h2>Service providers</h2>
        <p>We share only the information needed to deliver the requested feature with service providers such as:</p>
        <ul>
          <li>contact-search and work-email providers, currently Fresh LinkedIn Scraper through RapidAPI and Apollo;</li>
          <li>OpenAI for contact-query planning and outreach drafting;</li>
          <li>Stripe for subscriptions and billing;</li>
          <li>database, hosting, security, and infrastructure providers used to operate Reachard.</li>
        </ul>
        <p>We do not request personal email addresses or phone numbers from the contact reveal flow.</p>

        <h2>Retention and deletion</h2>
        <p>
          Account profile and resume context are retained while your account is active. Deleting an account revokes extension access, schedules an owner subscription to stop renewing, removes saved profile settings and verification tokens, and anonymizes the account email. Limited billing, security, fraud-prevention, and usage records may be retained where reasonably necessary for accounting, legal obligations, or dispute handling.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>You can edit saved profile and outreach settings from the dashboard.</li>
          <li>You can disconnect the extension by signing out or revoking its token.</li>
          <li>You can delete your account from Security settings.</li>
          <li>You always review and send outreach yourself.</li>
        </ul>

        <h2>Chrome Web Store Limited Use</h2>
        <p>
          Reachard&apos;s use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. We use extension data only to provide or improve the user-facing Reachard features described above.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy as the product or its providers change. Material changes to extension data practices will be disclosed before they take effect.
        </p>

        <p>
          For privacy requests, use the account controls in Reachard or email <a href="mailto:support@reachard.co">support@reachard.co</a>.
        </p>
        <p><Link href="/terms">Read the Terms of Service</Link></p>
      </article>
    </main>
  );
}
