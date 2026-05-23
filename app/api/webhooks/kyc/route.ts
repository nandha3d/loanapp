import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyDigioWebhook } from '@/lib/kyc/digio';

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get('x-digio-signature') || '';

  if (!verifyDigioWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);
  const { event: eventType, entity } = event;

  // Handle video KYC completion from Digio callback
  if (eventType === 'kyc.completed' && entity?.id) {
    const session = await prisma.kycSession.findFirst({
      where: { digioRequestId: entity.id, method: 'video_kyc' },
    });
    if (session) {
      await prisma.kycSession.update({
        where: { id: session.id },
        data: {
          status:      'video_reviewing',
          responseData: JSON.stringify(entity),
        },
      });
      await prisma.customer.update({
        where: { id: session.customerId },
        data:  { kycStatus: 'video_under_review' },
      });
    }
  }

  return NextResponse.json({ received: true });
}
