import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getClientIp } from '@/lib/rateLimit';

/**
 * SEC-13: cron route guard.
 *  - Verifies Bearer token (constant-time compare).
 *  - If CRON_IP_ALLOWLIST env is set (comma-separated IPs/CIDRs), enforces it.
 *  - Empty allowlist = bearer-only (back-compat for local/dev).
 */
export function authorizeCron(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const a = Buffer.from(cronSecret);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowlist = (process.env.CRON_IP_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length > 0) {
    const ip = getClientIp(req);
    if (!allowlist.includes(ip)) {
      return NextResponse.json({ error: 'Forbidden (IP)' }, { status: 403 });
    }
  }
  return null;
}
