export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 200;

/**
 * Parse and clamp pagination params from URL search params.
 * Accepts either `pageSize` or `limit` (mobile uses `limit`).
 * Never lets a caller exceed PAGE_SIZE_MAX — protects low-spec servers
 * from `?pageSize=999999` full-table scans.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { pageSize?: number } = {},
): { page: number; pageSize: number; skip: number } {
  const def = defaults.pageSize ?? PAGE_SIZE_DEFAULT;
  const rawSize = searchParams.get('pageSize') ?? searchParams.get('limit');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, parseInt(rawSize ?? String(def), 10) || def),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
