import { NextRequest, NextResponse } from 'next/server';
import { getCustomDomainTenantId, isStandaloneDomainHost } from '@/lib/tenant';

// Reports registration policy for the requesting host:
//   allowed    – can register here (false once a custom-domain tenant is bound)
//   standalone – host already maps to a client tenant (claimed)
//   simpleMode – host is a client's own domain not yet claimed → Details-only
//                registration that claims it as the lifetime owner on submit.
export async function GET(req: NextRequest) {
  const host = req.headers.get('x-loantrack-host') || req.headers.get('host');
  const standaloneTenant = await getCustomDomainTenantId(host).catch(() => null);
  const simpleMode = !standaloneTenant && isStandaloneDomainHost(host);
  return NextResponse.json(
    { allowed: !standaloneTenant, standalone: Boolean(standaloneTenant), simpleMode },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
