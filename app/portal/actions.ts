'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppType } from '@/lib/appConfig';

export async function selectApp(appType: AppType) {
  const cookieStore = await cookies();
  cookieStore.set('active_app_type', appType, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  
  redirect('/dashboard');
}
