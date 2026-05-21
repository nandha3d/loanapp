import { NextResponse } from 'next/server';

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
  page: number;
  pageSize: number;
  total: number;
};

export function ok<T>(data: T, pagination: Pagination | null = null): NextResponse {
  const body: Envelope<T> = { data, error: null, pagination };
  return NextResponse.json(body);
}

export function fail(error: string, status = 400): NextResponse {
  const body: Envelope<null> = { data: null, error, pagination: null };
  return NextResponse.json(body, { status });
}
