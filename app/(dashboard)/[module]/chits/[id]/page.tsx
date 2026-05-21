import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { notFound } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import ChitGroupDetailClient from './ChitGroupDetailClient';
import { getDictionary } from '@/lib/i18n';

export default async function ChitGroupDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'chitfunds');
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  let group: any = null;
  try {
    group = await prisma.chitGroup.findFirst({
      where: { id, tenantId, appType },
      include: {
        members: {
          orderBy: { memberNumber: 'asc' },
          include: {
            customer: { select: { id: true, name: true, customerCode: true } },
            subscriptions: { orderBy: { periodNumber: 'asc' } },
          },
        },
        auctions: {
          orderBy: { periodNumber: 'asc' },
          include: {
            winnerMember: {
              include: { customer: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
  } catch { /* table may not exist yet */ }

  if (!group) notFound();

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/chits" className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          Back to Chit Groups
        </Link>
        <div>
          <h2 style={{ margin: 0 }}>{group.name}</h2>
          <span className={`badge badge-${group.status === 'active' ? 'success' : 'secondary'}`} style={{ marginLeft: '8px' }}>{group.status}</span>
        </div>
      </div>
      <ChitGroupDetailClient group={group} currencySymbol={currencySymbol} dict={dict} />
    </div>
  );
}
