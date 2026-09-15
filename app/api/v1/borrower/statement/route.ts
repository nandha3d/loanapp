import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { renderBorrowerLoanStatement } from '@/lib/borrowerStatement';

// Mobile borrower loan-statement PDF (audit 03 parity). Returns raw PDF bytes,
// not the ok() JSON envelope — the app feeds them straight to the print/share
// sheet.
export async function GET(req: NextRequest) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);

  const loanId = new URL(req.url).searchParams.get('loanId') || borrower.loanId;
  if (!loanId) return fail('loanId is required', 400);

  try {
    const { buffer, filename } = await renderBorrowerLoanStatement({
      tenantId: borrower.tenantId,
      customerId: borrower.customerId,
      loanId,
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Statement failed', 400);
  }
}
