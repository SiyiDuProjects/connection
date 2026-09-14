import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.REACHARD_PREVIEW_DIST_DIR || '.next',
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }, { source: '/reset-password', headers: [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Cache-Control', value: 'no-store' }
    ] }];
  },
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
