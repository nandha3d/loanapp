import { PrismaClient } from '@prisma/client';
import { assertSafeTestDatabase } from './env';

let client: PrismaClient | null = null;

/** Prisma bound to the QA database, shared across specs in a worker. */
export function db(): PrismaClient {
  if (!client) {
    const url = assertSafeTestDatabase();
    client = new PrismaClient({ datasources: { db: { url } } });
  }
  return client;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

export const num = (value: unknown): number => Number(value ?? 0);

/**
 * Poll the database until `read` returns a row.
 *
 * Server actions in dev can take several seconds on a cold route, so a fixed
 * sleep after a submit is either flaky or wasteful. Polling the row the action
 * is supposed to write is both faster and honest about what we are waiting for.
 */
export async function waitForRow<T>(
  read: () => Promise<T | null>,
  what: string,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | null = null;
  while (Date.now() < deadline) {
    last = await read();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${what}`);
}
