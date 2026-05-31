import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(['developer']);
    if ('response' in authResult && authResult.response) return authResult.response;

    const body = await request.json();
    const { rewardId, status } = body;

    if (!rewardId || !status) {
      return apiError('Missing required fields: rewardId and status are mandatory.', 400);
    }

    if (!['pending', 'granted', 'paid'].includes(status)) {
      return apiError('Invalid status value. Must be pending, granted, or paid.', 400);
    }

    const reward = await prisma.affiliateReward.findUnique({
      where: { id: rewardId },
    });

    if (!reward) {
      return apiError('AffiliateReward not found.', 404);
    }

    const updated = await prisma.affiliateReward.update({
      where: { id: rewardId },
      data: {
        status,
        grantedAt: status === 'granted' || status === 'paid' ? new Date() : reward.grantedAt,
      },
    });

    return apiSuccess({
      message: `Reward status updated successfully to "${status}".`,
      reward: updated,
    });
  } catch (error: any) {
    console.error('[API_DEVELOPER_AFFILIATE_REWARDS_POST]', error);
    return apiError(error.message, 500);
  }
}
