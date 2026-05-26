import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled, getFiscalYear } from '@/lib/accounting/premium';
import PeriodLockClient from './PeriodLockClient';
import { listPeriods, listAuditLog, getDistinctFiscalYears } from './actions';

export default async function PeriodLockPage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ fy?: string }> }) {
  const { module } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  if (!['admin','superadmin','developer'].includes(role)) redirect(`/${module}`);

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${module}/accounting`);

  const today = new Date();
  const currentFy = getFiscalYear(today);
  const selectedFy = sp.fy ?? currentFy;

  const [periods, auditResult, fiscalYears] = await Promise.all([
    listPeriods(selectedFy),
    listAuditLog({}, undefined, 50),
    getDistinctFiscalYears(),
  ]);

  const allFys = fiscalYears.includes(currentFy) ? fiscalYears : [currentFy, ...fiscalYears];

  return <PeriodLockClient module={module} periods={periods as any} auditRows={auditResult.rows as any} fiscalYears={allFys} currentFy={selectedFy} />;
}
