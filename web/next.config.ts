import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.REACHARD_PREVIEW_DIST_DIR || '.next',
  turbopack: {
    root: process.cwd()
  },
  experimental: {
    ppr: true,
    clientSegmentCache: true
  }
};

export default nextConfig;
