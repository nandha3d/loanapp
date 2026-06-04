import { serverFetch } from '@/lib/api-client/server';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';
import RunSheetClient from './RunSheetClient';

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect('/login');
  const appType = await getUserAppType();

  const { id } = await params;
  
  let runData: any = null;
  try {
    const res = await serverFetch<any>(`/collection/run/${id}/sheet`);
    runData = res?.data;
  } catch (err) {
    // Handle error
  }

  if (!runData || !runData.run) {
    notFound();
  }

  const { run, sheet } = runData;

  const runJson = {
    id: run.id,
    status: run.status,
    date: new Date(run.date).toISOString().slice(0, 10),
    expectedTotal: Number(run.expectedTotal),
    collectedTotal: Number(run.collectedTotal),
    cashCollected: Number(run.cashCollected),
    digitalCollected: Number(run.digitalCollected),
    stopsExpected: run.stopsExpected,
    stopsCollected: run.stopsCollected,
    cashDeposited: run.cashDeposited != null ? Number(run.cashDeposited) : null,
    varianceAmount: run.varianceAmount != null ? Number(run.varianceAmount) : null,
  };

  const sheetJson = (sheet || []).map((s: any) => ({
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

