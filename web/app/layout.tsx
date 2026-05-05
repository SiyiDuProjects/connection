import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { cookies } from 'next/headers';
import { LanguageProvider } from '@/components/language-provider';
import { normalizeLanguage } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Gaid',
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
  const language = normalizeLanguage((await cookies()).get('language')?.value);

  return (
    <html
      lang={language}
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-gray-50">
        <LanguageProvider initialLanguage={language}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
