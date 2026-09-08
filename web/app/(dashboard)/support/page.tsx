import { BRAND_NAME } from '@/lib/brand';
import Link from 'next/link';

export const metadata = {
  title: `Support | ${BRAND_NAME}`
};

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-28 text-foreground">
      <article className="legal-copy">
        <h1>{BRAND_NAME} Support</h1>
        <p>
          Need help? Email <a href="mailto:support@reachard.co">support@reachard.co</a>.
          Include your account email, the error message, and the page URL if relevant.
          Please do not include passwords or payment card details.
        </p>

        <h2>Sign in and connect</h2>
        <p>
          <Link href="/sign-in">Sign in on the {BRAND_NAME} website</Link> to connect your installed extension automatically.
          Then return to the company or job page and open {BRAND_NAME}.
        </p>

        <h2>Use the extension</h2>
        <p>
          Use Chrome 141 or later. Open a company website or job posting, then click the {BRAND_NAME} page launcher
          or extension toolbar icon. Enter a target role if needed and choose Find people here.
        </p>

        <h2>Billing and cancellations</h2>
        <p>
          For billing questions, email <a href="mailto:support@reachard.co">support@reachard.co</a>.
          To manage or cancel your subscription, open your account&apos;s <Link href="/dashboard/billing">billing settings</Link>
          {' '}and choose Manage billing or cancel.
        </p>

        <p>
          <Link href="/pricing">View plans</Link> · <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link>
        </p>
      </article>
    </main>
  );
}
