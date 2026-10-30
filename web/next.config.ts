import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: process.env.REACHARD_PREVIEW_DIST_DIR || '.next',
  async redirects() {
    // Vercel previously owned this domain redirect; preserve it when self-hosted.
    return [{
      source: '/:path*',
      has: [{ type: 'host', value: 'www.reachard.co' }],
      destination: 'https://reachard.co/:path*',
      permanent: true
    }];
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      ...(process.env.REACHARD_BUILD_SHA ? [{ key: 'X-Reachard-Revision', value: process.env.REACHARD_BUILD_SHA }] : []),
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
