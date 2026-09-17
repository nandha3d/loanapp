import { NextResponse } from 'next/server';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { renderBorrowerLoanStatement } from '@/lib/borrowerStatement';

// The borrower dashboard has linked /api/borrower/statement?loanId=… since
// launch, but this route never existed (silent 404). Audit 03 parity fix.
export async function GET(req: Request) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loanId = new URL(req.url).searchParams.get('loanId') || '';
  if (!loanId) return NextResponse.json({ error: 'loanId is required' }, { status: 400 });

  try {
    const { buffer, filename } = await renderBorrowerLoanStatement({
      tenantId: session.tenantId,
      customerId: session.customerId,
      loanId,
    });
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Statement failed' }, { status: 400 });
  }
}
