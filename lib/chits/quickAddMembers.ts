import { randomUUID } from 'crypto';
import { createChitAudit } from './audit';
import { roundMoney } from './calculations';
import { nextPeriodDate, parseFrequency } from './frequency';
import { getChitPlanEntitlements } from './planEntitlements';

export interface QuickAddMemberEntry {
  fullName: string;
  phone: string;
  alias?: string | null;
  address?: string | null;
  ticketCount?: number;
}

/** Normalizes Indian mobile numbers (+91 / 0 / spaces / hyphens) to 10-digit canonical format. */
export function normalizeIndianPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export async function quickAddChitMembers(
  tx: any,
  scope: { tenantId: string; appType: string; branchId?: string | null; userId: string },
  groupId: string,
  entries: QuickAddMemberEntry[],
  options?: { expandGroupCapacity?: boolean },
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('At least one member entry is required');
  }

  const group = await tx.chitGroup.findFirst({
    where: {
      id: groupId,
      tenantId: scope.tenantId,
      appType: 'chitfunds',
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      deletedAt: null,
    },
    include: {
      members: { select: { id: true, memberNumber: true, ticketNo: true, customerId: true } },
    },
  });
  if (!group) throw new Error('Chit group not found');

  const requestedTickets = entries.reduce(
    (s, e) => s + Math.max(1, Math.min(20, Math.trunc(Number(e.ticketCount ?? 1) || 1))),
    0,
  );
  const currentCount = group.members.length;
  const nextTotalCount = currentCount + requestedTickets;

  const entitlements = await getChitPlanEntitlements(tx, scope.tenantId);
  if (entitlements.maxMembersPerChit != null && nextTotalCount > entitlements.maxMembersPerChit) {
    throw new Error(
      `Plan member limit (${entitlements.maxMembersPerChit}) exceeded by ${nextTotalCount} tickets.`,
    );
  }

  if (nextTotalCount > group.totalMembers) {
    if (options?.expandGroupCapacity) {
      await tx.chitGroup.update({
        where: { id: group.id },
        data: { totalMembers: nextTotalCount, durationMonths: nextTotalCount },
      });
    } else {
      throw new Error(
        `Adding ${requestedTickets} ticket(s) exceeds group capacity (${currentCount}/${group.totalMembers}).`,
      );
    }
  }

  const branchId = group.branchId ?? scope.branchId ?? null;
  let nextMemberNo =
    group.members.reduce((max: number, m: any) => Math.max(max, Number(m.memberNumber || 0)), 0) + 1;

  const results: Array<{
    memberId: string;
    customerId: string;
    name: string;
    phone: string;
    ticketNo: string;
    createdNewCustomer: boolean;
  }> = [];

  for (const entry of entries) {
    const cleanName = String(entry.fullName ?? '').trim();
    const cleanPhone = normalizeIndianPhone(entry.phone);
    if (!cleanName) throw new Error('fullName is required for each member');
    if (!cleanPhone) throw new Error(`Invalid phone number for ${cleanName}`);

    const candidates = [cleanPhone, `91${cleanPhone}`, `+91${cleanPhone}`];
    let customer = await tx.customer.findFirst({
      where: {
        tenantId: scope.tenantId,
        appType: 'chitfunds',
        phone: { in: candidates },
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true, name: true, phone: true },
    });

    let createdNewCustomer = false;
    if (!customer) {
      customer = await tx.customer.create({
        data: {
          tenantId: scope.tenantId,
          appType: 'chitfunds',
          branchId: branchId || undefined,
          customerCode: `CUST-${randomUUID().slice(0, 8).toUpperCase()}`,
          name: cleanName,
          phone: cleanPhone,
          address: entry.address?.trim() || undefined,
          occupation: entry.alias?.trim() || undefined,
          kycStatus: 'MINIMAL',
          status: 'active',
        },
        select: { id: true, name: true, phone: true },
      });
      createdNewCustomer = true;
    }

    const ticketCount = Math.max(1, Math.min(20, Math.trunc(Number(entry.ticketCount ?? 1) || 1)));
    for (let t = 0; t < ticketCount; t++) {
      const memberNumber = nextMemberNo++;
      const ticketNo = String(memberNumber);
      const member = await tx.chitMember.create({
        data: {
          chitGroupId: group.id,
          customerId: customer.id,
          memberNumber,
          ticketNo,
          ticketShare: 1,
          subscriberStatus: 'active',
          agreementStatus: group.chitType === 'registered' ? 'pending' : 'signed',
          agreementSignedAt: group.chitType === 'registered' ? null : new Date(),
        },
      });

      // If group is already active, generate subscriptions for future cycles so dues stay consistent
      if (group.status === 'active') {
        const freq = parseFrequency(group);
        const startCycle = Math.max(1, Number(group.migrationStartCycle ?? 1));
        const totalCycles = Number(group.durationMonths || group.totalMembers);
        const baseDue = roundMoney(Number(group.monthlyContrib));
        for (let p = startCycle; p <= totalCycles; p++) {
          await tx.chitSubscription.create({
            data: {
              memberId: member.id,
              periodNumber: p,
              dueDate: nextPeriodDate(group.startDate, p, freq),
              dueAmount: baseDue,
              baseDueAmount: baseDue,
              paidAmount: 0,
              status: 'upcoming',
            },
          });
        }
      }

      results.push({
        memberId: member.id,
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        ticketNo,
        createdNewCustomer,
      });
    }
  }

  await createChitAudit(tx, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    action: 'quick_add_members',
    entityType: 'chit_group',
    entityId: group.id,
    newValue: { addedTickets: results.length },
  });

  return { groupId: group.id, added: results };
}
