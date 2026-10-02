import { BRAND_MARK_PATH, BRAND_NAME } from '@/lib/brand';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Appearance } from '@/components/appearance';
import { LocalTestBanner } from '@/components/local-test-banner';
import { localTestEnabled } from '@/lib/auth/local-test-policy';

export const metadata: Metadata = {
  title: BRAND_NAME,
  applicationName: BRAND_NAME,
  icons: { icon: BRAND_MARK_PATH, apple: BRAND_MARK_PATH },
  description: 'Open a job post, identify the people worth contacting, and draft thoughtful outreach.'
};

export const viewport: Viewport = {};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="bg-background text-foreground"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400..800&family=Geist:wght@400;500;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-[100dvh] bg-background">
        <Appearance />
        {children}
        {localTestEnabled() && <LocalTestBanner />}
      </body>
    </html>
  );
}
