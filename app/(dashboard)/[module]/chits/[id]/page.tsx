import prisma from '@/lib/db';
import { getSetting } from '@/lib/tenant';
import { notFound } from 'next/navigation';
import ChitGroupDetailClient from './ChitGroupDetailClient';
import { getCurrentLanguage, getDictionary } from '@/lib/i18n';
import { getWebChitScope, scopedChitGroupWhere } from '@/lib/chits/access';
import { buildChitGroupDividendLedger } from '@/lib/chits/memberDividendLedger';
import { getCashDenominationMode } from '@/lib/chits/denominations';
import { resolveEngineTypeFromGroup } from '@/lib/chits/engineTypes';
import { getChitPlanEntitlements } from '@/lib/chits/planEntitlements';

export default async function ChitGroupDetailPage({ params }: { params: Promise<{ id: string; module: string }> }) {
  const { id } = await params;
  const scope = await getWebChitScope();
  const tenantId = scope.tenantId;
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const [dict, lang] = await Promise.all([getDictionary(tenantId), getCurrentLanguage(tenantId)]);

  let group: any = null;
  try {
    group = await prisma.chitGroup.findFirst({
      where: scopedChitGroupWhere(scope, { OR: [{ id }, { groupCode: id }] }),
      include: {
        members: {
          orderBy: { memberNumber: 'asc' },
          include: {
            customer: { select: { id: true, name: true, customerCode: true } },
            subscriptions: { orderBy: { periodNumber: 'asc' } },
          },
        },
        foremen: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                role: true,
                customRoleName: true,
                customRole: { select: { name: true } },
              },
            },
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

  const [dividendLedger, poolTransactions, staffUsers, branchCustomers, cashDenominationMode, chitEntitlements] = await Promise.all([
    buildChitGroupDividendLedger(group.id, scope),
    resolveEngineTypeFromGroup(group) === 'ASCA_SHG_REVOLVING'
      ? prisma.chitPoolTransaction.findMany({
          where: { tenantId, appType: scope.appType, chitGroupId: group.id },
          orderBy: { txnDate: 'desc' },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: {
        tenantId,
        status: 'active',
        deletedAt: null,
        OR: [
          { role: { in: ['admin', 'superadmin'] } },
          { role: 'agent', appType: 'chitfunds', ...(scope.branchId ? { branchId: scope.branchId } : {}) },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        customRoleName: true,
        customRole: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({
      where: {
        tenantId,
        appType: scope.appType,
        status: 'active',
        deletedAt: null,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: 'asc' },
    }),
    getCashDenominationMode(prisma, tenantId),
    getChitPlanEntitlements(prisma, tenantId),
  ]);

  return (
    <ChitGroupDetailClient
      group={JSON.parse(JSON.stringify(group))}
      dividendLedger={dividendLedger}
      poolTransactions={JSON.parse(JSON.stringify(poolTransactions))}
      staffUsers={JSON.parse(JSON.stringify(staffUsers))}
      customers={JSON.parse(JSON.stringify(branchCustomers))}
      cashDenominationMode={cashDenominationMode}
      canExportStatutoryRegisters={chitEntitlements.canExportStatutoryRegisters}
      currencySymbol={currencySymbol}
      lang={lang}
      dict={dict}
    />
  );
}
