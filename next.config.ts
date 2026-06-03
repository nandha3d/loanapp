import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const noStoreHeaders = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  compress: true,
  allowedDevOrigins: ['lvh.me', '*.lvh.me', 'localhost:3000'],
  typescript: {
    // Type errors now fail the build (tsc --noEmit is clean). Keeps the type
    // safety net on for production deploys. (This Next version runs ESLint
    // separately via `next lint`, so no eslint config key here.)
    ignoreBuildErrors: false,
  },
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200],
  },
  async headers() {
    return [
      {
        source: '/login',
        headers: [...securityHeaders, ...noStoreHeaders],
      },
      // Authenticated API responses: private (per-user), short TTL so proxies
      // never cache sensitive data but browsers can reuse within 30s.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=30, stale-while-revalidate=60' },
        ],
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
