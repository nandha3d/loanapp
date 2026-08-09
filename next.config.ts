import type { NextConfig } from "next";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const cspApiUrl = API_URL ? ` ${API_URL}` : '';

function normalizeBasePath(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

const PUBLIC_BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

// Supabase auth runs in the browser (OAuth code exchange, magic-link send), so
// its origin must be allowed in connect-src or the CSP blocks every call.
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const cspSupabase = SUPABASE_URL ? ` ${SUPABASE_URL} wss://${SUPABASE_URL.replace(/^https?:\/\//, '')}` : '';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unpkg.com: Leaflet (route-tracker live map) is loaded from CDN at runtime
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      // OpenStreetMap tiles + Leaflet marker sprites for the live map
      `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com${cspApiUrl}`,
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src 'self'${cspApiUrl}${cspSupabase}`,
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
  ...(PUBLIC_BASE_PATH ? { basePath: PUBLIC_BASE_PATH } : {}),
  output: 'standalone',
  compress: true,
  allowedDevOrigins: ['lvh.me', '*.lvh.me', 'localhost:3000', 'localhost:3001'],
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
      // Forms post camera photos and PDF documents inline. Images are shrunk
      // client-side first (lib/imageCompression.ts), but PDFs cannot be, so this
      // keeps headroom. Exceeding the limit is NOT a normal 413 — Next raises it
      // as an uncaught exception that takes the whole server process down, so
      // the limit must sit comfortably above real payloads.
      bodySizeLimit: '15mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200],
    remotePatterns: [
      ...(API_URL
        ? [{
            protocol: new URL(API_URL).protocol.replace(':', '') as 'http' | 'https',
            hostname: new URL(API_URL).hostname,
            port: new URL(API_URL).port,
            pathname: '/api/files/**',
          }]
        : [{
            protocol: 'http' as const,
            hostname: 'localhost',
            port: '3001',
            pathname: '/api/files/**',
          }]
      ),
    ],
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
      // Static public assets (fonts, images). Filenames never change without a
      // rename, so cache hard — this also makes them edge-cacheable when a CDN
      // (e.g. Cloudflare) sits in front. Without this they were served through
      // Node with no cache header at all on every page view.
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
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
