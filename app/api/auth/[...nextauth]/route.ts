import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';

function stripProdAuthUrlOnLocalDev(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return;
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) return;
  const host = (request.headers.get('host') || request.nextUrl.host || '').toLowerCase().split(':')[0];
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    if (process.env.AUTH_URL && !process.env.AUTH_URL.includes('localhost') && !process.env.AUTH_URL.includes('127.0.0.1')) {
      delete process.env.AUTH_URL;
    }
    if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('localhost') && !process.env.NEXTAUTH_URL.includes('127.0.0.1')) {
      delete process.env.NEXTAUTH_URL;
    }
  }
}

export async function GET(request: NextRequest, context: any) {
  stripProdAuthUrlOnLocalDev(request);
  return handlers.GET(request, context);
}

export async function POST(request: NextRequest, context: any) {
  stripProdAuthUrlOnLocalDev(request);
  return handlers.POST(request, context);
}
