import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import VehicleForm from './VehicleForm';

export default async function NewVehiclePage() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');

  const [customers, loans] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId, appType, status: 'active' },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.loan.findMany({
      where: { tenantId, appType, status: 'active', vehicle: null },
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
