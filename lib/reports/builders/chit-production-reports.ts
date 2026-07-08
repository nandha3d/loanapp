import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

function dateRange(params: ReportBuilderParams) {
  const from = new Date(params.from);
  from.setHours(0, 0, 0, 0);
  const to = new Date(params.to);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function groupWhere(params: ReportBuilderParams) {
  return {
    tenantId: params.tenantId,
    appType: params.appType,
    deletedAt: null,
    ...(params.branchId ? { branchId: params.branchId } : {}),
    ...(params.routeId ? { id: params.routeId } : {}),
    ...(params.status ? { status: params.status } : {}),
  };
}

function meta() {
  return { currencySymbol: 'INR' };
}

function total(rows: Record<string, any>[], key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

export async function buildChitGroupLedger(params: ReportBuilderParams): Promise<ReportPayload> {
  const groups = await prisma.chitGroup.findMany({
    where: groupWhere(params),
    include: {
      auctions: true,
      members: { include: { subscriptions: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  const rows = groups.map((g) => {
    const collected = g.members.flatMap((m) => m.subscriptions).reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const due = g.members.flatMap((m) => m.subscriptions).reduce((sum, s) => sum + Number(s.dueAmount), 0);
    const commission = g.auctions.reduce((sum, a) => sum + Number(a.commission || 0), 0);
    const dividend = g.auctions.reduce((sum, a) => sum + Number(a.dividend || 0), 0);
    const payout = g.auctions.reduce((sum, a) => sum + Number(a.prizeAmount || 0), 0);
    return {
      chitName: g.name,
      chitValue: Number(g.chitValue),
      status: g.status,
      members: g.members.length,
      due,
      collected,
      balance: due - collected,
      commission,
      dividend,
      payout,
    };
  });

  return {
    title: 'reports.chitGroupLedger.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
      { key: 'members', label: 'reports.col.members', type: 'number', align: 'right', total: true },
      { key: 'chitValue', label: 'reports.col.value', type: 'currency', align: 'right', total: true },
      { key: 'due', label: 'reports.col.due', type: 'currency', align: 'right', total: true },
      { key: 'collected', label: 'reports.col.collected', type: 'currency', align: 'right', total: true },
      { key: 'balance', label: 'reports.col.balance', type: 'currency', align: 'right', total: true },
      { key: 'commission', label: 'reports.col.commission', type: 'currency', align: 'right', total: true },
      { key: 'dividend', label: 'reports.col.dividend', type: 'currency', align: 'right', total: true },
      { key: 'payout', label: 'reports.col.payout', type: 'currency', align: 'right', total: true },
    ],
    rows,
    totals: {
      members: total(rows, 'members'),
      chitValue: total(rows, 'chitValue'),
      due: total(rows, 'due'),
      collected: total(rows, 'collected'),
      balance: total(rows, 'balance'),
      commission: total(rows, 'commission'),
      dividend: total(rows, 'dividend'),
      payout: total(rows, 'payout'),
    },
    kpis: [
      { label: 'groups', value: rows.length },
      { label: 'totalCollected', value: total(rows, 'collected') },
      { label: 'totalBalance', value: total(rows, 'balance') },
    ],
    meta: meta(),
  };
}

export async function buildChitSubscriberLedger(params: ReportBuilderParams): Promise<ReportPayload> {
  const members = await prisma.chitMember.findMany({
    where: {
      chitGroup: groupWhere(params),
      ...(params.customerId ? { customerId: params.customerId } : {}),
    },
    include: {
      customer: { select: { name: true, phone: true } },
      chitGroup: { select: { name: true } },
      subscriptions: true,
      bids: { where: { status: 'winning' } },
    },
    orderBy: [{ chitGroupId: 'asc' }, { memberNumber: 'asc' }],
  });
  const rows = members.map((m) => {
    const due = m.subscriptions.reduce((sum, s) => sum + Number(s.dueAmount), 0);
    const paid = m.subscriptions.reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const dividend = m.subscriptions.reduce((sum, s) => sum + Number(s.dividendAmount || 0), 0);
    const penalty = m.subscriptions.reduce((sum, s) => sum + Number(s.penaltyAmount || 0), 0);
    return {
      chitName: m.chitGroup.name,
      ticketNo: m.ticketNo || m.memberNumber,
      customerName: m.customer.name,
      phone: m.customer.phone,
      agreementStatus: m.agreementStatus,
      due,
      paid,
      dividend,
      penalty,
      balance: due + penalty - paid,
      prized: m.hasWon ? 'yes' : 'no',
    };
  });
  return {
    title: 'reports.chitSubscriberLedger.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'ticketNo', label: 'reports.col.ticket', type: 'text' },
      { key: 'customerName', label: 'reports.col.customer', type: 'text' },
      { key: 'agreementStatus', label: 'reports.col.agreement', type: 'badge', align: 'center' },
      { key: 'due', label: 'reports.col.due', type: 'currency', align: 'right', total: true },
      { key: 'paid', label: 'reports.col.paid', type: 'currency', align: 'right', total: true },
      { key: 'dividend', label: 'reports.col.dividend', type: 'currency', align: 'right', total: true },
      { key: 'penalty', label: 'reports.col.penalty', type: 'currency', align: 'right', total: true },
      { key: 'balance', label: 'reports.col.balance', type: 'currency', align: 'right', total: true },
      { key: 'prized', label: 'reports.col.prized', type: 'badge', align: 'center' },
    ],
    rows,
    totals: {
      due: total(rows, 'due'),
      paid: total(rows, 'paid'),
      dividend: total(rows, 'dividend'),
      penalty: total(rows, 'penalty'),
      balance: total(rows, 'balance'),
    },
    kpis: [{ label: 'subscribers', value: rows.length }, { label: 'outstanding', value: total(rows, 'balance') }],
    meta: meta(),
  };
}

export async function buildChitAuctionRegister(params: ReportBuilderParams): Promise<ReportPayload> {
  const { from, to } = dateRange(params);
  const auctions = await prisma.chitAuction.findMany({
    where: { auctionDate: { gte: from, lte: to }, chitGroup: groupWhere(params) },
    include: {
      chitGroup: { select: { name: true } },
      winnerMember: { include: { customer: { select: { name: true } } } },
    },
    orderBy: [{ auctionDate: 'desc' }, { periodNumber: 'desc' }],
  });
  const rows = auctions.map((a) => ({
    chitName: a.chitGroup.name,
    period: a.periodNumber,
    auctionDate: a.auctionDate,
    winner: a.winnerMember?.customer.name || '-',
    prizeAmount: Number(a.prizeAmount || 0),
    bidDiscount: Number(a.bidDiscount || 0),
    commission: Number(a.commission || 0),
    gst: Number(a.gstAmount || 0),
    dividend: Number(a.dividend || 0),
    payoutStatus: a.payoutStatus,
    status: a.status,
  }));
  return {
    title: 'reports.chitAuctionRegister.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'period', label: 'reports.col.period', type: 'number', align: 'center' },
      { key: 'auctionDate', label: 'reports.col.auctionDate', type: 'date', align: 'center' },
      { key: 'winner', label: 'reports.col.winner', type: 'text' },
      { key: 'prizeAmount', label: 'reports.col.prizeAmount', type: 'currency', align: 'right', total: true },
      { key: 'bidDiscount', label: 'reports.col.discount', type: 'currency', align: 'right', total: true },
      { key: 'commission', label: 'reports.col.commission', type: 'currency', align: 'right', total: true },
      { key: 'gst', label: 'reports.col.gst', type: 'currency', align: 'right', total: true },
      { key: 'dividend', label: 'reports.col.dividend', type: 'currency', align: 'right', total: true },
      { key: 'payoutStatus', label: 'reports.col.payoutStatus', type: 'badge', align: 'center' },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
    ],
    rows,
    totals: {
      prizeAmount: total(rows, 'prizeAmount'),
      bidDiscount: total(rows, 'bidDiscount'),
      commission: total(rows, 'commission'),
      gst: total(rows, 'gst'),
      dividend: total(rows, 'dividend'),
    },
    meta: meta(),
  };
}

export async function buildChitBidHistory(params: ReportBuilderParams): Promise<ReportPayload> {
  const { from, to } = dateRange(params);
  const bids = await prisma.chitBid.findMany({
    where: {
      bidTime: { gte: from, lte: to },
      ...(params.branchId ? { branchId: params.branchId } : {}),
      auction: { chitGroup: groupWhere(params) },
    },
    include: {
      auction: { select: { periodNumber: true, auctionDate: true, chitGroup: { select: { name: true } } } },
      member: { include: { customer: { select: { name: true } } } },
    },
    orderBy: { bidTime: 'asc' },
  });
  const rows = bids.map((b) => ({
    chitName: b.auction.chitGroup.name,
    period: b.auction.periodNumber,
    bidTime: b.bidTime,
    ticketNo: b.member.ticketNo || b.member.memberNumber,
    bidder: b.member.customer.name,
    bidAmount: Number(b.bidAmount),
    bidDiscount: Number(b.bidDiscount),
    status: b.status,
  }));
  return {
    title: 'reports.chitBidHistory.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'period', label: 'reports.col.period', type: 'number', align: 'center' },
      { key: 'bidTime', label: 'reports.col.time', type: 'date', align: 'center' },
      { key: 'ticketNo', label: 'reports.col.ticket', type: 'text' },
      { key: 'bidder', label: 'reports.col.bidder', type: 'text' },
      { key: 'bidAmount', label: 'reports.col.bidAmount', type: 'currency', align: 'right' },
      { key: 'bidDiscount', label: 'reports.col.discount', type: 'currency', align: 'right', total: true },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
    ],
    rows,
    totals: { bidDiscount: total(rows, 'bidDiscount') },
    meta: meta(),
  };
}

export async function buildChitPrizedSubscribers(params: ReportBuilderParams): Promise<ReportPayload> {
  const rows = (await prisma.chitAuction.findMany({
    where: { winnerMemberId: { not: null }, chitGroup: groupWhere(params) },
    include: {
      chitGroup: { select: { name: true } },
      winnerMember: { include: { customer: { select: { name: true, phone: true } } } },
    },
    orderBy: { auctionDate: 'desc' },
  })).map((a) => ({
    chitName: a.chitGroup.name,
    period: a.periodNumber,
    customerName: a.winnerMember?.customer.name || '-',
    phone: a.winnerMember?.customer.phone || '-',
    prizeAmount: Number(a.prizeAmount || 0),
    payoutStatus: a.payoutStatus,
    auctionDate: a.auctionDate,
  }));
  return {
    title: 'reports.chitPrizedSubscribers.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'period', label: 'reports.col.period', type: 'number', align: 'center' },
      { key: 'customerName', label: 'reports.col.customer', type: 'text' },
      { key: 'phone', label: 'reports.col.phone', type: 'text' },
      { key: 'prizeAmount', label: 'reports.col.prizeAmount', type: 'currency', align: 'right', total: true },
      { key: 'payoutStatus', label: 'reports.col.payoutStatus', type: 'badge', align: 'center' },
      { key: 'auctionDate', label: 'reports.col.auctionDate', type: 'date', align: 'center' },
    ],
    rows,
    totals: { prizeAmount: total(rows, 'prizeAmount') },
    meta: meta(),
  };
}

export async function buildChitDividendRegister(params: ReportBuilderParams): Promise<ReportPayload> {
  const rows = (await prisma.chitAuction.findMany({
    where: { chitGroup: groupWhere(params) },
    include: { chitGroup: { select: { name: true, dividendDistribution: true } } },
    orderBy: [{ auctionDate: 'desc' }],
  })).map((a) => ({
    chitName: a.chitGroup.name,
    period: a.periodNumber,
    dividend: Number(a.dividend || 0),
    roundingIncome: Number(a.roundingIncome || 0),
    distribution: a.chitGroup.dividendDistribution,
    status: a.status,
  }));
  return {
    title: 'reports.chitDividendRegister.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'period', label: 'reports.col.period', type: 'number', align: 'center' },
      { key: 'dividend', label: 'reports.col.dividend', type: 'currency', align: 'right', total: true },
      { key: 'roundingIncome', label: 'reports.col.roundingIncome', type: 'currency', align: 'right', total: true },
      { key: 'distribution', label: 'reports.col.distribution', type: 'badge', align: 'center' },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
    ],
    rows,
    totals: { dividend: total(rows, 'dividend'), roundingIncome: total(rows, 'roundingIncome') },
    meta: meta(),
  };
}

export async function buildChitForemanCommission(params: ReportBuilderParams): Promise<ReportPayload> {
  const rows = (await prisma.chitAuction.findMany({
    where: { chitGroup: groupWhere(params) },
    include: { chitGroup: { select: { name: true, commissionBasis: true, commissionPct: true } } },
    orderBy: [{ auctionDate: 'desc' }],
  })).map((a) => ({
    chitName: a.chitGroup.name,
    period: a.periodNumber,
    basis: a.chitGroup.commissionBasis,
    commissionPct: Number(a.chitGroup.commissionPct),
    commission: Number(a.commission || 0),
    gst: Number(a.gstAmount || 0),
    status: a.status,
  }));
  return {
    title: 'reports.chitForemanCommission.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'period', label: 'reports.col.period', type: 'number', align: 'center' },
      { key: 'basis', label: 'reports.col.basis', type: 'badge', align: 'center' },
      { key: 'commissionPct', label: 'reports.col.commissionPct', type: 'percent', align: 'right' },
      { key: 'commission', label: 'reports.col.commission', type: 'currency', align: 'right', total: true },
      { key: 'gst', label: 'reports.col.gst', type: 'currency', align: 'right', total: true },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
    ],
    rows,
    totals: { commission: total(rows, 'commission'), gst: total(rows, 'gst') },
    meta: meta(),
  };
}

export async function buildChitDefaultsReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const rows = (await prisma.chitSubscription.findMany({
    where: {
      status: { in: ['missed', 'partial', 'overdue'] },
      member: { chitGroup: groupWhere(params) },
    },
    include: { member: { include: { customer: { select: { name: true, phone: true } }, chitGroup: { select: { name: true } } } } },
    orderBy: { dueDate: 'asc' },
  })).map((s) => ({
    chitName: s.member.chitGroup.name,
    period: s.periodNumber,
    customerName: s.member.customer.name,
    phone: s.member.customer.phone,
    dueDate: s.dueDate,
    due: Number(s.dueAmount),
    paid: Number(s.paidAmount),
    penalty: Number(s.penaltyAmount || 0),
    balance: Number(s.dueAmount) + Number(s.penaltyAmount || 0) - Number(s.paidAmount),
    status: s.status,
  }));
  return {
    title: 'reports.chitDefaults.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'period', label: 'reports.col.period', type: 'number', align: 'center' },
      { key: 'customerName', label: 'reports.col.customer', type: 'text' },
      { key: 'dueDate', label: 'reports.col.dueDate', type: 'date', align: 'center' },
      { key: 'due', label: 'reports.col.due', type: 'currency', align: 'right', total: true },
      { key: 'paid', label: 'reports.col.paid', type: 'currency', align: 'right', total: true },
      { key: 'penalty', label: 'reports.col.penalty', type: 'currency', align: 'right', total: true },
      { key: 'balance', label: 'reports.col.balance', type: 'currency', align: 'right', total: true },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
    ],
    rows,
    totals: { due: total(rows, 'due'), paid: total(rows, 'paid'), penalty: total(rows, 'penalty'), balance: total(rows, 'balance') },
    meta: meta(),
  };
}

export async function buildChitPayoutReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const rows = (await prisma.chitAuction.findMany({
    where: { prizeAmount: { not: null }, chitGroup: groupWhere(params) },
    include: {
      chitGroup: { select: { name: true } },
      winnerMember: { include: { customer: { select: { name: true } } } },
    },
    orderBy: { auctionDate: 'desc' },
  })).map((a) => ({
    chitName: a.chitGroup.name,
    period: a.periodNumber,
    winner: a.winnerMember?.customer.name || '-',
    prizeAmount: Number(a.prizeAmount || 0),
    payoutStatus: a.payoutStatus,
    auctionDate: a.auctionDate,
  }));
  return {
    title: 'reports.chitPayout.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'period', label: 'reports.col.period', type: 'number', align: 'center' },
      { key: 'winner', label: 'reports.col.winner', type: 'text' },
      { key: 'prizeAmount', label: 'reports.col.prizeAmount', type: 'currency', align: 'right', total: true },
      { key: 'payoutStatus', label: 'reports.col.payoutStatus', type: 'badge', align: 'center' },
      { key: 'auctionDate', label: 'reports.col.auctionDate', type: 'date', align: 'center' },
    ],
    rows,
    totals: { prizeAmount: total(rows, 'prizeAmount') },
    meta: meta(),
  };
}

export async function buildChitSecurityPendingReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const rows = (await prisma.chitSecurity.findMany({
    where: {
      status: { in: ['pending', 'submitted', 'verified'] },
      ...(params.branchId ? { branchId: params.branchId } : {}),
      tenantId: params.tenantId,
      auction: { chitGroup: groupWhere(params) },
    } as any,
    include: {
      auction: { select: { periodNumber: true, chitGroup: { select: { name: true } } } },
    } as any,
    orderBy: { createdAt: 'desc' },
  } as any)).map((s: any) => ({
    chitName: s.auction?.chitGroup?.name || '-',
    period: s.auction?.periodNumber || '-',
    securityType: s.securityType,
    securityValue: Number(s.securityValue || 0),
    guarantorName: s.guarantorName || '-',
    guarantorPhone: s.guarantorPhone || '-',
    status: s.status,
  }));
  return {
    title: 'reports.chitSecurityPending.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'period', label: 'reports.col.period', type: 'text', align: 'center' },
      { key: 'securityType', label: 'reports.col.securityType', type: 'badge', align: 'center' },
      { key: 'securityValue', label: 'reports.col.value', type: 'currency', align: 'right', total: true },
      { key: 'guarantorName', label: 'reports.col.guarantor', type: 'text' },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
    ],
    rows,
    totals: { securityValue: total(rows, 'securityValue') },
    meta: meta(),
  };
}

export async function buildChitAgreementPendingReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const rows = (await prisma.chitMember.findMany({
    where: { agreementStatus: { in: ['pending', 'rejected'] }, chitGroup: groupWhere(params) },
    include: { customer: { select: { name: true, phone: true } }, chitGroup: { select: { name: true } } },
    orderBy: [{ chitGroupId: 'asc' }, { memberNumber: 'asc' }],
  })).map((m) => ({
    chitName: m.chitGroup.name,
    ticketNo: m.ticketNo || m.memberNumber,
    customerName: m.customer.name,
    phone: m.customer.phone,
    agreementStatus: m.agreementStatus,
    joinedAt: m.joinedAt,
  }));
  return {
    title: 'reports.chitAgreementPending.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'ticketNo', label: 'reports.col.ticket', type: 'text' },
      { key: 'customerName', label: 'reports.col.customer', type: 'text' },
      { key: 'phone', label: 'reports.col.phone', type: 'text' },
      { key: 'agreementStatus', label: 'reports.col.agreement', type: 'badge', align: 'center' },
      { key: 'joinedAt', label: 'reports.col.joinedAt', type: 'date', align: 'center' },
    ],
    rows,
    meta: meta(),
  };
}

export async function buildChitReceiptRegister(params: ReportBuilderParams): Promise<ReportPayload> {
  const { from, to } = dateRange(params);
  const rows = (await prisma.chitReceipt.findMany({
    where: {
      tenantId: params.tenantId,
      appType: params.appType,
      issuedAt: { gte: from, lte: to },
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.paymentMode ? { paymentMode: params.paymentMode } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { issuedAt: 'desc' },
  })).map((r) => ({
    receiptNo: r.receiptNo,
    issuedAt: r.issuedAt,
    receiptType: r.receiptType,
    entityType: r.entityType,
    amount: Number(r.amount),
    paymentMode: r.paymentMode,
    referenceNo: r.referenceNo || '-',
    status: r.status,
  }));
  return {
    title: 'reports.chitReceiptRegister.title',
    columns: [
      { key: 'receiptNo', label: 'reports.col.receiptNo', type: 'text' },
      { key: 'issuedAt', label: 'reports.col.date', type: 'date', align: 'center' },
      { key: 'receiptType', label: 'reports.col.type', type: 'badge', align: 'center' },
      { key: 'entityType', label: 'reports.col.entity', type: 'text' },
      { key: 'amount', label: 'reports.col.amount', type: 'currency', align: 'right', total: true },
      { key: 'paymentMode', label: 'reports.col.mode', type: 'badge', align: 'center' },
      { key: 'referenceNo', label: 'reports.col.reference', type: 'text' },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
    ],
    rows,
    totals: { amount: total(rows, 'amount') },
    meta: meta(),
  };
}

export async function buildVacantChitReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const groups = await prisma.chitGroup.findMany({
    where: groupWhere(params),
    include: { members: true },
    orderBy: { startDate: 'desc' },
  });
  const rows = groups
    .map((g) => ({
      chitName: g.name,
      totalMembers: g.totalMembers,
      filledTickets: g.members.filter((m) => m.subscriberStatus !== 'removed').length,
      vacantTickets: Math.max(0, g.totalMembers - g.members.filter((m) => m.subscriberStatus !== 'removed').length),
      chitValue: Number(g.chitValue),
      monthlyContrib: Number(g.monthlyContrib),
      status: g.status,
    }))
    .filter((r) => r.vacantTickets > 0);
  return {
    title: 'reports.vacantChit.title',
    columns: [
      { key: 'chitName', label: 'reports.col.chitName', type: 'text' },
      { key: 'totalMembers', label: 'reports.col.totalMembers', type: 'number', align: 'right', total: true },
      { key: 'filledTickets', label: 'reports.col.filledTickets', type: 'number', align: 'right', total: true },
      { key: 'vacantTickets', label: 'reports.col.vacantTickets', type: 'number', align: 'right', total: true },
      { key: 'chitValue', label: 'reports.col.value', type: 'currency', align: 'right', total: true },
      { key: 'monthlyContrib', label: 'reports.col.monthlyContrib', type: 'currency', align: 'right' },
      { key: 'status', label: 'reports.col.status', type: 'badge', align: 'center' },
    ],
    rows,
    totals: {
      totalMembers: total(rows, 'totalMembers'),
      filledTickets: total(rows, 'filledTickets'),
      vacantTickets: total(rows, 'vacantTickets'),
      chitValue: total(rows, 'chitValue'),
    },
    meta: meta(),
  };
}
