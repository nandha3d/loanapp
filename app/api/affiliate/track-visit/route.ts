import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, referrer } = body;

    if (!code) {
      return apiError('Missing referral code.', 400);
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { code },
    });

    if (!affiliate) {
      return apiError('Invalid affiliate code.', 404);
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const visit = await prisma.affiliateVisit.create({
      data: {
        affiliateId: affiliate.id,
        ipAddress,
        userAgent,
        referrerUrl: referrer || 'direct',
      },
    });

    return apiSuccess({
      message: 'Visit tracked',
      visitId: visit.id,
    });
  } catch (error: any) {
    console.error('[API_AFFILIATE_TRACK_VISIT]', error);
    return apiError(error.message, 500);
  }
}
