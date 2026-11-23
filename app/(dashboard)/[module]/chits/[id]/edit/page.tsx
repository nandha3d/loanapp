import { auth } from '@/lib/auth';
import { branchScopeWhere, getActiveBranchId } from '@/lib/branch';
import { canAdminChits } from '@/lib/chits/access';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';
import { notFound, redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import ChitGroupEditForm from './ChitGroupEditForm';

export default async function EditChitGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  const appType = await getUserAppType();
  const role = (session.user as any)?.role as string | undefined;
  if (!canAdminChits(role)) redirect(modulePath(appType, '/collection'));

  const tenantId = await getDefaultTenantId();
  await requireModule(tenantId, 'chitfunds');
  const branchId = await getActiveBranchId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  const group = await prisma.chitGroup.findFirst({
    where: {
      OR: [{ id }, { groupCode: id }],
      tenantId,
      appType,
      deletedAt: null,
      ...branchScopeWhere(branchId),
    },
    select: { id: true, name: true, commissionPct: true, status: true, chitEngineType: true, engineConfig: true },
  });

  if (!group) notFound();

  return (
    <div>
      <ChitGroupEditForm group={JSON.parse(JSON.stringify(group))} currencySymbol={currencySymbol} dict={dict} />
    </div>
  );
}
