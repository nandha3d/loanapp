export function normalizeLocalCallbackUrl(
  rawCallbackUrl: string | null | undefined,
  fallback = '/',
): string {
  const raw = (rawCallbackUrl || '').trim();
  if (!raw) return fallback;

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
  } catch {
    return fallback;
  }
}
