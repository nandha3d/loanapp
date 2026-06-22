import { NextResponse, type NextRequest } from 'next/server';
import { withBasePath } from '@/lib/public-path';

const validIntents = new Set(['login', 'reset', 'verify']);

function isInternalHost(host: string): boolean {
  const hostname = host.toLowerCase().split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function configuredPublicOrigin(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEB_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    '';
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    return isInternalHost(parsed.host) ? null : parsed.origin;
  } catch {
    return null;
  }
}

function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost && !isInternalHost(forwardedHost)) {
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }

  const configured = configuredPublicOrigin();
  if (configured) return configured;

  const host = request.headers.get('host') || request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '') || 'https';
  return `${proto}://${host}`;
}

function redirectUrl(request: NextRequest, path: string): URL {
  return new URL(withBasePath(path), publicOrigin(request));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const providerError =
    request.nextUrl.searchParams.get('error_description') ||
    request.nextUrl.searchParams.get('error');
  const intentParam = request.nextUrl.searchParams.get('intent') || 'login';
  const intent = validIntents.has(intentParam) ? intentParam : 'login';

  const target = redirectUrl(request, '/auth/callback');
  target.searchParams.set('intent', intent);
  if (code) target.searchParams.set('code', code);
  if (providerError) {
    target.searchParams.set('error_description', providerError);
  }

  return NextResponse.redirect(target);
}
