import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { LanguageProvider } from '@/components/language-provider';
import { normalizeLanguage } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Reachard',
  description: 'Find company contacts from LinkedIn job pages.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ subsets: ['latin'] });

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
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-gray-50">
        <LanguageProvider initialLanguage={language} initialLanguageMode={languageCookie ? 'manual' : 'browser'}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
