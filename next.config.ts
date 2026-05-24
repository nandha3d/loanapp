import type { NextConfig } from "next";

// SEC-02: geolocation=(self) — allow GPS for collection agents (same origin only).
// SEC-06: HSTS — force HTTPS for 1 year incl. subdomains.
// SEC-01: dropped 'unsafe-eval' from script-src (XSS hardening).
//   Next dev/HMR may still need it; gate by NODE_ENV.
const isDev = process.env.NODE_ENV !== 'production';

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https:",
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
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      // PERF-07: 512kb default. /api/v1/upload has its own 5MB cap (Nginx + route).
      bodySizeLimit: '512kb',
    },
  },
  async headers() {
    return [
      {
        source: '/login',
        headers: [...securityHeaders, ...noStoreHeaders],
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
