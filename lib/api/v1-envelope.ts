import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/httpError';

export { HttpError };

/**
 * Standard mobile API response envelope.
 * Spec §2.4 — every /api/v1/* response is `{ data, error, pagination }`.
 */
export type Envelope<T> = {
  data: T | null;
  error: string | null;
  pagination: Pagination | null;
};

export type Pagination = {
  page?: number;
  pageSize?: number;
  total?: number;
  // PAGE-01/02: cursor-based pagination for large lists.
  // `nextCursor` = id of last row, client passes back as `?cursor=<id>`.
  // `null` = end of stream.
  nextCursor?: string | null;
  limit?: number;
};

/** Parse `?cursor` + `?limit` from a Request URL. */
export function parseCursorPaging(
  url: string,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): { cursor: string | null; limit: number } {
  const { defaultLimit = 20, maxLimit = 100 } = opts;
  const { searchParams } = new URL(url);
  const cursor = searchParams.get('cursor');
  const raw = Number(searchParams.get('limit') || defaultLimit);
  const limit = Math.min(Math.max(1, Number.isFinite(raw) ? raw : defaultLimit), maxLimit);
  return { cursor: cursor || null, limit };
}

export function ok<T>(data: T, pagination: Pagination | null = null): NextResponse {
  const body: Envelope<T> = { data, error: null, pagination };
  return NextResponse.json(body);
}

export function fail(error: string, status = 400): NextResponse {
  const body: Envelope<null> = { data: null, error, pagination: null };
  return NextResponse.json(body, { status });
}

/**
 * Map a caught error to an envelope. An HttpError carries its own status; any
 * other error is a real server fault → 500. This preserves prior behaviour for
 * untyped errors while letting validators surface a proper 4xx.
 */
export function failFromError(e: any, fallback = 'Request failed'): NextResponse {
  const status = e instanceof HttpError ? e.status : 500;
  return fail(e?.message ?? fallback, status);
}
