import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import { roundMoney } from '../calculations';
import { assertCanExportStatutoryRegisters } from '../planEntitlements';
import { resolvePdfLang, type PdfLang } from '@/lib/reports/pdfFonts';
import { getStatutoryPdfCopy } from './i18n';
import {
  resolveStatutoryTemplate,
  type StatutoryRegisterType,
  type StatutoryTemplateMeta,
} from './templates';

export interface StatutoryRegisterColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  /** Relative column width weight used for PDF table column sizing and cell separation. */
  weight?: number;
}

export interface StatutoryRegisterDataset {
  lang: PdfLang;
  meta: StatutoryTemplateMeta;
  disclaimer: string;
  groupSummary: {
    groupId: string;
    groupCode: string;
    groupName: string;
    chitValueFormatted: string;
    totalMembers: number;
    durationMonths: number;
    commissionPct: number;
    chitRegistrationNumber: string;
    priorSanctionNumber: string;
    bylawNumber: string;
    foremanName: string;
    registeredOfficeAddress: string;
    registrarJurisdiction: string;
    approvedBankInfo: string;
    generatedAt: string;
  };
  columns: StatutoryRegisterColumn[];
  rows: Array<Record<string, string | number>>;
  totals: Array<{ label: string; value: string }>;
}

export async function buildStatutoryRegisterData(input: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  groupId: string;
  registerType: StatutoryRegisterType;
  currencySymbol?: string;
  lang?: string | null;
}): Promise<StatutoryRegisterDataset> {
  await assertCanExportStatutoryRegisters(prisma, input.tenantId);
  const resolvedLang = resolvePdfLang(input.lang);
  const copy = getStatutoryPdfCopy(resolvedLang);
  const sym = input.currencySymbol || '₹';

  const [tenant, group] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true },
    }),
    prisma.chitGroup.findFirst({
      where: {
        OR: [{ id: input.groupId }, { groupCode: input.groupId }],
        tenantId: input.tenantId,
        appType: 'chitfunds',
        ...(input.branchId ? { branchId: input.branchId } : {}),
        deletedAt: null,
      },
      include: {
        members: {
          orderBy: { memberNumber: 'asc' },
          include: {
            customer: { select: { name: true, phone: true, address: true } },
            subscriptions: { orderBy: { periodNumber: 'asc' } },
          },
        },
        auctions: {
          orderBy: { periodNumber: 'asc' },
          include: {
            winnerMember: { include: { customer: { select: { name: true } } } },
            attendance: true,
            bids: { where: { status: { in: ['valid', 'winning'] } } },
          },
        },
      },
    }),
  ]);

  if (!group) throw new Error('Chit group not found');

  const baseMeta = resolveStatutoryTemplate(group.stateCode, input.registerType);
  const meta: StatutoryTemplateMeta = {
    ...baseMeta,
    title: copy.registerTitles[input.registerType] || baseMeta.title,
  };
  const priorAndBylaw =
    [group.priorSanctionNumber, group.bylawNo].filter(Boolean).join(' · ') || '—';
  const groupSummary = {
    groupId: group.id,
    groupCode: group.groupCode || group.id,
    groupName: group.name,
    chitValueFormatted: formatCurrency(Number(group.chitValue), sym),
    totalMembers: group.totalMembers,
    durationMonths: group.durationMonths,
    commissionPct: Number(group.commissionPct),
    chitRegistrationNumber: group.registrationNo || 'Unregistered / Pending',
    priorSanctionNumber: priorAndBylaw,
    bylawNumber: group.bylawNo || '—',
    foremanName: group.foremanName || tenant?.name || 'Foreman',
    registeredOfficeAddress: group.registeredOfficeAddress || group.registrarOffice || '—',
    registrarJurisdiction: group.registrarOffice || 'Local Chit Registrar',
    approvedBankInfo: [group.approvedBankName, group.approvedBankAccountNo].filter(Boolean).join(' · ') || '—',
    generatedAt: formatDate(new Date()),
  };

  let columns: StatutoryRegisterColumn[] = [];
  let rows: Array<Record<string, string | number>> = [];
  let totals: Array<{ label: string; value: string }> = [];

  if (input.registerType === 'subscriber-register') {
    columns = [
      { key: 'ticketNo', label: 'Ticket No', weight: 0.7 },
      { key: 'name', label: 'Subscriber Name', weight: 1.55 },
      { key: 'address', label: 'Phone & Address', weight: 2.35 },
      { key: 'nominee', label: 'Nominee', weight: 1.15 },
      { key: 'ticketValue', label: 'Ticket Value', align: 'right', weight: 1.2 },
      { key: 'joinedAt', label: 'Joining Date', weight: 1.15 },
      { key: 'prizedCycle', label: 'Prized Cycle', weight: 1.0 },
    ];
    rows = group.members.map((m) => {
      const wonAuc = group.auctions.find((a) => a.winnerMemberId === m.id);
      const wonCycle = wonAuc?.periodNumber ?? m.prizedCycleNumber;
      return {
        ticketNo: m.ticketNo ?? String(m.memberNumber),
        name: m.customer.name,
        address: [m.customer.phone, m.customer.address].filter(Boolean).join(' · ') || '—',
        nominee: [m.nomineeName, m.nomineeRelation].filter(Boolean).join(' / ') || '—',
        ticketValue: formatCurrency(roundMoney(Number(group.chitValue) * Number(m.ticketShare)), sym),
        joinedAt: formatDate(m.joinedAt),
        prizedCycle: wonCycle ? `Cycle ${wonCycle}` : m.hasWon ? 'Won' : 'Non-Prized',
      };
    });
    totals = [{ label: 'Enrolled Subscribers', value: `${group.members.length} / ${group.totalMembers}` }];
  } else if (input.registerType === 'chit-ledger') {
    columns = [
      { key: 'cycle', label: 'Cycle' },
      { key: 'ticketNo', label: 'Ticket' },
      { key: 'name', label: 'Subscriber' },
      { key: 'dueAmt', label: 'Due', align: 'right' },
      { key: 'dividendAmt', label: 'Dividend', align: 'right' },
      { key: 'paidAmt', label: 'Paid', align: 'right' },
      { key: 'balance', label: 'Balance', align: 'right' },
      { key: 'mode', label: 'Status / Mode' },
    ];
    let sumDue = 0;
    let sumPaid = 0;
    let sumDiv = 0;
    for (const m of group.members) {
      for (const s of m.subscriptions) {
        const due = roundMoney(Number(s.dueAmount));
        const paid = roundMoney(Number(s.paidAmount));
        const div = roundMoney(Number(s.dividendAmount));
        const bal = Math.max(0, roundMoney(due - paid));
        sumDue = roundMoney(sumDue + due);
        sumPaid = roundMoney(sumPaid + paid);
        sumDiv = roundMoney(sumDiv + div);
        rows.push({
          cycle: `P${s.periodNumber}`,
          ticketNo: `#${m.ticketNo ?? m.memberNumber}`,
          name: m.customer.name,
          dueAmt: formatCurrency(due, sym),
          dividendAmt: formatCurrency(div, sym),
          paidAmt: formatCurrency(paid, sym),
          balance: formatCurrency(bal, sym),
          mode: `${s.status.toUpperCase()}${s.paymentMode ? ` (${s.paymentMode})` : ''}`,
        });
      }
    }
    totals = [
      { label: 'Total Due', value: formatCurrency(sumDue, sym) },
      { label: 'Total Paid', value: formatCurrency(sumPaid, sym) },
      { label: 'Total Dividend', value: formatCurrency(sumDiv, sym) },
      { label: 'Total Arrears', value: formatCurrency(Math.max(0, sumDue - sumPaid), sym) },
    ];
  } else if (input.registerType === 'day-book') {
    const receipts = await prisma.chitReceipt.findMany({
      where: {
        tenantId: input.tenantId,
        appType: 'chitfunds',
        status: 'active',
        OR: [
          {
            entityType: 'subscription',
            entityId: { in: group.members.flatMap((m) => m.subscriptions.map((s) => s.id)) },
          },
          {
            entityType: 'auction',
            entityId: { in: group.auctions.map((a) => a.id) },
          },
        ],
      },
      orderBy: { issuedAt: 'asc' },
    });
    columns = [
      { key: 'date', label: 'Date' },
      { key: 'receiptNo', label: 'Receipt No' },
      { key: 'type', label: 'Entry Type' },
      { key: 'mode', label: 'Mode' },
      { key: 'inflow', label: 'Receipt (In)', align: 'right' },
      { key: 'outflow', label: 'Payout (Out)', align: 'right' },
      { key: 'notes', label: 'Narration' },
    ];
    let totalIn = 0;
    let totalOut = 0;
    for (const r of receipts) {
      const amt = roundMoney(Number(r.amount));
      const isOut = r.receiptType === 'payout' || r.receiptType === 'dividend_payout';
      if (isOut) totalOut = roundMoney(totalOut + amt);
      else totalIn = roundMoney(totalIn + amt);
      rows.push({
        date: formatDate(r.issuedAt),
        receiptNo: r.receiptNo,
        type: r.receiptType.toUpperCase(),
        mode: r.paymentMode.toUpperCase(),
        inflow: isOut ? '—' : formatCurrency(amt, sym),
        outflow: isOut ? formatCurrency(amt, sym) : '—',
        notes: r.notes || r.referenceNo || '—',
      });
    }
    totals = [
      { label: 'Total Receipts (In)', value: formatCurrency(totalIn, sym) },
      { label: 'Total Payouts (Out)', value: formatCurrency(totalOut, sym) },
      { label: 'Net Day Book Cash/Bank', value: formatCurrency(roundMoney(totalIn - totalOut), sym) },
    ];
  } else if (input.registerType === 'auction-minutes') {
    columns = [
      { key: 'cycle', label: 'Cycle' },
      { key: 'date', label: 'Auction Date' },
      { key: 'present', label: 'Present' },
      { key: 'winner', label: 'Prized Subscriber' },
      { key: 'discount', label: 'Bid Discount', align: 'right' },
      { key: 'commission', label: 'Commission', align: 'right' },
      { key: 'dividend', label: 'Dividend / Ticket', align: 'right' },
      { key: 'prize', label: 'Net Prize', align: 'right' },
    ];
    for (const a of group.auctions) {
      rows.push({
        cycle: `Cycle ${a.periodNumber}`,
        date: formatDate(a.scheduledAt ?? a.auctionDate),
        present: `${a.attendance.length || group.members.length}`,
        winner: a.winnerMember?.customer?.name ? `#${a.winnerMember.ticketNo} ${a.winnerMember.customer.name}` : 'Pending',
        discount: a.bidDiscount != null ? formatCurrency(Number(a.bidDiscount), sym) : '—',
        commission: a.commission != null ? formatCurrency(Number(a.commission), sym) : '—',
        dividend: a.dividend != null ? formatCurrency(Number(a.dividend), sym) : '—',
        prize: a.prizeAmount != null ? formatCurrency(Number(a.prizeAmount), sym) : '—',
      });
    }
    totals = [{ label: 'Auctions Recorded', value: `${group.auctions.filter((a) => Boolean(a.winnerMemberId)).length} / ${group.durationMonths}` }];
  } else if (input.registerType === 'security-deposit-register') {
    const securities = await prisma.chitSecurity.findMany({
      where: {
        tenantId: input.tenantId,
        chitGroupId: group.id,
      },
      orderBy: { createdAt: 'asc' },
    });
    columns = [
      { key: 'auctionId', label: 'Cycle / Ref' },
      { key: 'winner', label: 'Prized Member' },
      { key: 'securityType', label: 'Collateral Type' },
      { key: 'value', label: 'Security Value', align: 'right' },
      { key: 'bankDetails', label: 'Approved Bank / Guarantor' },
      { key: 'status', label: 'Status' },
    ];
    for (const s of securities) {
      const winner = group.members.find((m) => m.id === s.winnerMemberId);
      const auc = group.auctions.find((a) => a.id === s.auctionId);
      rows.push({
        auctionId: auc ? `Cycle ${auc.periodNumber}` : s.auctionId.slice(0, 8),
        winner: winner ? `#${winner.ticketNo} ${winner.customer.name}` : s.winnerMemberId,
        securityType: s.securityType,
        value: s.securityValue != null ? formatCurrency(Number(s.securityValue), sym) : '—',
        bankDetails: s.guarantorName || s.details || groupSummary.approvedBankInfo,
        status: s.status.toUpperCase(),
      });
    }
    totals = [{ label: 'Total Security Entries', value: String(securities.length) }];
  } else {
    // prior-sanction-agreement: fall back to audit verification timestamp or joinedAt
    // whenever a verified/signed member record lacks an explicit agreementSignedAt.
    const memberIds = group.members.map((m) => m.id);
    const verifiedAtMap = new Map<string, Date>();
    if (memberIds.length > 0) {
      const logs = await prisma.auditLog.findMany({
        where: {
          tenantId: input.tenantId,
          entityType: 'chit_member',
          entityId: { in: memberIds },
          action: { in: ['update_member', 'verify_agreement', 'sign_agreement'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { entityId: true, createdAt: true },
      });
      for (const l of logs) {
        if (l.entityId && !verifiedAtMap.has(l.entityId)) {
          verifiedAtMap.set(l.entityId, l.createdAt);
        }
      }
    }

    columns = [
      { key: 'ticketNo', label: 'Ticket', weight: 0.7 },
      { key: 'subscriber', label: 'Subscriber Name', weight: 1.8 },
      { key: 'agreementStatus', label: 'Agreement Status', weight: 1.2 },
      { key: 'signedAt', label: 'Signed / Verified Date', weight: 1.35 },
      { key: 'nominee', label: 'Nominee', weight: 1.25 },
    ];
    rows = group.members.map((m) => {
      const effectiveDate =
        m.agreementSignedAt ??
        (['verified', 'signed'].includes(m.agreementStatus)
          ? verifiedAtMap.get(m.id) ?? m.joinedAt
          : null);
      return {
        ticketNo: `#${m.ticketNo ?? m.memberNumber}`,
        subscriber: m.customer.name,
        agreementStatus: m.agreementStatus.toUpperCase(),
        signedAt: effectiveDate ? formatDate(effectiveDate) : 'Pending',
        nominee: [m.nomineeName, m.nomineeRelation].filter(Boolean).join(' / ') || '—',
      };
    });
    totals = [
      { label: 'Prior Sanction / Bylaw No.', value: groupSummary.priorSanctionNumber },
      { label: 'Bylaw No.', value: groupSummary.bylawNumber },
      { label: 'Registration No.', value: groupSummary.chitRegistrationNumber },
    ];
  }

  const localizeCols = (cols: StatutoryRegisterColumn[]): StatutoryRegisterColumn[] =>
    cols.map((c) => ({
      ...c,
      label: copy.columnLabels[c.key] || c.label,
    }));

  const localizeTotal = (key: string, fallback: string) => copy.totalLabels[key] || fallback;

  return {
    lang: resolvedLang,
    meta,
    disclaimer: copy.disclaimer,
    groupSummary,
    columns: localizeCols(columns),
    rows,
    totals: totals.map((t) => {
      const keyMap: Record<string, string> = {
        'Enrolled Subscribers': 'enrolled',
        'Total Due': 'totalDue',
        'Total Paid': 'totalPaid',
        'Total Dividend': 'totalDividend',
        'Total Arrears': 'totalArrears',
        'Total Receipts (In)': 'totalIn',
        'Total Payouts (Out)': 'totalOut',
        'Net Day Book Cash/Bank': 'netDayBook',
        'Auctions Recorded': 'auctionsRecorded',
        'Total Security Entries': 'securityEntries',
        'Prior Sanction / Bylaw No.': 'priorSanction',
        'Bylaw No.': 'bylawNo',
        'Registration No.': 'registrationNo',
      };
      const k = keyMap[t.label];
      return { ...t, label: k ? localizeTotal(k, t.label) : t.label };
    }),
  };
}
