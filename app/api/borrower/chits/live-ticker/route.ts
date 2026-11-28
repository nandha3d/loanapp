import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { getSetting } from '@/lib/tenant';
import { getBorrowerChitLiveTicker } from '@/lib/chits/liveTicker';

export async function GET() {
  const session = await getBorrowerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const currencySymbol = await getSetting(session.tenantId, 'currency_symbol', '₹');
  const ticker = await getBorrowerChitLiveTicker(prisma, {
    tenantId: session.tenantId,
    customerId: session.customerId,
    currencySymbol,
  });
  return NextResponse.json({ ok: true, ticker });
}
