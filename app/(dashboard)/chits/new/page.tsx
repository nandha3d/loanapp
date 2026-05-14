import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import ChitGroupForm from './ChitGroupForm';
import { getDictionary } from '@/lib/i18n';

export default async function NewChitGroupPage() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'chitfunds');
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  const customers = await prisma.customer.findMany({
    where: { tenantId, appType, status: 'active' },
    select: { id: true, name: true, customerCode: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <ChitGroupForm customers={customers} currencySymbol={currencySymbol} dict={dict} />
    </div>
  );
}
