'use client';

import { useParams } from 'next/navigation';
import { prefixDashboardHref } from '@/types/modules';

function getModuleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function useDashboardPath() {
  const params = useParams<{ module?: string | string[] }>();
  const module = getModuleParam(params?.module);

  return (href: string) => prefixDashboardHref(href, module);
}
