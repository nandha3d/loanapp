import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserAppType, getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled, getPeriodKey, getFiscalYear } from '@/lib/accounting/premium';
import { prisma } from '@/lib/db';
import TaxClient from './TaxClient';
import { getGstSummary, getTdsRegister } from './actions';

export const metadata = { title: 'Tax & GST' };

export default async function TaxPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  const { module } = await params;
  if (!['admin', 'superadmin', 'developer'].includes(role)) redirect(`/${module}`);

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${module}/accounting`);

  const today = new Date();
  const sp = await searchParams;
  const periodKey = sp.period ?? getPeriodKey(today);
  const fy = getFiscalYear(today);
  // Build quarter key for current quarter
  const fyStart = Number(fy.split('-')[0]);
  const month = today.getMonth() + 1; // 1-based
  // April=1, May=1, Jun=1, Jul=2, Aug=2, Sep=2, Oct=3, Nov=3, Dec=3, Jan=4, Feb=4, Mar=4
  let q: number;
  if (month >= 4 && month <= 6) q = 1;
  else if (month >= 7 && month <= 9) q = 2;
  else if (month >= 10 && month <= 12) q = 3;
  else q = 4;
  const quarterKey = `Q${q}-${fyStart}-${String(fyStart + 1).slice(-2)}`;

  const settings = await prisma.accountingSettings.findUnique({
    where: { tenantId },
    select: { gstin: true },
  });

  const [summary, tdsRows] = await Promise.all([
    getGstSummary(periodKey),
    getTdsRegister(quarterKey),
  ]);

  return (
    <TaxClient
      module={module}
      initialPeriod={periodKey}
      initialSummary={summary}
      tdsRows={tdsRows}
      gstin={settings?.gstin ?? null}
    />
  );
}
