function normalizeBasePath(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

export const publicBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export function withBasePath(path: string): string {
  if (!publicBasePath) return path;
  if (!path.startsWith('/')) return path;
  if (path === publicBasePath || path.startsWith(`${publicBasePath}/`)) return path;
  return `${publicBasePath}${path}`;
}

export function currentOriginWithBasePath(): string {
  if (typeof window === 'undefined') return publicBasePath;
  return `${window.location.origin}${publicBasePath}`;
}
