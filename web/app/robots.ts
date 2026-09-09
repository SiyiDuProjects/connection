import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api/', '/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/onboarding', '/verify-email', '/connect-extension', '/workspace-preview', '/template-preview', '/ui-preview'] }, sitemap: 'https://reachard.co/sitemap.xml', host: 'https://reachard.co' };
}
