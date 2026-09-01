import './globals.css';
import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { LanguageProvider } from '@/components/language-provider';
import { normalizeLanguage } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Reachard',
  description: 'Open a job post, identify the people worth contacting, and draft thoughtful outreach.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const languageCookie = (await cookies()).get('language')?.value;
  const language = normalizeLanguage(languageCookie || (await headers()).get('accept-language'));

  return (
    <html
      lang={language}
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
        <LanguageProvider initialLanguage={language} initialLanguageMode={languageCookie ? 'manual' : 'browser'}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
