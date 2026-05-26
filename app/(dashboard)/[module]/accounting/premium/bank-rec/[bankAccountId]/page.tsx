import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import { getBankAccountDetail, getStatementWithLines } from '../actions';
import WorkspaceClient from './WorkspaceClient';

export default async function BankRecWorkspacePage({ params, searchParams }: {
  params: { module: string; bankAccountId: string };
  searchParams: { statementId?: string };
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  if (!['admin','superadmin','developer'].includes(role)) redirect(`/${params.module}`);

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${params.module}/accounting`);

  const bankAccount = await getBankAccountDetail(params.bankAccountId);
  if (!bankAccount) redirect(`/${params.module}/accounting/premium/bank-rec`);

  // Get most recent statement, or the one from searchParams
  const statementId = searchParams.statementId ?? (bankAccount.statements?.[0] as any)?.id;
  const statement = statementId ? await getStatementWithLines(statementId) : null;

  return <WorkspaceClient statement={statement} bankAccount={bankAccount} />;
}
