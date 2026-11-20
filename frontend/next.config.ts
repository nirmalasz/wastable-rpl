import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server for the Docker image (frontend/Dockerfile). The tracing root is the
  // monorepo root, so the output lands in .next/standalone/frontend/server.js.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), geolocation=(self), microphone=()',
          },
          // TODO: Add Content-Security-Policy after proper testing
        ],
      },
    ];
  },
};

export default nextConfig;
