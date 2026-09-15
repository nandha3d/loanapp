import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = await req.json();
    const { entryId } = body;
    if (!entryId) return fail('entryId is required', 400);

    const entry = await prisma.collectionEntry.findFirst({
      where: { id: entryId, tenantId: ctx.tenantId },
    });
    if (!entry) return fail('Collection entry not found', 404);

    if (entry.verificationStatus === 'pending_confirmation') {
      await prisma.collectionEntry.update({
        where: { id: entryId },
        data: {
          verificationStatus: 'pending',
          customerPinConfirmed: true,
          customerPinConfirmedAt: new Date(),
        },
      });
    }

    return ok({ success: true });
  } catch (e: any) {
    return fail(e.message || 'Confirmation failed', 500);
  }
}
