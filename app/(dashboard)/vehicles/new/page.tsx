import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import VehicleForm from './VehicleForm';

export default async function NewVehiclePage() {
  const tenantId = await getDefaultTenantId();

  const [customers, loans] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId, appType: 'autofinance', status: 'active' },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.loan.findMany({
      where: { tenantId, appType: 'autofinance', status: 'active', vehicle: null },
      select: { id: true, loanCode: true, customerId: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div>
      <VehicleForm customers={customers} loans={loans} />
    </div>
  );
}
