import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/pricing', '/getting-started', '/support', '/privacy', '/terms'].map(path => ({ url: `https://reachard.co${path}` }));
}
