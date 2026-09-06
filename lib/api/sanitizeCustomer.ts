/**
 * X-13 — never return secrets in an API payload.
 *
 * `Customer` carries `passwordHash` (the borrower-portal credential). Routes
 * that load a customer with `include:` get every scalar back, so spreading or
 * returning that row leaks the hash. Strip it on the way out.
 *
 * Prisma's `omit` API is not enabled on this schema (no `omitApi` preview
 * feature), so the removal happens here rather than in the query.
 */

/** Scalar fields on Customer that must never reach a client. */
const CUSTOMER_SECRET_FIELDS = ['passwordHash'] as const;

/** Strip secret fields from a single customer-shaped row. */
export function sanitizeCustomer<T extends Record<string, any> | null | undefined>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, any> = { ...row };
  for (const f of CUSTOMER_SECRET_FIELDS) delete out[f];
  return out as T;
}

/** Strip secret fields from a list of customer-shaped rows. */
export function sanitizeCustomers<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map((r) => sanitizeCustomer(r));
}
