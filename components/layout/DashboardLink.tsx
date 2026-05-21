'use client';

import NextLink, { type LinkProps } from 'next/link';
import { useParams } from 'next/navigation';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { prefixDashboardHref } from '@/types/modules';

type DashboardLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: ReactNode;
  };

function getModuleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function DashboardLink({ href, ...props }: DashboardLinkProps) {
  const params = useParams<{ module?: string | string[] }>();
  const module = getModuleParam(params?.module);
  const resolvedHref = typeof href === 'string' ? prefixDashboardHref(href, module) : href;

  return <NextLink href={resolvedHref} {...props} />;
}
