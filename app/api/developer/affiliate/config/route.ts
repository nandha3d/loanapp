import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';
import { setSetting } from '@/lib/tenant';

export async function GET() {
  try {
    const authResult = await requireApiContext(['developer']);
    if ('response' in authResult && authResult.response) return authResult.response;

    const defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
    if (!defaultTenant) {
      return apiError('Default tenant not found.', 500);
    }
    const tenantId = defaultTenant.id;

    const [threshold, rate, months, yearlyMonths] = await Promise.all([
      prisma.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'affiliate_threshold' } } }),
      prisma.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'affiliate_commission_rate' } } }),
      prisma.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'affiliate_commission_months' } } }),
      prisma.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'affiliate_yearly_free_months' } } }),
    ]);

    return apiSuccess({
      threshold: threshold ? parseInt(threshold.value, 10) : 10,
      monthlyCommissionRate: rate ? parseFloat(rate.value) : 0.3,
      monthlyCommissionMonths: months ? parseInt(months.value, 10) : 5,
      yearlyRewardFreeMonths: yearlyMonths ? parseInt(yearlyMonths.value, 10) : 12,
    });
  } catch (error: any) {
    console.error('[API_DEVELOPER_AFFILIATE_CONFIG_GET]', error);
    return apiError(error.message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(['developer']);
    if ('response' in authResult && authResult.response) return authResult.response;

    const defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
    if (!defaultTenant) {
      return apiError('Default tenant not found.', 500);
    }
    const tenantId = defaultTenant.id;

    const body = await request.json();
    const { threshold, monthlyCommissionRate, monthlyCommissionMonths, yearlyRewardFreeMonths } = body;

    // Save to AppSetting database under affiliate group
    if (threshold !== undefined) {
      await setSetting(tenantId, 'affiliate_threshold', String(threshold), 'affiliate');
    }
    if (monthlyCommissionRate !== undefined) {
      await setSetting(tenantId, 'affiliate_commission_rate', String(monthlyCommissionRate), 'affiliate');
    }
    if (monthlyCommissionMonths !== undefined) {
      await setSetting(tenantId, 'affiliate_commission_months', String(monthlyCommissionMonths), 'affiliate');
    }
    if (yearlyRewardFreeMonths !== undefined) {
      await setSetting(tenantId, 'affiliate_yearly_free_months', String(yearlyRewardFreeMonths), 'affiliate');
    }

    return apiSuccess({
      message: 'Affiliate system configurations updated successfully.',
      config: {
        threshold,
        monthlyCommissionRate,
        monthlyCommissionMonths,
        yearlyRewardFreeMonths,
      },
    });
  } catch (error: any) {
    console.error('[API_DEVELOPER_AFFILIATE_CONFIG_POST]', error);
    return apiError(error.message, 500);
  }
}
