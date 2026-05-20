// Prisma is imported dynamically inside functions to prevent Edge Runtime errors in middleware

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// IP helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the real client IP from standard proxy headers.
 * Safe to use on Hostinger / reverse-proxied deployments.
 */
export function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const parts = forwarded.split(',');
      const last = parts[parts.length - 1].trim();
      if (last) return last;
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // NOTE: In NextJS 13+ App router `request.ip` might be available if properly populated.
  // We check for it just in case.
  if ((request as any).ip) {
      return (request as any).ip;
  }
  return '0.0.0.0';
}

// ─────────────────────────────────────────────────────────────────────────────
// Key builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate-limit key for login attempts, keyed on both IP and username so that:
 * - An attacker cycling usernames from one IP is still blocked
 * - A targeted lockout attack (flooding a specific username from many IPs)
 *   is also limited per-username
 *
 * Call checkRateLimit twice — once with loginIpKey and once with loginUserKey —
 * to enforce both limits independently.
 */
export function loginIpKey(ip: string): string {
  return `login:ip:${ip}`;
}

export function loginUserKey(username: string): string {
  return `login:user:${username}`;
}

/**
 * Generic per-route + per-IP key, e.g. "route:upload:127.0.0.1"
 */
export function routeKey(route: string, ip: string): string {
  return `route:${route}:${ip}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core rate-limit check (MySQL-backed, atomic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically increments the request counter for `key`.
 *
 * Uses MySQL's `INSERT ... ON DUPLICATE KEY UPDATE` which is a single
 * atomic statement — no separate SELECT or transaction needed.
 *
 * Window reset logic:
 * - If no row exists yet → insert with count = 1
 * - If the existing row's window has expired → reset count to 1, new window
 * - Otherwise → increment count
 *
 * Returns `allowed = false` when `count > limit` after the increment.
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = now;
  const expiresAt = new Date(now.getTime() + options.windowMs);

  const prisma = (await import('./db')).default;
  // Atomic upsert: insert or reset/increment depending on whether window expired
  await prisma.$executeRaw`
    INSERT INTO rate_limits (rate_key, count, window_start, expires_at, created_at, updated_at)
    VALUES (${key}, 1, ${windowStart}, ${expiresAt}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      count        = IF(expires_at <= ${now}, 1,           count + 1),
      window_start = IF(expires_at <= ${now}, ${windowStart}, window_start),
      expires_at   = IF(expires_at <= ${now}, ${expiresAt},   expires_at),
      updated_at   = ${now}
  `;

  // Read current state after the upsert
  const row = await prisma.rateLimit.findUnique({ where: { key } });

  // Fallback: should not happen, but be safe
  if (!row) {
    return { allowed: true, count: 1, remaining: options.limit - 1, resetAt: expiresAt };
  }

  const count = row.count;
  const allowed = count <= options.limit;
  const remaining = Math.max(0, options.limit - count);

  return { allowed, count, remaining, resetAt: row.expiresAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes all expired rate-limit rows from the database.
 * Call this from the daily/hourly cron job to keep the table small.
 * Returns the number of rows deleted.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const prisma = (await import('./db')).default;
  const result = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible in-memory exports (used by unit tests only)
// These are intentionally kept so that existing tests do not break.
// Do NOT use these in production routes — use checkRateLimit() instead.
// ─────────────────────────────────────────────────────────────────────────────

export type FixedWindowEntry = {
  count: number;
  resetAt: number;
};

export type FixedWindowStore = Map<string, FixedWindowEntry>;

export function createFixedWindowStore(): FixedWindowStore {
  return new Map<string, FixedWindowEntry>();
}

export function checkFixedWindowLimit(
  store: FixedWindowStore,
  key: string,
  maxAttempts: number,
  windowMs: number,
  now = Date.now(),
) {
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, maxAttempts - 1), resetAt };
  }

  if (current.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true, remaining: Math.max(0, maxAttempts - current.count), resetAt: current.resetAt };
}

