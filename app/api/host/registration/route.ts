import { NextRequest, NextResponse } from 'next/server';
import { getCustomDomainTenantId } from '@/lib/tenant';

// Reports whether self-registration is allowed on the requesting host.
// Disabled on a client's custom domain (standalone instance) so they can't
// register additional businesses/superadmins.
export async function GET(req: NextRequest) {
  const host = req.headers.get('x-loantrack-host') || req.headers.get('host');
  const standaloneTenant = await getCustomDomainTenantId(host).catch(() => null);
  return NextResponse.json(
    { allowed: !standaloneTenant, standalone: Boolean(standaloneTenant) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
