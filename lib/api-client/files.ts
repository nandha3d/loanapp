const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export function resolveFileUrl(storedPath: string | null | undefined): string {
  if (!storedPath) return '';
  if (/^https?:\/\//i.test(storedPath)) return storedPath;
  if (!API_BASE) return storedPath;
  return `${API_BASE}${storedPath.startsWith('/') ? '' : '/'}${storedPath}`;
}

export function fileOrFallback(
  storedPath: string | null | undefined,
  fallback = '',
): string {
  return resolveFileUrl(storedPath) || fallback;
}
