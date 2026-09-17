import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import ChitGroupEditForm from './ChitGroupEditForm';

export default async function EditChitGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'chitfunds');
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  const group = await prisma.chitGroup.findFirst({
    where: { OR: [{ id }, { groupCode: id }], tenantId, appType },
    select: { id: true, name: true, commissionPct: true, status: true },
  });

  if (!group) notFound();

  return (
    <div>
      <ChitGroupEditForm group={JSON.parse(JSON.stringify(group))} currencySymbol={currencySymbol} dict={dict} />
    </div>
  );
}
