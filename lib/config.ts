function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Central URL/domain config. Code that needs deployment URLs should read from
 * here instead of scattering environment-variable fallbacks inline.
 */
export const config = {
  apiUrl: trimTrailingSlash(
    process.env.APP_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000',
  ),
  webAppUrl: trimTrailingSlash(
    process.env.WEB_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000',
  ),
  publicApiUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL ?? ''),
  publicAppUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? ''),
  rootDomain: (process.env.APP_ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || '')
    .toLowerCase()
    .split(':')[0],
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  authSecret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '',
  mobileJwtSecret: process.env.MOBILE_JWT_SECRET ?? '',
  piiKey: process.env.PII_ENCRYPTION_KEY ?? '',
  corsExtraOrigins: splitCsv(process.env.CORS_EXTRA_ORIGINS),
  uploadDir: process.env.UPLOAD_DIR ?? 'private/uploads',

  get isProd() {
    return this.nodeEnv === 'production';
  },

  get isDev() {
    return this.nodeEnv === 'development';
  },

  fileUrl(storedPath: string | null | undefined): string {
    if (!storedPath) return '';
    if (/^https?:\/\//i.test(storedPath)) return storedPath;
    return `${this.apiUrl}${storedPath.startsWith('/') ? '' : '/'}${storedPath}`;
  },
} as const;
