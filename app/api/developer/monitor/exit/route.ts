import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await auth();
  
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  let domain: string | undefined;
  if (isProduction && rootDomain) {
    domain = `.${rootDomain.split(':')[0]}`;
  } else if (rootDomain && rootDomain.includes('lvh.me')) {
    domain = '.lvh.me';
  }

  cookieStore.delete({
    name: 'monitor-token',
    path: '/',
    ...(domain ? { domain } : {}),
  });

  // Re-direct the developer back to the main admin dashboard on the root domain if subdomains are active
  let redirectUrl = '/admin/users';
  if (rootDomain && !rootDomain.includes('localhost') && process.env.NODE_ENV === 'production') {
    const host = request.headers.get('host') || '';
    const port = host.split(':')[1] ? `:${host.split(':')[1]}` : '';
    redirectUrl = `https://${rootDomain.split(':')[0]}${port}/admin/users`;
  }

  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
