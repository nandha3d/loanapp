import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const SAFE_DB_MARKERS = ['test', 'qa', 'e2e', 'ci'];
const UNSAFE_DB_MARKERS = ['prod', 'production', 'live', 'main', 'primary'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

let prisma: PrismaClient | null = null;
let guardedUrl: string | null = null;

export function requireTestDatabaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Business E2E tests must not run with NODE_ENV=production.');
  }

  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is required for business E2E tests.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid database URL.');
  }

  if (!/^mysql:$/i.test(parsed.protocol)) {
    throw new Error('Business E2E tests currently support only MySQL TEST_DATABASE_URL values.');
  }

  const dbName = parsed.pathname.replace(/^\/+/, '').toLowerCase();
  assert.ok(dbName, 'TEST_DATABASE_URL must include a database name.');

  if (UNSAFE_DB_MARKERS.some((marker) => dbName.includes(marker))) {
    throw new Error(`Refusing to run business E2E tests against unsafe database name: ${dbName}`);
  }

  if (!SAFE_DB_MARKERS.some((marker) => dbName.includes(marker))) {
    throw new Error(
      `Refusing to run business E2E tests against database "${dbName}". ` +
        `Name must include one of: ${SAFE_DB_MARKERS.join(', ')}`,
    );
  }

  const allowRemote = process.env.ALLOW_REMOTE_TEST_DATABASE_URL === 'true';
  if (!allowRemote && !LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `Refusing remote TEST_DATABASE_URL host "${parsed.hostname}". ` +
        'Set ALLOW_REMOTE_TEST_DATABASE_URL=true only for a disposable CI database.',
    );
  }

  process.env.DATABASE_URL = url;
  process.env.AUTH_SECRET ||= 'business-e2e-secret-business-e2e-secret';
  process.env.NEXTAUTH_SECRET ||= process.env.AUTH_SECRET;
  process.env.MOBILE_JWT_SECRET ||= process.env.AUTH_SECRET;
  process.env.PII_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';
  process.env.AUTH_URL ||= 'http://localhost:3000';
  process.env.NEXT_PUBLIC_APP_URL ||= 'http://localhost:3000';
  guardedUrl = url;
  return url;
}

export function getRunId(): string {
  const existing = process.env.BUSINESS_E2E_RUN_ID;
  if (existing) return existing;
  const suffix = Math.random().toString(36).slice(2, 8);
  const runId = `e2e-${Date.now()}-${suffix}`.toLowerCase();
  process.env.BUSINESS_E2E_RUN_ID = runId;
  return runId;
}

export function getPrisma(): PrismaClient {
  const url = requireTestDatabaseUrl();
  if (prisma && guardedUrl === url) return prisma;
  prisma = new PrismaClient({ datasources: { db: { url } } });
  guardedUrl = url;
  return prisma;
}

export async function disconnectTestDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export const APP_TYPE = 'microlending';
export const TEST_PASSWORD = 'TestPass123!';
