# LoanApp Full Audit Report
**Date:** 2026-05-22  
**Scope:** Mobile app + Backend API + VPS readiness for 500 customers  
**Status:** AWAITING APPROVAL — do not implement anything until approved

---

## Summary Table

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 4 | 6 | 5 | 3 | 18 |
| Performance / Optimization | 0 | 5 | 6 | 2 | 13 |
| Pagination | 0 | 6 | 0 | 0 | 6 |
| CORS | 0 | 3 | 1 | 0 | 4 |
| GPS Tracking (missing) | 1 | 3 | 4 | 0 | 8 |
| VPS / Infrastructure | 0 | 5 | 4 | 2 | 11 |
| Mobile App | 0 | 3 | 5 | 3 | 11 |
| Features (missing) | 0 | 2 | 4 | 3 | 9 |
| **TOTAL** | **5** | **33** | **29** | **13** | **80** |

---

## Severity Legend
- **CRITICAL** — Data loss, security breach, or system crash possible right now
- **HIGH** — Will fail or break under 500-customer load or blocks mobile app
- **MEDIUM** — Degrades experience, technical debt, or risk under growth
- **LOW** — Best practice, cleanup, or minor improvement

---

## 1. SECURITY

### SEC-01 — CRITICAL: `unsafe-eval` in Content-Security-Policy
**File:** `next.config.ts`  
**Issue:** `script-src` includes `'unsafe-eval'`. Allows arbitrary JS execution if XSS occurs. Enables attacker to eval injected code.  
**Fix:** Remove `'unsafe-eval'`. Identify and eliminate `eval()` usage in codebase. Use nonce-based CSP.

---

### SEC-02 — CRITICAL: `geolocation=()` blocks GPS before it is built
**File:** `next.config.ts` → `Permissions-Policy` header  
**Issue:** Header explicitly disables geolocation for all origins. GPS tracking (required feature) cannot work until this is changed. Must be fixed before GPS implementation.  
**Fix:** Change to `geolocation=(self)` — allow only same origin.

---

### SEC-03 — CRITICAL: JWT secret fallback not enforced at startup
**File:** `lib/auth.ts`  
**Issue:** If `AUTH_SECRET` / `NEXTAUTH_SECRET` env var is missing, NextAuth may fall back to a weak or empty secret in dev/misconfigured prod. No startup assertion exists.  
**Fix:** Add startup check: `if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET not set')`.

---

### SEC-04 — CRITICAL: PII encryption key derivation weak
**File:** `lib/pii.ts`  
**Issue:** `PII_ENCRYPTION_KEY` is SHA-256 hashed from env string. If env value is low-entropy (short passphrase), key is weak. No key stretching (PBKDF2/scrypt/argon2).  
**Fix:** Use PBKDF2 with salt or require 32-byte random hex key. Document minimum entropy requirement.

---

### SEC-05 — HIGH: `unsafe-inline` in script-src
**File:** `next.config.ts`  
**Issue:** `'unsafe-inline'` allows inline `<script>` tags. XSS via injected HTML executes immediately.  
**Fix:** Use nonce-based CSP with Next.js middleware nonce injection.

---

### SEC-06 — HIGH: No HTTPS enforcement header
**File:** `next.config.ts`  
**Issue:** No `Strict-Transport-Security` (HSTS) header. If user visits HTTP, credentials sent in plaintext.  
**Fix:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

---

### SEC-07 — HIGH: Mobile JWT token — no refresh token rotation
**File:** `app/api/v1/auth/login/route.ts`  
**Issue:** Login issues JWT. No refresh token. Token likely long-lived. Stolen token = permanent access until manual invalidation.  
**Fix:** Issue short-lived access token (15 min) + long-lived refresh token. Implement `/api/v1/auth/refresh`. Store refresh token hash in DB for revocation.

---

### SEC-08 — HIGH: No brute-force lockout on mobile 2FA endpoint
**File:** `app/api/v1/auth/2fa/route.ts`  
**Issue:** Rate limiting on login, but 2FA verification endpoint may not be rate-limited separately. Attacker can brute-force 6-digit TOTP after obtaining valid credentials.  
**Fix:** Apply same rate limiting middleware to `/api/v1/auth/2fa` — max 5 attempts per 10 min per user.

---

### SEC-09 — HIGH: File upload — no MIME type validation beyond extension
**File:** `app/api/v1/upload/route.ts`  
**Issue:** File upload checks extension and size (5MB) but does not validate actual MIME type from file magic bytes. Attacker can rename malicious file to `.jpg`.  
**Fix:** Use `file-type` npm package to validate magic bytes match declared extension. Reject mismatches.

---

### SEC-10 — HIGH: Razorpay webhook — signature not always verified
**File:** `app/api/webhooks/razorpay/route.ts`  
**Issue:** If `RAZORPAY_WEBHOOK_SECRET` is not set, webhook may proceed without signature verification. Allows fake payment events.  
**Fix:** Enforce `RAZORPAY_WEBHOOK_SECRET` at startup. Reject all webhook calls without valid HMAC-SHA256 signature.

---

### SEC-11 — MEDIUM: Aadhar number logged in audit trail (plaintext?)
**File:** `lib/pii.ts`, `lib/audit.ts`  
**Issue:** Audit logs capture field changes. If Aadhar is logged before encryption, PII leaks to audit table.  
**Fix:** Ensure audit log captures only `[REDACTED]` or encrypted value for PII fields.

---

### SEC-12 — MEDIUM: Cookie `active_branch_id` not HttpOnly
**File:** `middleware.ts`  
**Issue:** Branch/app preference cookies set without `HttpOnly` flag. XSS can read and spoof branch context, potentially accessing wrong tenant data.  
**Fix:** Set `HttpOnly; Secure; SameSite=Strict` on all session-related cookies.

---

### SEC-13 — MEDIUM: No IP allowlist for cron endpoints
**File:** `app/api/cron/*/route.ts`  
**Issue:** Cron routes protected only by `CRON_SECRET` bearer token. If token leaks, anyone can trigger penalty accrual, dunning, NPA classification.  
**Fix:** Add IP allowlist check (Hostinger cron server IP) in addition to bearer token.

---

### SEC-14 — MEDIUM: Backup export endpoint accessible to all admins
**File:** `app/api/backup/export/route.ts`  
**Issue:** Full DB export accessible to any admin role. No superadmin restriction. Exfiltration risk.  
**Fix:** Restrict to `superadmin` role only. Add rate limiting (1 export per hour). Log all export events.

---

### SEC-15 — MEDIUM: No rate limit on backup/export
**File:** `app/api/backup/export/route.ts`  
**Issue:** No rate limiting. Attacker with admin cookie can hammer endpoint, exfiltrating data repeatedly or causing DB load.  
**Fix:** Rate limit to 2 requests per hour per user.

---

### SEC-16 — LOW: `TRUST_PROXY=false` default — IP spoofing risk if behind reverse proxy
**File:** `.env.example`  
**Issue:** On Hostinger VPS behind Nginx, real client IP is in `X-Forwarded-For`. If `TRUST_PROXY` stays false, rate limiting uses wrong IP (Nginx localhost IP), defeating per-IP limits.  
**Fix:** Set `TRUST_PROXY=true` on VPS, add comment in .env.example.

---

### SEC-17 — LOW: Session secret rotation — no procedure documented
**Issue:** No runbook for rotating `AUTH_SECRET` / `PII_ENCRYPTION_KEY`. Key rotation invalidates all sessions and encrypted Aadhar data simultaneously.  
**Fix:** Document rotation procedure. For PII key: implement re-encryption migration script before rotating.

---

### SEC-18 — LOW: No security.txt file
**Issue:** No `/.well-known/security.txt`. Best practice for responsible disclosure.  
**Fix:** Add `public/.well-known/security.txt` with contact email.

---

## 2. PERFORMANCE / OPTIMIZATION

### PERF-01 — HIGH: DB connection pool default too small for 500 customers
**File:** `DATABASE_URL` in `.env`  
**Issue:** Prisma default connection pool = `num_cpus * 2 + 1` (likely 3–5 on VPS). At 500 active customers, concurrent API calls will queue or timeout.  
**Fix:** Add `?connection_limit=20&pool_timeout=30` to `DATABASE_URL`. Set `DATABASE_URL="mysql://...?connection_limit=20&pool_timeout=30"`.

---

### PERF-02 — HIGH: N+1 query on customer list — includes nested loans
**File:** `app/api/v1/customers/route.ts`  
**Issue:** `findMany` with `include: { loans: true }` fetches all loans for each customer in separate queries (N+1 pattern). 500 customers × avg 3 loans = 1500+ queries per page load.  
**Fix:** Use `_count` for summary or `select` specific fields. Add cursor-based pagination (see PAGE-01).

---

### PERF-03 — HIGH: No query result caching
**Issue:** Every API call hits MySQL. Dashboard summary, agent reports, and analytics recalculate from raw data on every request. Under 500 customers, report queries will be slow.  
**Fix:** Add Redis or in-memory cache (node-cache) for:
- Dashboard KPIs: 60s TTL
- Agent analytics: 5 min TTL
- Daily reports: 10 min TTL (invalidate on new collection entry)

---

### PERF-04 — HIGH: No database indexes on high-frequency query columns
**File:** `prisma/schema.prisma`  
**Issue:** Missing indexes on:
- `CollectionEntry.collectedAt` (daily collection queries filter by date)
- `Instalment.dueDate` (overdue queries)
- `Customer.phone` (login/search)
- `AuditLog.createdAt` (log queries)  
**Fix:** Add `@@index([collectedAt])`, `@@index([phone])`, etc. in schema. Run migration.

---

### PERF-05 — HIGH: Cron jobs not idempotent — double-run risk
**File:** `app/api/cron/accrue-penalties/route.ts`, `app/api/cron/npa-classify/route.ts`  
**Issue:** If Hostinger cron fires twice (duplicate trigger), penalties could be accrued twice or NPA status toggled incorrectly. No idempotency guard.  
**Fix:** Add DB-level lock or `processedDate` check: `WHERE date NOT IN (SELECT date FROM ProcessedCronRun WHERE jobName = 'accrue-penalties')`.

---

### PERF-06 — MEDIUM: No HTTP response compression
**File:** `next.config.ts`  
**Issue:** Next.js does not enable gzip/brotli compression by default in standalone mode. Large JSON API responses (customer lists, reports) sent uncompressed.  
**Fix:** Add Nginx `gzip on` in VPS config (see INFRA-02), or add `compress: true` in next.config.ts.

---

### PERF-07 — MEDIUM: `serverActions.bodySizeLimit: '4mb'` too large for API routes
**File:** `next.config.ts`  
**Issue:** 4MB body limit on all routes. Collection entry and login need <10KB. Large limit wastes memory parsing oversized requests, enables memory exhaustion attacks.  
**Fix:** Set global limit to `512kb`. Override per-route for upload endpoint only.

---

### PERF-08 — MEDIUM: No CDN for static assets
**Issue:** All static assets (`/public`) served by Node.js process. Under 500 concurrent users, static file serving consumes Node event loop.  
**Fix:** Configure Nginx to serve `/public` directly (bypass Node). Or use Cloudflare free CDN in front of VPS.

---

### PERF-09 — MEDIUM: Penalty accrual cron — full table scan daily
**File:** `app/api/cron/accrue-penalties/route.ts`  
**Issue:** Queries all active loans daily to check for overdue instalments. At 500 customers × avg 12 instalments = 6000 rows scanned per run.  
**Fix:** Add partial index `@@index([status, dueDate]) where status = 'PENDING'`. Query only PENDING instalments past dueDate.

---

### PERF-10 — MEDIUM: No query timeout set on Prisma client
**Issue:** Long-running queries (analytics, NPA classification) can hang indefinitely, blocking Node worker and depleting connection pool.  
**Fix:** Set `queryTimeout: 10000` (10s) in Prisma client options. Wrap complex queries in try/catch with timeout fallback.

---

### PERF-11 — MEDIUM: AuditLog table — unbounded growth
**File:** `prisma/schema.prisma` → `AuditLog`  
**Issue:** Audit logs never purged. At 500 customers, 10 actions/day = 1.8M rows/year. Queries slow down as table grows.  
**Fix:** Add cron job to archive AuditLog entries older than 90 days to separate `AuditLogArchive` table. Add `@@index([createdAt])`.

---

### PERF-12 — LOW: RateLimit table — no cleanup cron
**File:** `lib/rateLimit.ts`  
**Issue:** Expired rate limit entries accumulate in DB. `cleanup` fn exists but not called on schedule.  
**Fix:** Call `cleanupExpiredEntries()` in existing cron job (append to accrue-penalties cron).

---

### PERF-13 — LOW: No connection pool monitoring
**Issue:** No visibility into DB connection pool saturation. Under load, first sign of problem is timeout errors to users.  
**Fix:** Add `/api/health` response to include `db_pool_used / db_pool_max`. Expose to monitoring.

---

## 3. PAGINATION

### PAGE-01 — HIGH: `/api/v1/customers` — no pagination
**File:** `app/api/v1/customers/route.ts`  
**Issue:** `findMany()` with no `take`/`skip`. 500 customers + nested loans = 500+ rows + N+1 queries in single response. Will OOM crash Node.  
**Fix:** Add cursor-based pagination:
```ts
GET /api/v1/customers?cursor=<id>&limit=20
// Response: { data: Customer[], nextCursor: string | null }
```

---

### PAGE-02 — HIGH: `/api/v1/loans` — no pagination
**File:** `app/api/v1/loans/route.ts`  
**Issue:** Same as PAGE-01. All loans fetched at once. 500 customers × avg 3 loans = 1500 rows per request.  
**Fix:** Cursor pagination with `limit=20` default, max `limit=100`.

---

### PAGE-03 — HIGH: `/api/v1/penalties` — no pagination
**File:** `app/api/v1/penalties/route.ts`  
**Issue:** All penalties fetched. Unbounded growth as system ages.  
**Fix:** Add `?page=1&limit=50` offset pagination (penalties are typically filtered by loan, so offset is acceptable here).

---

### PAGE-04 — HIGH: `/api/v1/approvals` — no pagination
**File:** `app/api/v1/approvals/route.ts`  
**Issue:** All approval records fetched. Grows unboundedly.  
**Fix:** Add `?status=PENDING&limit=20` filter + pagination.

---

### PAGE-05 — HIGH: `/api/v1/reports/overdue` — no pagination
**File:** `app/api/v1/reports/overdue/route.ts`  
**Issue:** All overdue loans fetched. Could be hundreds of records under 500 customers.  
**Fix:** Add `limit=50` default with cursor pagination.

---

### PAGE-06 — HIGH: `/api/v1/collection/today` — potential large result
**File:** `app/api/v1/collection/today/route.ts`  
**Issue:** Fetches all of today's collections for agent. If agent has 100+ stops, response is large. Mobile app may timeout.  
**Fix:** Add `limit=50` with cursor. Mobile app loads next page on scroll.

---

## 4. CORS

### CORS-01 — HIGH: No CORS headers on `/api/v1/*` routes
**Issue:** Mobile app (Flutter) calls `/api/v1/*` from a different origin (bundled app, or different subdomain). Without CORS headers, browser/WebView blocks preflight OPTIONS requests.  
**Fix:** Add CORS middleware to all `/api/v1/` routes:
```ts
// lib/cors.ts
export function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(origin),
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
    'Access-Control-Max-Age': '86400',
  };
}
```

---

### CORS-02 — HIGH: No OPTIONS handler on API routes
**Issue:** Flutter's Dio HTTP client sends preflight OPTIONS request before POST/PUT. No OPTIONS handler = 405 Method Not Allowed. All mutating API calls from mobile will fail.  
**Fix:** Add OPTIONS handler in each API route file or create a global middleware that intercepts OPTIONS and returns 204 with CORS headers.

---

### CORS-03 — HIGH: CORS origin not restricted — wildcard risk
**Issue:** If CORS is added without explicit origin allowlist, using `*` allows any website to call the API with user's credentials.  
**Fix:** Use allowlist:
```ts
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'capacitor://localhost',   // Flutter Android
  'ionic://localhost',       // Flutter iOS
  'http://localhost:3000',   // Dev
];
```

---

### CORS-04 — MEDIUM: CSP `connect-src 'self'` blocks mobile API calls
**File:** `next.config.ts`  
**Issue:** `connect-src 'self'` in CSP prevents WebViews from calling APIs on different subdomains (e.g., `api.tenant.domain.com` vs `tenant.domain.com`).  
**Fix:** Update `connect-src` to include API origin. Or ensure API and web are same origin on VPS.

---

## 5. GPS TRACKING (NOT IMPLEMENTED — REQUIRED FEATURE)

### GPS-01 — CRITICAL: GPS feature entirely missing
**Issue:** Collection agent GPS tracking not implemented anywhere:
- No `geolocator` or `location` package in Flutter `pubspec.yaml`
- No GPS API endpoints in backend
- No `lat`/`lng` fields in `CollectionEntry`, `Route`, or `Customer` schema
- `Permissions-Policy: geolocation=()` actively blocks geolocation
- No GPS UI in mobile app  
**This is a full feature build, not a fix.**

---

### GPS-02 — HIGH: DB schema missing GPS fields
**File:** `prisma/schema.prisma`  
**Issue:** `CollectionEntry`, `DailyCollection`, and `Route` tables have no location fields.  
**Fix:** Add to schema:
```prisma
model CollectionEntry {
  // existing fields...
  lat         Float?
  lng         Float?
  accuracy    Float?       // meters
  capturedAt  DateTime?    // GPS timestamp (may differ from entry time)
}

model RouteStop {
  id         String   @id @default(cuid())
  routeId    String
  customerId String
  lat        Float
  lng        Float
  sequence   Int
}
```

---

### GPS-03 — HIGH: No GPS tracking API endpoints
**Issue:** No backend endpoints to:
- Receive agent location pings
- Retrieve agent location history
- Validate collection was made near customer address  
**Fix needed:**
```
POST /api/v1/gps/ping          — agent sends location every 30s
GET  /api/v1/gps/agent/:id     — admin views agent live location
GET  /api/v1/gps/history/:id   — admin views agent route history
POST /api/v1/collection/entry  — add lat/lng validation (within 500m of customer)
```

---

### GPS-04 — HIGH: Flutter app missing location packages
**File:** `mobile/pubspec.yaml`  
**Issue:** No location/GPS packages installed.  
**Fix — add to pubspec.yaml:**
```yaml
dependencies:
  geolocator: ^13.0.0         # GPS position
  permission_handler: ^11.3.0  # Runtime permissions
  google_maps_flutter: ^2.9.0  # Map display (optional)
  background_locator_2: ^2.0.6 # Background tracking while app minimized
```

---

### GPS-05 — MEDIUM: Background GPS tracking — battery drain risk
**Issue:** Continuous GPS polling kills mobile battery. Need smart tracking strategy.  
**Fix:**
- Track only during active collection session (agent checks in/out)
- Use `background_locator_2` with `BALANCED_POWER_ACCURACY` mode
- Send batch pings every 30s (not real-time stream)
- Stop tracking when agent marks route complete

---

### GPS-06 — MEDIUM: No geofencing for collection validation
**Issue:** Without geofencing, agent can record collection from anywhere. No fraud prevention.  
**Fix:** On `POST /api/v1/collection/entry`, compare GPS coords to customer address coords. Warn if distance > 500m. Store distance_from_customer in CollectionEntry for audit.

---

### GPS-07 — MEDIUM: Customer addresses not geocoded
**File:** `prisma/schema.prisma` → `Customer`  
**Issue:** Customer address stored as free-text string. No lat/lng. Can't calculate distance for geofencing without geocoding first.  
**Fix:** Add `lat Float?`, `lng Float?` to Customer. Run geocoding (Google Maps API or OpenStreetMap Nominatim) on address save. Store result.

---

### GPS-08 — MEDIUM: No map view for admin to see agent locations
**Issue:** Feature spec implies admin can monitor collection agents in real time. No map UI exists.  
**Fix:** Add admin dashboard map page using `flutter_map` (OpenStreetMap, free) or Google Maps. Show agent pins with last-ping timestamp.

---

## 6. VPS / INFRASTRUCTURE

### INFRA-01 — HIGH: No PM2 process manager
**Issue:** Deploy script starts Node.js directly. Single process crash = downtime. No auto-restart on failure.  
**Fix — add `ecosystem.config.js`:**
```js
module.exports = {
  apps: [{
    name: 'loanapp',
    script: 'server.js',
    instances: 2,          // 2 workers for 500 customers
    exec_mode: 'cluster',
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production' }
  }]
};
```
Start: `pm2 start ecosystem.config.js && pm2 save && pm2 startup`

---

### INFRA-02 — HIGH: No Nginx reverse proxy config
**Issue:** Node.js process exposed directly. No SSL termination, no gzip, no static file serving, no rate limiting at edge.  
**Fix — add `nginx.conf`:**
```nginx
server {
  listen 443 ssl;
  server_name *.yourdomain.com;

  gzip on;
  gzip_types application/json text/css application/javascript;

  location /_next/static/ {
    alias /home/loanapp/.next/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location /public/ {
    alias /home/loanapp/public/;
    expires 30d;
  }

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

---

### INFRA-03 — HIGH: No MySQL tuning for VPS
**Issue:** Default MySQL config for small RAM (128MB buffer pool). Under 500 customers, slow queries pile up.  
**Fix — add to `my.cnf`:**
```ini
[mysqld]
innodb_buffer_pool_size = 256M   # 50% of VPS RAM if 512MB VPS
innodb_log_file_size = 64M
max_connections = 100
query_cache_type = 1
query_cache_size = 32M
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

---

### INFRA-04 — HIGH: Deploy script — no zero-downtime deployment
**File:** `deploy_prep.bat`  
**Issue:** Current deploy: stop Node → extract zip → start Node. Downtime during deploy. For 500 customers, unacceptable.  
**Fix:** Use PM2 `reload` (graceful restart) instead of stop/start:
```bash
pm2 reload loanapp --update-env
```
Or implement blue-green: deploy to port 3001, health check, switch Nginx upstream, kill old.

---

### INFRA-05 — HIGH: No automated database backup
**Issue:** No cron job for MySQL backup. VPS disk failure = total data loss.  
**Fix — add to crontab:**
```bash
0 2 * * * mysqldump -u root -p$DB_PASS loanapp | gzip > /backups/loanapp_$(date +%Y%m%d).sql.gz
# Retain 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete
# Optional: sync to S3/Backblaze
```

---

### INFRA-06 — MEDIUM: No health check monitoring
**Issue:** `/api/health` exists but nothing monitors it externally. Downtime not detected until customer complains.  
**Fix:** Use free tier of UptimeRobot or Betterstack to ping `/api/health` every 1 min. Alert to email/Telegram on failure.

---

### INFRA-07 — MEDIUM: No log rotation for Next.js output
**Issue:** PM2 logs grow unboundedly. VPS disk fills → Node crashes.  
**Fix:** `pm2 install pm2-logrotate` → configure 10MB max, keep 7 files.

---

### INFRA-08 — MEDIUM: No firewall rules documented
**Issue:** No `ufw` / iptables rules in deploy docs. MySQL port (3306) may be exposed publicly.  
**Fix — document in README:**
```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 3306/tcp   # Block MySQL from outside
ufw enable
```

---

### INFRA-09 — MEDIUM: VPS RAM not estimated for 500 customers
**Issue:** No capacity estimate. Risk of OOM.  
**Estimate for 500 customers:**
- Next.js 2 workers: ~300MB
- MySQL: ~300MB
- OS: ~100MB
- Buffer: ~100MB
- **Minimum VPS: 1GB RAM.** Recommend 2GB.

---

### INFRA-10 — LOW: deploy_prep.bat — Windows-only
**File:** `deploy_prep.bat`  
**Issue:** Deployment script is a Windows batch file. Cannot run from Linux CI/CD pipeline.  
**Fix:** Convert to `deploy.sh` (bash) for cross-platform use.

---

### INFRA-11 — LOW: No environment variable validation on startup
**Issue:** If required env vars (`DATABASE_URL`, `AUTH_SECRET`, etc.) are missing on VPS, app starts silently and crashes on first request.  
**Fix:** Add startup validation:
```ts
// lib/env.ts
const required = ['DATABASE_URL', 'AUTH_SECRET', 'CRON_SECRET'];
required.forEach(k => { if (!process.env[k]) throw new Error(`Missing env: ${k}`); });
```

---

## 7. MOBILE APP (FLUTTER)

### MOB-01 — HIGH: No offline support / local queue
**Issue:** If agent loses network mid-collection, collection entry is lost. No local queue.  
**Fix:** Use Isar (already in pubspec) to store collection entries locally. Sync queue when network restored. Show sync status indicator.

---

### MOB-02 — HIGH: No FCM token refresh handling
**File:** `mobile/lib/core/`  
**Issue:** FCM token registered on login. Tokens expire/rotate. No refresh listener. Push notifications silently fail.  
**Fix:** Listen to `FirebaseMessaging.instance.onTokenRefresh` stream. POST new token to `/api/v1/settings/fcm-token` on refresh.

---

### MOB-03 — HIGH: Dio base URL hardcoded risk
**File:** `mobile/lib/core/network/`  
**Issue:** If Dio base URL is hardcoded (not from env/config), changing VPS domain requires app rebuild and store submission.  
**Fix:** Store base URL in `flutter_secure_storage` on first login (derive from tenant subdomain). Or use remote config (Firebase Remote Config, free tier).

---

### MOB-04 — MEDIUM: No certificate pinning
**Issue:** Flutter Dio client accepts any valid SSL cert. MITM attack with rogue cert (e.g., on corporate network) intercepts credentials.  
**Fix:** Add certificate pinning via `http_certificate_pinning` package or Dio's `SecurityContext`. Pin to VPS Let's Encrypt cert's public key hash.

---

### MOB-05 — MEDIUM: No app-level session timeout
**Issue:** Agent leaves phone unlocked. App stays authenticated indefinitely (until JWT expires).  
**Fix:** Track last activity timestamp in secure storage. If app backgrounded > 15 min, require PIN/biometric re-auth. Use `local_auth` (already installed).

---

### MOB-06 — MEDIUM: PDF generation — no size limit
**File:** `mobile/lib/` (pdf package)  
**Issue:** Reports can generate large PDFs (all collections, all customers). On low-RAM Android, OOM crash.  
**Fix:** Limit PDF export to date range (max 90 days or 500 entries). Show warning if approaching limit.

---

### MOB-07 — MEDIUM: Windows build target unnecessary for production
**File:** `mobile/pubspec.yaml`  
**Issue:** Prisma binary targets include Windows. Mobile app targets Windows desktop. Adds build complexity and binary size.  
**Fix:** Remove Windows from Flutter targets if not needed. Keep Android + iOS only.

---

### MOB-08 — MEDIUM: No app version check / force update
**Issue:** Old app versions may call deprecated API endpoints. No mechanism to force update.  
**Fix:** Add `X-App-Version` header to all mobile API calls. Backend checks against minimum supported version in AppSettings. Return 426 Upgrade Required if too old.

---

### MOB-09 — LOW: Hive + Isar — two local DBs
**Issue:** Both Hive and Isar are used for local storage. Redundant. Adds APK size.  
**Fix:** Standardize on Isar (more powerful, already used). Migrate Hive usage to Isar.

---

### MOB-10 — LOW: No crash reporting
**Issue:** No Crashlytics or Sentry. Crashes invisible until customer reports.  
**Fix:** Add `firebase_crashlytics` (free). Initialize in `main.dart` with `FlutterError.onError`.

---

### MOB-11 — LOW: No analytics / user behavior tracking
**Issue:** Can't identify which features agents use, where they drop off.  
**Fix:** Add `firebase_analytics` (free). Log key events: login, collection_entry, route_start, route_complete.

---

## 8. MISSING FEATURES

### FEAT-01 — HIGH: No push notification for overdue reminders to borrowers
**Issue:** Dunning cron job exists (`/api/cron/dunning`) but borrower-facing push notifications not implemented. Borrowers not notified of upcoming/overdue instalments.  
**Fix:** Implement borrower FCM push via dunning cron. Add `fcmToken` field to Customer (borrower app token). Send 3-day and 1-day advance reminder.

---

### FEAT-02 — HIGH: No collection receipt / confirmation to borrower
**Issue:** After agent records collection, no receipt is sent to borrower (SMS/push). Fraud risk — agent can collect cash and not record it.  
**Fix:** On `POST /api/v1/collection/entry`, trigger SMS (Twilio/MSG91) or push notification to borrower with amount, date, remaining balance. Creates audit trail borrower can verify.

---

### FEAT-03 — MEDIUM: No route optimization for agents
**Issue:** Routes are manually assigned. Agent visits customers in arbitrary order. Inefficient.  
**Fix:** Add `sequence` ordering to RouteStop. Provide "optimize route" button in mobile app that reorders stops by proximity (nearest-neighbor algorithm, no external API needed).

---

### FEAT-04 — MEDIUM: No EMI calculator in mobile app
**Issue:** Agents often need to answer "how much will my EMI be?" No calculator feature.  
**Fix:** Add offline EMI calculator screen. Formula: `EMI = P * r * (1+r)^n / ((1+r)^n - 1)`. No API call needed.

---

### FEAT-05 — MEDIUM: No bulk collection entry
**Issue:** Agent must enter each collection one by one. If agent collects from 20 customers, 20 separate form submissions.  
**Fix:** Add "bulk collect" mode — show list of today's route stops with amount field. Submit all at once via `POST /api/v1/collection/bulk`.

---

### FEAT-06 — MEDIUM: No loan statement / passbook for borrower portal
**Issue:** Borrower portal exists (`/borrower`) but no downloadable loan statement.  
**Fix:** Add "Download Statement" button. Generate PDF with all instalments, payments, balance, penalties. Use existing pdf lib.

---

### FEAT-07 — LOW: No dark mode in mobile app
**Issue:** No dark theme. Agents using phone outdoors in bright sun or indoors at night.  
**Fix:** Add dark/light theme toggle using existing theming setup (Riverpod + ThemeData).

---

### FEAT-08 — LOW: No agent performance dashboard
**Issue:** Agents can't see their own KPIs (collection rate, pending stops, amount collected today).  
**Fix:** Add agent home screen KPI cards: today's target, collected, pending, efficiency %. Pull from existing `/api/v1/reports/agent`.

---

### FEAT-09 — LOW: No data export for customers (DPDP compliance)
**Issue:** India's Digital Personal Data Protection Act requires data portability. Customers can request their data.  
**Fix:** Add `/api/v1/borrower/export-my-data` endpoint. Returns all customer data as JSON/PDF. Rate limit to 1 per month per customer.

---

## Implementation Priority (Recommended Phases)

### Phase 1 — Critical blockers (before go-live)
SEC-01, SEC-02, SEC-03, SEC-04, CORS-01, CORS-02, CORS-03, PAGE-01, PAGE-02, INFRA-01, INFRA-02, INFRA-05, GPS-01 (schema only)

### Phase 2 — 500-customer readiness
PERF-01, PERF-02, PERF-03, PERF-04, INFRA-03, INFRA-04, PAGE-03, PAGE-04, PAGE-05, MOB-01, SEC-06, SEC-07

### Phase 3 — GPS tracking feature
GPS-02, GPS-03, GPS-04, GPS-05, GPS-06, GPS-07, GPS-08

### Phase 4 — Polish & features
Remaining MEDIUM/LOW items, FEAT-01 through FEAT-09

---

*Total issues: 80 | Critical: 5 | High: 33 | Medium: 29 | Low: 13*  
*Do not implement anything until user approves phases.*
