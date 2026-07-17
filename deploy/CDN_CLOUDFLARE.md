# CDN Setup — Cloudflare (free) in front of the VPS

## Current state (audited 2026-07-17)

There is **no CDN** today. The site is served by a single Hostinger VPS:
`nginx → PM2 (2× Next.js standalone workers)`. Every visitor worldwide hits the
VPS directly for HTML, JS, fonts and images.

The app is now **CDN-ready**: all static asset classes send
`Cache-Control: public, max-age=31536000, immutable`
(`/_next/static/*` via nginx, `/fonts/*` + `/assets/*` via next.config.ts), and
API/auth responses send `private`/`no-store` so an edge cache will never store
user data.

## Why Cloudflare free tier

- Free, no code change needed, ~15 min setup.
- Edge-caches all immutable assets close to users (helpful even within India:
  Chennai/Mumbai/Delhi POPs) and serves them with Brotli.
- Free TLS, HTTP/3, and DDoS protection in front of the VPS.

## Steps

1. Create a free Cloudflare account → **Add site** → enter the root domain.
2. Cloudflare shows the two nameservers — change the domain's nameservers at
   the registrar (Hostinger panel) to those two. Wait for "Active".
3. In **DNS**, make sure the A record for the app subdomain (e.g. `app`) points
   at the VPS IP with the **orange cloud ON** (proxied).
4. **SSL/TLS → Full (strict)** (the VPS already has a Let's Encrypt cert).
5. **Speed → Optimization**: enable Brotli (on by default), HTTP/3.
6. Done — no app changes needed. Verify with:
   `curl -sI https://app.animazon.in/_next/static/... | grep -i cf-cache-status`
   (want `HIT` on second request; `DYNAMIC` for pages/API is correct).

## Rules that must stay true

- Never cache `/api/*` or pages at the edge (they send `private`/`no-store`
  already — do NOT add a Cloudflare "Cache Everything" page rule).
- The live-auction polls (`/api/v1/.../live`, staff poll) are dynamic; the 30s
  `private` browser TTL is intentional and must not become a shared cache.
- If a font/asset file ever changes, rename the file (they're cached 1 year,
  immutable).
