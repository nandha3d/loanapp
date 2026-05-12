import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import ChitGroupForm from './ChitGroupForm';

export default async function NewChitGroupPage() {
  const tenantId = await getDefaultTenantId();

  const customers = await prisma.customer.findMany({
    where: { tenantId, appType: 'chitfunds', status: 'active' },
    select: { id: true, name: true, customerCode: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <ChitGroupForm customers={customers} />
    </div>
  );
}
