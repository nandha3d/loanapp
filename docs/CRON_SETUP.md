# Cron & Scheduled Jobs Setup

The ZoloFund application relies on scheduled background jobs (cron) to handle recurring logic like penalty accruals, NPA classifications, and billing automation.

Since the application uses a REST-based cron trigger pattern rather than an embedded Node.js scheduler (to support serverless and cPanel/Hostinger deployments), you must configure external cron jobs using your hosting provider.

## Security
All cron endpoints are protected by a shared secret. You must configure the `CRON_SECRET` environment variable in your `.env` file.

```env
CRON_SECRET=your_secure_random_string_here
```

The external cron scheduler must hit the endpoints using this secret as a query parameter (`?secret=YOUR_SECRET`).

## Required Cron Jobs

### 1. Penalty Accrual
Calculates and accrues late penalties for all active loans with unpaid past-due instalments.
- **Endpoint**: `GET /api/cron/accrue-penalties`
- **Schedule**: Daily at midnight (00:00)
- **Cron Expression**: `0 0 * * *`
- **cPanel/Hostinger Command**:
  ```bash
  curl -s "https://yourdomain.com/api/cron/accrue-penalties?secret=YOUR_SECRET" > /dev/null
  ```

### 2. Dunning Automation (Billing)
Checks for `past_due` subscriptions that have exceeded their grace period and suspends the tenant to prevent further usage.
- **Endpoint**: `GET /api/cron/dunning`
- **Schedule**: Daily at 01:00 AM
- **Cron Expression**: `0 1 * * *`
- **cPanel/Hostinger Command**:
  ```bash
  curl -s "https://yourdomain.com/api/cron/dunning?secret=YOUR_SECRET" > /dev/null
  ```

### 3. NPA Classification
Classifies loans as Non-Performing Assets (NPA) if they have instalments overdue by 90+ days.
- **Endpoint**: `GET /api/cron/npa-classify`
- **Schedule**: Daily at 02:00 AM
- **Cron Expression**: `0 2 * * *`
- **cPanel/Hostinger Command**:
  ```bash
  curl -s "https://yourdomain.com/api/cron/npa-classify?secret=YOUR_SECRET" > /dev/null
  ```

### 4. Scheduled Email Reports
Generates and sends weekly/monthly collection summary reports to tenant administrators.
- **Endpoint**: `GET /api/cron/reports`
- **Schedule**: Weekly on Monday at 08:00 AM
- **Cron Expression**: `0 8 * * 1`
- **cPanel/Hostinger Command**:
  ```bash
  curl -s "https://yourdomain.com/api/cron/reports?secret=YOUR_SECRET" > /dev/null
  ```

## Testing Locally
To test the cron jobs locally, simply open a browser or use curl to hit your localhost with the secret:
```bash
curl http://localhost:3000/api/cron/accrue-penalties?secret=your_local_secret
```
