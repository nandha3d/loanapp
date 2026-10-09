'use client';

import { useState, useEffect } from 'react';

/**
 * Single source of truth for Portal navigation links from public marketing pages.
 *
 * In production on the public marketing domain (zolofunds.com / www.zolofunds.com),
 * actions redirect to the portal subdomain (app.zolofunds.com).
 * In development or on local environments, relative paths are used.
 */

export function getPortalLoginUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'zolofunds.com' || host === 'www.zolofunds.com') {
      return 'https://app.zolofunds.com/login';
    }
  }
  return '/login?callbackUrl=/portal';
}

export function getPortalRegisterUrl(plan?: string): string {
  const query = plan ? `?plan=${encodeURIComponent(plan)}` : '';
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'zolofunds.com' || host === 'www.zolofunds.com') {
      return `https://app.zolofunds.com/register${query}`;
    }
  }
  return `/register${query}`;
}

export function getPortalDashboardUrl(path = '/portal'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'zolofunds.com' || host === 'www.zolofunds.com') {
      return `https://app.zolofunds.com${cleanPath}`;
    }
  }
  return cleanPath;
}

export function usePortalUrls() {
  const [urls, setUrls] = useState({
    login: 'https://app.zolofunds.com/login',
    register: 'https://app.zolofunds.com/register',
    portal: 'https://app.zolofunds.com/portal',
  });

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    const isProdZolo = host === 'zolofunds.com' || host === 'www.zolofunds.com';
    setUrls({
      login: isProdZolo ? 'https://app.zolofunds.com/login' : '/login?callbackUrl=/portal',
      register: isProdZolo ? 'https://app.zolofunds.com/register' : '/register',
      portal: isProdZolo ? 'https://app.zolofunds.com/portal' : '/portal',
    });
  }, []);

  return urls;
}
