import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { buildRouteSheet } from '@/lib/collectionRun';
import { modulePath } from '@/types/modules';
import RunSheetClient from './RunSheetClient';

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session.user!.id;
  const role = (session.user as { role?: string })?.role || 'agent';

  const { id } = await params;
  const run = await prisma.collectionRun.findFirst({ where: { id, tenantId } });
  if (!run) notFound();
  if (role === 'agent' && run.agentId !== userId) notFound();

  const sheet = run.routeId
    ? await buildRouteSheet({ tenantId, appType }, run.routeId, run.date)
    : [];

  const runJson = {
    id: run.id,
    status: run.status,
    date: run.date.toISOString().slice(0, 10),
    expectedTotal: Number(run.expectedTotal),
    collectedTotal: Number(run.collectedTotal),
    cashCollected: Number(run.cashCollected),
    digitalCollected: Number(run.digitalCollected),
    stopsExpected: run.stopsExpected,
    stopsCollected: run.stopsCollected,
    cashDeposited: run.cashDeposited != null ? Number(run.cashDeposited) : null,
    varianceAmount: run.varianceAmount != null ? Number(run.varianceAmount) : null,
  };

  const sheetJson = sheet.map((s) => ({
    stopSeq: s.stopSeq,
    customerId: s.customerId,
    name: s.name,
    customerCode: s.customerCode,
    loanCode: s.loanCode,
    instalmentId: s.instalmentId,
    instalmentNo: s.instalmentNo,
    outstanding: s.outstanding,
    overdue: s.overdue,
    daysOverdue: s.daysOverdue,
  }));

  return (
    <RunSheetClient
      run={runJson}
      sheet={sheetJson}
      backPath={modulePath(appType, '/collection/runs')}
    />
  );
}
