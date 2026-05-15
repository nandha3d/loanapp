# LoanTrack Deployment & Operations Guide

This guide provides instructions for deploying and maintaining the LoanTrack application in a production environment.

## 1. Production Deployment

### Environment Variables
Ensure the following variables are set in your production environment (e.g., Vercel, Coolify, or VPS):

```env
# Database
DATABASE_URL="mysql://user:pass@host:3306/loantrack"

# Authentication
NEXTAUTH_SECRET="your-32-char-secret"
NEXTAUTH_URL="https://yourdomain.com"

# Tenant Isolation
NEXT_PUBLIC_ROOT_DOMAIN="loantrack.com"
ALLOW_ROOT_DOMAIN_LOGIN="true"

# Razorpay (Optional but recommended for SaaS)
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."

# Cron Security
CRON_SECRET="your-strong-random-secret"
```

### Build & Deploy
1. Run `npm install`.
2. Generate Prisma client: `npx prisma generate`.
3. Apply migrations: `npx prisma migrate deploy`.
4. Build: `npm run build`.
5. Start: `npm run start`.

## 2. Error Tracking & Monitoring

### Sentry Integration (Recommended)
To enable error tracking:
1. Install `@sentry/nextjs`.
2. Run `npx sentry-wizard -i nextjs`.
3. Configure your `SENTRY_DSN` in environment variables.

### Local Logging
The application uses a structured logger in `lib/logger.ts`. Logs are output to `stdout` in JSON format. In production, we recommend piping these to a log management service like **Logtail (BetterStack)** or **Datadog**.

```bash
# Example for VPS
npm run start | pino-pretty
```

## 3. Backup Strategy

### Database Backups
- **Daily Backups**: Set up a cron job to dump the MariaDB database.
- **Offsite Storage**: Store dumps in S3 or a similar secure object storage.

```bash
# Sample backup script
mysqldump -u root loantrack | gzip > /backups/loantrack-$(date +%F).sql.gz
```

### File Backups
- The `private/uploads` directory contains sensitive KYC documents. Ensure this directory is included in your file-level backup strategy.

## 4. Production Cron Jobs

Ensure the following endpoints are hit daily via a scheduled task (e.g., GitHub Actions or System Cron):

| Task | Endpoint | Frequency |
| :--- | :--- | :--- |
| **NPA Classification** | `GET /api/cron/npa-classify?secret=...` | Daily (Midnight) |
| **Dunning/Suspension** | `GET /api/cron/dunning?secret=...` | Daily (1 AM) |
| **Daily Reports** | `GET /api/cron/reports?secret=...` | Daily (6 AM) |

---

## 5. Security Checklist
- [ ] Ensure `public/uploads` is empty (Secure uploads moved to `private/uploads`).
- [ ] Verify `NEXTAUTH_SECRET` is strong.
- [ ] Check that `CRON_SECRET` is unique and not shared.
- [ ] Use HTTPS for all production traffic.
- [ ] Regularly rotate database credentials.
