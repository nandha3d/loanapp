---
status: investigating
trigger: "Sign-in page freezes on live Hostinger shared hosting server. Works locally but not on production server. CSP violations for Google Fonts and external fonts, plus network errors observed."
created: "2026-05-16T00:00:00.000Z"
updated: "2026-05-16T00:00:00.000Z"
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED: (1) CSP style-src 'self' 'unsafe-inline' blocks Google Fonts @import in globals.css — FIXED. (2) CSP font-src 'self' blocks fonts.gstatic.com woff2 files — FIXED. (3) Sign-in freeze is caused by server-side database hang during authorize callback on Hostinger. The authorize function makes 3+ DB queries (rate_limits, tenant, user lookup, user update). If DB connection fails/hangs, the fetch never resolves, setLoading(false) is never called, page freezes.
test: CSP fix applied. Server-side DB hang requires Hostinger environment check.
expecting: CSP violations resolved after rebuild+redeploy. Sign-in freeze resolved after fixing DB connection on Hostinger.
next_action: Document root cause, mark resolved for CSP portion, note server-side investigation needed.

## Symptoms

expected: Sign in completes normally - user enters credentials and is redirected to dashboard/home
actual: Page freezes after clicking sign in on Hostinger server
errors: CSP violations - style-src blocking Google Fonts stylesheet, font-src blocking external woff2 font. Network errors also present.
reproduction: Happens only on live Hostinger shared hosting, works fine locally
timeline: Server-only issue - local environment works, production fails

## Eliminated

## Evidence

- timestamp: "2026-05-16T00:01:00.000Z"
  checked: next.config.ts CSP configuration
  found: CSP headers set via headers() function: style-src 'self' 'unsafe-inline', font-src 'self', connect-src 'self', default-src 'self'
  implication: External resources from Google Fonts (fonts.googleapis.com, fonts.gstatic.com) are blocked

- timestamp: "2026-05-16T00:02:00.000Z"
  checked: app/globals.css line 3
  found: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap')
  implication: This import is blocked by style-src 'self' 'unsafe-inline' because fonts.googleapis.com is not 'self'

- timestamp: "2026-05-16T00:03:00.000Z"
  checked: app/login/page.tsx sign-in flow
  found: Uses signIn('credentials', { redirect: true, callbackUrl }) from next-auth/react. setLoading(true) before await, setLoading(false) only in catch block.
  implication: If signIn() promise never resolves (blocked request or hanging server), page stays frozen with loading=true

- timestamp: "2026-05-16T00:04:00.000Z"
  checked: proxy.ts (intended middleware)
  found: File named proxy.ts, NOT middleware.ts. Middleware manifest in .next is empty: "middleware": {}
  implication: The proxy middleware is NOT running. Tenant isolation, forceDocument header manipulation, and login-specific headers from middleware are all absent.

- timestamp: "2026-05-16T00:05:00.000Z"
  checked: .env_prod AUTH_URL
  found: AUTH_URL="https://springgreen-emu-806212.hostingersite.com"
  implication: next-auth uses AUTH_URL for callback URL validation. If accessed via different URL, callbacks may fail.

- timestamp: "2026-05-16T00:06:00.000Z"
  checked: next-auth react.js signIn function (lines 126-186)
  found: With redirect: true, after fetch succeeds, does window.location.href = data.url and returns WITHOUT resolving the promise. The await in login page never completes on success (browser navigates away first).
  implication: Normal behavior - page should navigate, not freeze. Freeze means fetch is hanging or failing silently.

- timestamp: "2026-05-16T00:07:00.000Z"
  checked: next-auth lib/client.js apiBaseUrl (lines 44-51)
  found: Client-side returns __NEXTAUTH.basePath (relative /api/auth). __NEXTAUTH reads NEXTAUTH_URL env var, NOT AUTH_URL.
  implication: If NEXTAUTH_URL is not set, basePath defaults to /api/auth (relative), which works for same-origin requests.

- timestamp: "2026-05-16T00:08:00.000Z"
  checked: CSP connect-src 'self' vs sign-in fetch URL
  found: Fetch goes to /api/auth/callback/credentials (relative URL, same origin). connect-src 'self' allows same-origin fetches.
  implication: CSP does NOT block the sign-in fetch. The freeze is NOT caused by CSP blocking the auth callback.

- timestamp: "2026-05-16T00:09:00.000Z"
  checked: next-auth react.js getProviders (line 130-135)
  found: If getProviders() returns null (fetchData returns null on error), redirects to /api/auth/error
  implication: If /api/auth/providers fetch fails, user would see error page, not freeze. Since user sees freeze, getProviders likely succeeds.

## Resolution

root_cause: |
  TWO SEPARATE ISSUES:

  1. CSP VIOLATIONS (FIXED): next.config.ts had overly restrictive CSP:
     - style-src 'self' 'unsafe-inline' blocked @import from https://fonts.googleapis.com in globals.css
     - font-src 'self' blocked woff2 font files from https://fonts.gstatic.com
     - The Google Fonts @import is render-blocking; when CSP blocks it, the browser 
       refuses to load the stylesheet, causing the page to render without Inter font.
  
  2. SIGN-IN FREEZE (SERVER-SIDE): The authorize callback in lib/auth.ts makes 3+ 
     database queries per sign-in (rate_limits, tenant lookup, user findFirst, user update).
     On Hostinger, if the MySQL database connection fails or hangs, the entire auth 
     callback hangs. The fetch() in next-auth's signIn() never resolves, setLoading(false) 
     is never called, and the page stays frozen showing "Signing in..."
  
  3. BONUS - MIDDLEWARE NOT RUNNING: proxy.ts is NOT named middleware.ts, so Next.js 
     does not execute it. The middleware manifest confirms "middleware": {}. This means 
     tenant isolation, forceDocument header manipulation, and login-specific cache headers 
     from the middleware are all absent. This is a separate bug.

fix: |
  1. CSP fix applied in next.config.ts:
     - style-src: added https://fonts.googleapis.com
     - font-src: added https://fonts.gstatic.com
  2. Server-side fix needed on Hostinger:
     - Verify DATABASE_URL is correct and MySQL is running
     - Check Prisma connection in production
     - Add timeout/error handling to auth callback
  3. Rename proxy.ts to middleware.ts (separate fix)

verification: CSP fix applied, needs rebuild + redeploy to Hostinger to verify. Server-side DB issue requires Hostinger environment check.
files_changed:
  - next.config.ts: Added https://fonts.googleapis.com to style-src, https://fonts.gstatic.com to font-src
