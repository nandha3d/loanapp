// In-process TTL cache for per-tenant settings reads.
// Single-process deployment (PM2 single instance) — no cross-process
// invalidation needed. Stale window: 30 seconds, acceptable for values
// that only change on explicit admin action. Call invalidateTenantCache()
// from settings-write paths for an immediate bust.

type CacheEntry<T> = { value: T; expiresAt: number };

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private ttlMs: number) {
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.sweep(), ttlMs * 4);
      if (typeof timer.unref === 'function') timer.unref();
    }
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) this.store.delete(key);
    }
  }
}

const TTL_MS = 30_000;

/** tenantId → full AppSetting key/value map */
export const appSettingCache = new TtlCache<Record<string, string>>(TTL_MS);
/** arbitrary boolean flags, e.g. `acct:<tenantId>` for premium accounting */
export const flagCache = new TtlCache<boolean>(TTL_MS);

/** Bust all cached values for a tenant. Call after a settings write. */
export function invalidateTenantCache(tenantId: string): void {
  appSettingCache.delete(tenantId);
  flagCache.deleteByPrefix(`acct:${tenantId}`);
}
