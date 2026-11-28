// Server-computed per-period chit auction & settlement report data builder (STABLE-8).
// Reconciles pot value, auction discount, foreman commission, distributable dividend,
// net member instalment, winner's current-period instalment deduction -> Net Cash in Hand,
// mode-wise receipts, payout transfers, cash denominations, bids, security, and member ledger.

import fs from 'node:fs';
import path from 'node:path';
import prisma from '../db';
import { getAppConfig } from '../appConfig';
import { getThemePreset, THEME_SETTING_KEY } from '../themes';
import { scopedChitGroupWhere } from './access';
import { roundMoney } from './calculations';
import {
  calculateChitPeriodEngine,
  computeSubscriptionBalances,
  type ChitPeriodCalculationBreakdown,
} from './engineCalculator';
import {
  CHIT_ENGINE_CATALOG,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
} from './engineTypes';
import { generateAuctionMinutes } from './auction';
import { formatCashDenominationsSummary, normalizeCashDenominations } from './payout';
import { SECURITY_DOCUMENT_LABELS, getSecurityTypeSpec } from './securityTypes';
import { ensurePdfFonts, resolvePdfLang, type PdfLang } from '../reports/pdfFonts';
import { getPeriodReportCopy, type PeriodReportCopy } from './periodReportI18n';
import type { ChitScope } from './types';

export interface CashDenominationEntry {
  denomination: number;
  count: number;
  amount: number;
}

export interface ChitPeriodModeBucket {
  mode: string;
  label: string;
  count: number;
  amount: number;
}

export interface ChitPeriodSettlementRow {
  slNo: number;
  description: string;
  modeOrRef: string;
  amount: number;
}

export interface ChitPeriodMemberRow {
  ticketNo: string;
  memberName: string;
  ticketShare: number;
  role: string;
  baseDue: number;
  dividendEarned: number;
  deferredDividend: number;
  extras: number;
  netDue: number;
  paidAmount: number;
  outstanding: number;
  goldGramsCredited: number;
  receiptNo: string;
  paymentMode: string;
  status: string;
}

export interface ChitPdfTheme {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
}

export const DEFAULT_CHIT_PDF_THEME: ChitPdfTheme = {
  primary: '#27AE60',
  primaryDark: '#1E8449',
  primaryLight: '#EAFAF1',
  accent: '#2ECC71',
};

function loadLocalAssetDataUri(relOrUrl?: string | null): string | null {
  const candidates: string[] = [];
  const clean = (relOrUrl || '').trim();
  if (clean && /\.(png|jpe?g|webp)$/i.test(clean)) {
    const trimmed = clean.replace(/^\/+/, '');
    candidates.push(path.join(process.cwd(), 'public', trimmed));
  }
  candidates.push(
    path.join(process.cwd(), 'public', 'assets', 'logo-square-light.png'),
    path.join(process.cwd(), 'public', 'assets', 'logo-192.png'),
  );
  for (const abs of candidates) {
    try {
      if (fs.existsSync(abs)) {
        const ext = path.extname(abs).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        const b64 = fs.readFileSync(abs).toString('base64');
        return `data:${mime};base64,${b64}`;
      }
    } catch {
      // Ignore unreadable filesystem asset candidates
    }
  }
  return null;
}

export async function resolveChitPdfBranding(tenantId: string): Promise<{
  tenantName: string;
  currencySymbol: string;
  theme: ChitPdfTheme;
  logoDataUri: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  defaultLang: string | null;
}> {
  const { getBranding, getTenantSettings } = await import('../tenant');
  const { getCurrentLanguage } = await import('../i18n');
  const [branding, settings, tenantLang] = await Promise.all([
    getBranding(tenantId),
    getTenantSettings(tenantId),
    getCurrentLanguage(tenantId),
  ]);
  const preset = getThemePreset(settings[THEME_SETTING_KEY]);
  const chitCfg = getAppConfig('chitfunds');
  const theme: ChitPdfTheme = {
    primary: preset?.primary ?? chitCfg.primaryColor,
    primaryDark: preset?.primaryDark ?? chitCfg.primaryDark,
    primaryLight: preset?.primaryLight ?? chitCfg.primaryLight,
    accent: preset?.accent ?? chitCfg.accentColor,
  };
  return {
    tenantName: branding.appName || 'ZoloFund',
    currencySymbol: branding.currencySymbol || '₹',
    theme,
    logoDataUri: loadLocalAssetDataUri(branding.logoUrl),
    companyAddress: (settings['company_address'] || settings['office_address'] || '').trim() || null,
    companyPhone: (settings['company_phone'] || settings['support_phone'] || '').trim() || null,
    companyEmail: (settings['company_email'] || settings['support_email'] || '').trim() || null,
    defaultLang: tenantLang,
  };
}

export interface ChitPeriodReportData {
  lang?: PdfLang;
  tenantName: string;
  branchName: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  logoDataUri?: string | null;
  theme?: ChitPdfTheme;
  currencySymbol: string;
  generatedAt: string;
  templateSectionTitle: string;

  group: {
    id: string;
    groupCode: string | null;
    name: string;
    chitValue: number;
    monthlyContrib: number;
    totalMembers: number;
    frequency: string;
    auctionType: string;
    chitType: string;
    engineType: string;
    engineCategory: string;
    engineLabel: string;
    payoutAssetType: string;
    commissionPct: number;
    commissionBasis: string;
    gstPct: number;
    dividendPolicy: string;
    dividendDistribution: string;
  };

  auction: {
    id: string;
    periodNumber: number;
    auctionDate: string;
    scheduledAt: string | null;
    status: string;
    payoutStatus: string;
    isFinalized: boolean;
    winnerName: string | null;
    winnerTicketNo: string | null;
    winnerPhone: string | null;
    presentCount: number;
    absentCount: number;
    proxyCount: number;
    reserveFloorAmount: number | null;
    goldRatePerGram: number | null;
    minutesText: string;
  };

  // Core statement numbers (exact server math + per-template reconciliation)
  statement: {
    chitValue: number;
    bidDiscount: number;
    discountPct: number;
    grossPrize: number;
    prizePayoutTotal: number;
    winnerCount: number;
    foremanCompensationMode: string;
    hybridPhase: 'reserved' | 'auction' | null;
    reserveFloorAmount: number | null;
    reserveFloorPct: number | null;
    commission: number;
    gstAmount: number;
    roundingIncome: number;
    forfeitedDividendTotal: number;
    distributableDividend: number;
    deferredDividendTotal: number;
    eligibleTickets: number;
    grossDiscountSharePerTicket: number;
    foremanFeePerTicket: number;
    dividendPerTicket: number;
    baseInstallment: number;
    netMemberInstallment: number;
    prizedMemberInstallment: number;
    winnerInterestAdded: number;
    winnerPeriodInstallmentDue: number;
    winnerPeriodInstallmentPaid: number;
    winnerPeriodInstallmentUnpaid: number;
    netPayableAfterWinnerInstallment: number;
    otherMembersCount: number;
    otherMembersExpectedCollection: number;
    netFundsAvailableForWinner: number;
    verificationFormulaLine: string;
    row2Title: string;
    row2Note: string;
    row3Title: string;
    row4Title: string;
    row4Note: string;
    row5Title: string;
  };

  basePlusPremium: {
    nonPrizedInstalment: number;
    prizedInstalment: number;
    collectedPool: number;
    alreadyPrizedTicketUnits: number;
    poolSurplus: number;
  } | null;

  gold: {
    goldRatePerGram: number;
    gramsPerFullTicket: number;
    bonusMonths: number;
    bonusPct: number;
  } | null;

  commodity: {
    itemsSummary: string;
    merchantBonusAmount: number;
    merchantBonusPct: number;
  } | null;

  asca: {
    monthlyLoanInterestPct: number;
    adminExpensePerCycle: number;
  } | null;

  collections: {
    totalExpected: number;
    totalCollected: number;
    totalOutstanding: number;
    paidCount: number;
    partialCount: number;
    unpaidCount: number;
    byMode: ChitPeriodModeBucket[];
  };

  payouts: {
    rows: ChitPeriodSettlementRow[];
    totalDisbursedToWinner: number;
    remainingPayoutBalance: number;
    arrearsDeductedAmount: number;
    penaltyDeductedAmount: number;
    netPayableAmount: number;
    dividendReceiptNo: string | null;
  };

  denominations: CashDenominationEntry[];
  denominationCashTotal: number;

  security: {
    typeCode: string;
    typeLabel: string;
    status: string;
    value: number | null;
    guarantorLabel: string | null;
    guarantorPhone: string | null;
    details: string | null;
    documents: { type?: string; label: string; fileName: string; status: string }[];
  } | null;

  multiDivisionWinners: {
    ticketNo: string | null;
    memberName: string;
    winType: string;
    prizeAmount: number;
    bidDiscount: number;
  }[];

  bids: {
    ticketNo: string;
    memberName: string;
    prizeAmount: number;
    bidDiscount: number;
    bidTime: string;
    source: string;
    status: string;
  }[];

  memberRows: ChitPeriodMemberRow[];
  formulaLines: string[];
}

const MODE_LABELS: Record<string, string> = {
  upi: 'UPI / GPay',
  cash: 'Cash',
  bank: 'Bank Transfer',
  cheque: 'Cheque',
  nach: 'NACH / Auto-Debit',
};

function labelMode(mode: string | null | undefined, copy?: PeriodReportCopy): string {
  const key = (mode ?? 'cash').toLowerCase();
  if (copy?.modeLabels?.[key]) return copy.modeLabels[key];
  return MODE_LABELS[key] ?? key.toUpperCase();
}

const ENGINE_SECTION_TITLES: Record<string, string> = {
  AUCTION_STANDARD: 'Standard Auction Dividend Settlement',
  AUCTION_RESERVE_PRICE: 'Reserve-Price Declining Floor Auction Settlement',
  AUCTION_MULTI_DIVISION: 'Multi-Division (Lottery + Auction) Settlement',
  AUCTION_UNCAPPED_ENTERPRISE: 'Enterprise Syndicate Auction Settlement',
  BASE_PLUS_PREMIUM: 'Differential Installment (Base + Premium) Settlement',
  FIXED_CHART_ESCALATING: 'Escalating Payout Chart Settlement',
  FIXED_DIVIDEND: 'Fixed Dividend Schedule Settlement',
  FIXED_PAYOUT_VARIABLE_PAY: 'Fixed Payout / Variable Installment Settlement',
  PURE_LOTTERY: 'Pure Lottery Draw Pot Settlement',
  FIXED_ROTATION: 'Fixed-Order Rotation Pot Settlement',
  NEED_BASED_CONSENSUS: 'Need-Based / Consensus Pot Settlement',
  MICRO_DAILY_COLLECTION: 'Daily Micro-Collection Cycle Settlement',
  GOLD_VALUE_ACCUMULATION: 'Gold Jewellery Value Scheme Settlement',
  GOLD_WEIGHT_ACCUMULATION: 'Gold Weight-Accumulation (g_t = S_t / R_t) Settlement',
  FESTIVAL_COMMODITY: 'Festival / Commodity Savings Settlement',
  HYBRID_SPLIT_PHASE: 'Hybrid Split-Phase Period Settlement',
  ASCA_SHG_REVOLVING: 'ASCA / SHG Revolving Loan & Interest Pool',
  CUSTOM_MANUAL_SCHEDULE: 'Custom / Manual Schedule Period Settlement',
};

function fmtInr(n: number, sym: string): string {
  const safeSym = !sym || sym === '₹' ? (ensurePdfFonts() ? '₹' : 'Rs.') : sym;
  return `${safeSym} ${roundMoney(n).toLocaleString('en-IN')}`;
}

export function buildTemplateStatementCopy(params: {
  engineType: string;
  chitValue: number;
  bidDiscount: number;
  discountPct: number;
  grossPrize: number;
  prizePayoutTotal: number;
  winnerCount: number;
  commission: number;
  commissionPct: number;
  commissionBasis: string;
  foremanMode: string;
  distributableDividend: number;
  eligibleTickets: number;
  grossDiscountSharePerTicket: number;
  foremanFeePerTicket: number;
  dividendPerTicket: number;
  baseInstallment: number;
  prizedMemberInstallment: number;
  netMemberInstallment: number;
  totalMembers: number;
  gstAmount: number;
  dividendPolicy: string;
  dividendDistribution: string;
  hybridPhase: 'reserved' | 'auction' | null;
  reserveFloorAmount: number | null;
  breakdown: ChitPeriodCalculationBreakdown;
  sym: string;
  copy?: PeriodReportCopy;
}) {
  const {
    engineType,
    discountPct,
    grossPrize,
    prizePayoutTotal,
    winnerCount,
    commission,
    commissionPct,
    commissionBasis,
    foremanMode,
    distributableDividend,
    eligibleTickets,
    grossDiscountSharePerTicket,
    foremanFeePerTicket,
    dividendPerTicket,
    baseInstallment,
    prizedMemberInstallment,
    netMemberInstallment,
    totalMembers,
    gstAmount,
    dividendPolicy,
    dividendDistribution,
    hybridPhase,
    reserveFloorAmount,
    breakdown,
    sym,
    copy = getPeriodReportCopy('en'),
  } = params;

  const isAccumulationGoldOrGoods = [
    'GOLD_VALUE_ACCUMULATION',
    'GOLD_WEIGHT_ACCUMULATION',
    'FESTIVAL_COMMODITY',
  ].includes(engineType);

  let row2Title = copy.row2WinningBid(discountPct.toFixed(2));
  let row2Note = copy.row2GrossPrizeNote(fmtInr(grossPrize, sym));
  if (engineType === 'AUCTION_MULTI_DIVISION') {
    row2Title = copy.row2MultiDivTitle(winnerCount);
    row2Note = copy.row2MultiDivNote(fmtInr(prizePayoutTotal, sym), fmtInr(grossPrize, sym));
  } else if (engineType === 'AUCTION_RESERVE_PRICE') {
    row2Title = copy.row2WinningBid(discountPct.toFixed(2));
    row2Note = copy.row2ReserveNote(
      fmtInr(grossPrize, sym),
      reserveFloorAmount != null ? fmtInr(reserveFloorAmount, sym) : null,
    );
  } else if (engineType === 'HYBRID_SPLIT_PHASE') {
    row2Title =
      hybridPhase === 'reserved'
        ? copy.row2FixedDeduction(discountPct.toFixed(2))
        : copy.row2WinningBid(discountPct.toFixed(2));
    row2Note = copy.row2GrossPrizeNote(fmtInr(grossPrize, sym));
  } else if (engineType === 'BASE_PLUS_PREMIUM') {
    row2Title = copy.row2FixedDeduction(discountPct.toFixed(2));
    row2Note = copy.row2GrossPrizeNote(fmtInr(grossPrize, sym));
  } else if (engineType === 'FIXED_CHART_ESCALATING') {
    row2Title = copy.row2FixedDeduction(discountPct.toFixed(2));
    row2Note = copy.row2GrossPrizeNote(fmtInr(grossPrize, sym));
  } else if (engineType === 'FIXED_DIVIDEND') {
    row2Title = copy.row2FixedDeduction(discountPct.toFixed(2));
    row2Note = copy.row2GrossPrizeNote(fmtInr(grossPrize, sym));
  } else if (engineType === 'FIXED_PAYOUT_VARIABLE_PAY' || engineType === 'CUSTOM_MANUAL_SCHEDULE') {
    row2Title = copy.row2FixedDeduction(discountPct.toFixed(2));
    row2Note = copy.row2GrossPrizeNote(fmtInr(grossPrize, sym));
  } else if (engineType === 'PURE_LOTTERY' || engineType === 'FIXED_ROTATION' || engineType === 'NEED_BASED_CONSENSUS') {
    row2Title = copy.row2FixedDeduction(discountPct.toFixed(2));
    row2Note = copy.row2NoBiddingNote(
      copy.engineTitles[engineType] ?? ENGINE_SECTION_TITLES[engineType] ?? engineType,
      fmtInr(grossPrize, sym),
    );
  } else if (engineType === 'GOLD_WEIGHT_ACCUMULATION') {
    row2Title = copy.engineTitles[engineType] ?? `Bullion Rate Lock & Discount Offset`;
    row2Note = `Rate: ${fmtInr(breakdown.goldDetails?.goldRatePerGram ?? 0, sym)}/g · Credit: ${breakdown.goldDetails?.gramsPerFullTicket ?? 0} g/ticket`;
  } else if (engineType === 'GOLD_VALUE_ACCUMULATION') {
    row2Title = copy.engineTitles[engineType] ?? `Merchant Scheme Adjustment / Discount`;
    row2Note = `Maturity Bonus: ${breakdown.goldDetails?.bonusMonths ?? 0} mo / ${breakdown.goldDetails?.bonusPct ?? 0}%`;
  } else if (engineType === 'FESTIVAL_COMMODITY') {
    row2Title = copy.engineTitles[engineType] ?? `Hamper Scheme Offset / Discount`;
    row2Note = `Merchant Bonus: ${breakdown.commodityDetails?.merchantBonusPct ?? 0}% · ${breakdown.commodityDetails?.itemsSummary ?? 'Commodity goods'}`;
  } else if (engineType === 'ASCA_SHG_REVOLVING') {
    row2Title = copy.engineTitles[engineType] ?? `Revolving Internal Loan Pool Adjustment`;
    row2Note = `Monthly Loan Interest: ${breakdown.ascaDetails?.monthlyLoanInterestPct ?? 0}% · Admin Exp: ${fmtInr(breakdown.ascaDetails?.adminExpensePerCycle ?? 0, sym)}`;
  }

  const localizedBasis = copy.commissionBasisLabels[commissionBasis] ?? commissionBasis;
  const row3Title =
    foremanMode === 'ZERO_COMMISSION' || commission === 0
      ? copy.row3ZeroComm(foremanMode)
      : foremanMode === 'FLAT_FEE'
        ? copy.row3FlatFee(fmtInr(breakdown.flatFeeAmount, sym))
        : foremanMode === 'FREE_TICKET_CYCLE_1' || foremanMode === 'FREE_TICKET_CYCLE_2'
          ? copy.row3FreeTicket(foremanMode)
          : copy.row3CommOnBasis(commissionPct, localizedBasis);

  let row4Title = copy.row4NetDivTitle(eligibleTickets);
  let row4Note = copy.row4PoolNote(
    fmtInr(distributableDividend, sym),
    fmtInr(grossDiscountSharePerTicket, sym),
    fmtInr(foremanFeePerTicket, sym),
  );
  if (dividendPolicy === 'NONE' || dividendDistribution === 'NONE' || isAccumulationGoldOrGoods) {
    row4Title = isAccumulationGoldOrGoods ? copy.row4NoDivAccumTitle : copy.row4NoDivTitle;
    row4Note =
      engineType === 'GOLD_WEIGHT_ACCUMULATION'
        ? `${breakdown.goldDetails?.gramsPerFullTicket ?? 0} g`
        : `${dividendPolicy} · ${dividendDistribution}`;
  } else if (dividendDistribution === 'DEFERRED_BONUS_POOL' || dividendDistribution === 'ACCUMULATE') {
    row4Title = copy.row4DeferredTitle(eligibleTickets);
    row4Note = copy.row4DeferredNote(dividendDistribution, fmtInr(distributableDividend, sym));
  } else if (engineType === 'FIXED_DIVIDEND') {
    row4Title = copy.row4NetDivTitle(eligibleTickets);
    row4Note = copy.row4PoolNote(
      fmtInr(distributableDividend, sym),
      fmtInr(grossDiscountSharePerTicket, sym),
      fmtInr(foremanFeePerTicket, sym),
    );
  }

  const row5Title =
    Math.abs(prizedMemberInstallment - netMemberInstallment) > 0.01
      ? copy.row5DiffTitle
      : copy.row5NetTitle;

  let verificationFormulaLine = `${fmtInr(grossPrize, sym)} | ${fmtInr(dividendPerTicket, sym)} | ${fmtInr(commission, sym)}`;
  if (engineType === 'AUCTION_STANDARD' && dividendPolicy === 'ALL_MEMBERS' && gstAmount === 0) {
    verificationFormulaLine = copy.verifyStandard(
      fmtInr(grossPrize, sym),
      fmtInr(commission, sym),
      totalMembers,
      fmtInr(roundMoney((grossPrize + commission) / Math.max(1, totalMembers)), sym),
    );
  } else if (engineType === 'AUCTION_MULTI_DIVISION') {
    verificationFormulaLine = copy.row2MultiDivNote(fmtInr(prizePayoutTotal, sym), fmtInr(distributableDividend, sym));
  } else if (engineType === 'AUCTION_RESERVE_PRICE' && reserveFloorAmount != null) {
    verificationFormulaLine = copy.verifyReserve(
      fmtInr(reserveFloorAmount, sym),
      fmtInr(grossPrize, sym),
      fmtInr(commission, sym),
      fmtInr(dividendPerTicket, sym),
    );
  } else if (engineType === 'BASE_PLUS_PREMIUM' && breakdown.basePlusPremiumDetails) {
    const bp = breakdown.basePlusPremiumDetails;
    verificationFormulaLine = `${totalMembers}×${bp.nonPrizedInstalment.toLocaleString('en-IN')} + ${bp.alreadyPrizedTicketUnits}×${roundMoney(bp.prizedInstalment - bp.nonPrizedInstalment).toLocaleString('en-IN')} = ${bp.collectedPool.toLocaleString('en-IN')}`;
  } else if (engineType === 'GOLD_WEIGHT_ACCUMULATION' && breakdown.goldDetails) {
    verificationFormulaLine = `Weight Credit g_t = ${baseInstallment.toLocaleString('en-IN')} / ${breakdown.goldDetails.goldRatePerGram.toLocaleString('en-IN')} = ${breakdown.goldDetails.gramsPerFullTicket} g/ticket`;
  } else if (engineType === 'GOLD_VALUE_ACCUMULATION' && breakdown.goldDetails) {
    verificationFormulaLine = `+${breakdown.goldDetails.bonusMonths} mo (${breakdown.goldDetails.bonusPct}%)`;
  } else if (engineType === 'FESTIVAL_COMMODITY' && breakdown.commodityDetails) {
    verificationFormulaLine = `+${breakdown.commodityDetails.merchantBonusPct}%`;
  } else if (engineType === 'ASCA_SHG_REVOLVING' && breakdown.ascaDetails) {
    verificationFormulaLine = `${breakdown.ascaDetails.monthlyLoanInterestPct}%/mo · -${breakdown.ascaDetails.adminExpensePerCycle.toLocaleString('en-IN')}`;
  } else if (engineType === 'HYBRID_SPLIT_PHASE') {
    verificationFormulaLine = `${fmtInr(grossPrize, sym)} · ${fmtInr(dividendPerTicket, sym)}`;
  } else if (breakdown.formulaLines[0]) {
    verificationFormulaLine = breakdown.formulaLines
      .slice(0, 2)
      .map((f) => `${f.label}: ${f.amount.toLocaleString('en-IN')}`)
      .join(' · ');
  }

  return {
    sectionTitle: copy.engineTitles[engineType] ?? ENGINE_SECTION_TITLES[engineType] ?? `${engineType}`,
    row2Title,
    row2Note,
    row3Title,
    row4Title,
    row4Note,
    row5Title,
    verificationFormulaLine,
  };
}

export async function buildChitPeriodReportData(params: {
  chitGroupId: string;
  auctionId: string;
  scope: ChitScope;
  tenantName: string;
  currencySymbol: string;
  cashDenominations?: Record<number, number>;
  lang?: string | null;
  theme?: ChitPdfTheme;
  logoDataUri?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
}): Promise<ChitPeriodReportData | null> {
  const {
    chitGroupId,
    auctionId,
    scope,
    tenantName,
    currencySymbol,
    cashDenominations,
    lang,
    theme,
    logoDataUri,
    companyAddress,
    companyPhone,
    companyEmail,
  } = params;
  const resolvedLang = resolvePdfLang(lang);
  const copy = getPeriodReportCopy(resolvedLang);
  const effectiveSym =
    !currencySymbol || currencySymbol === '₹' ? (ensurePdfFonts() ? '₹' : 'Rs.') : currencySymbol;

  const auction = await prisma.chitAuction.findFirst({
    where: {
      id: auctionId,
      chitGroup: {
        ...scopedChitGroupWhere(scope),
        OR: [{ id: chitGroupId }, { groupCode: chitGroupId }],
      },
    },
    include: {
      chitGroup: {
        include: {
          branch: { select: { name: true, code: true, address: true, phone: true } },
          members: {
            include: {
              customer: { select: { name: true, phone: true } },
              wonAuctions: { select: { id: true, periodNumber: true } },
            },
            orderBy: { memberNumber: 'asc' },
          },
        },
      },
      winnerMember: {
        include: { customer: { select: { name: true, phone: true } } },
      },
      winners: {
        include: { member: { include: { customer: { select: { name: true } } } } },
        orderBy: { createdAt: 'asc' },
      },
      bids: {
        include: { member: { include: { customer: { select: { name: true } } } } },
        orderBy: [{ bidDiscount: 'desc' }, { bidTime: 'asc' }],
      },
      attendance: true,
    },
  });

  if (!auction) return null;

  const group = auction.chitGroup;
  const engineType = resolveEngineTypeFromGroup(group);
  const config = parseChitEngineConfig(group.engineConfig, engineType);
  const engineMeta = CHIT_ENGINE_CATALOG[engineType];

  // Parse immutable snapshot or re-derive cleanly via server engine calculator
  let breakdown: ChitPeriodCalculationBreakdown | null = null;
  if (auction.calculationBreakdown) {
    try {
      const parsed = JSON.parse(auction.calculationBreakdown);
      if (parsed && typeof parsed === 'object') breakdown = parsed as ChitPeriodCalculationBreakdown;
    } catch {
      breakdown = null;
    }
  }

  if (!breakdown) {
    const winnerIds =
      auction.winners.length > 0
        ? auction.winners.map((w) => w.memberId)
        : auction.winnerMemberId
          ? [auction.winnerMemberId]
          : [];

    breakdown = calculateChitPeriodEngine({
      engineType,
      config,
      chitValue: Number(group.chitValue),
      monthlyContrib: Number(group.monthlyContrib),
      totalMembers: group.totalMembers,
      periodNumber: auction.periodNumber,
      commissionPct: Number(group.commissionPct),
      commissionBasis: group.commissionBasis as any,
      gstPct: group.gstPct != null ? Number(group.gstPct) : null,
      dividendPolicy: group.dividendPolicy,
      dividendDistribution: group.dividendDistribution,
      dividendRounding: group.dividendRounding,
      winnerInterestType: group.winnerInterestType,
      winnerInterestValue: group.winnerInterestValue != null ? Number(group.winnerInterestValue) : null,
      winnerInterestPeriods: group.winnerInterestPeriods,
      winnerMemberIds: winnerIds,
      prizeAmount: auction.prizeAmount != null ? Number(auction.prizeAmount) : null,
      fixedDiscountPct: group.fixedDiscountPct != null ? Number(group.fixedDiscountPct) : null,
      goldRatePerGram: auction.goldRatePerGram != null ? Number(auction.goldRatePerGram) : null,
      multiDivisionWinners: auction.winners.length
        ? auction.winners.map((w) => ({
          memberId: w.memberId,
          winType: w.winType,
          prizeAmount: Number(w.prizeAmount),
          bidDiscount: Number(w.bidDiscount),
        }))
        : undefined,
      members: group.members.map((m) => ({
        memberId: m.id,
        memberName: m.customer.name,
        ticketNo: m.ticketNo,
        fractionNo: m.fractionNo,
        ticketShare: Number(m.ticketShare),
        hasWonBeforePeriod: m.wonAuctions.some((wa) => wa.periodNumber < auction.periodNumber),
        isActive: m.subscriberStatus === 'active',
      })),
    });
  }

  // Load subscriptions & receipts for this period
  const subscriptions = await prisma.chitSubscription.findMany({
    where: {
      member: { chitGroupId: group.id },
      periodNumber: auction.periodNumber,
    },
    include: {
      member: { include: { customer: { select: { name: true } } } },
    },
    orderBy: { member: { memberNumber: 'asc' } },
  });

  const subIds = subscriptions.map((s) => s.id);
  const [subReceipts, payoutReceipts, payoutDisbursements, dividendReceipts, security] = await Promise.all([
    subIds.length
      ? prisma.chitReceipt.findMany({
        where: {
          tenantId: group.tenantId,
          entityType: 'subscription',
          entityId: { in: subIds },
          status: 'active',
        },
        orderBy: { issuedAt: 'asc' },
      })
      : [],
    prisma.chitReceipt.findMany({
      where: {
        tenantId: group.tenantId,
        entityType: 'auction',
        entityId: auction.id,
        receiptType: 'payout',
        status: 'active',
      },
      orderBy: { issuedAt: 'asc' },
    }),
    prisma.chitPayoutDisbursement.findMany({
      where: {
        tenantId: group.tenantId,
        auctionId: auction.id,
      },
      orderBy: { trancheNumber: 'asc' },
    }),
    prisma.chitReceipt.findFirst({
      where: {
        tenantId: group.tenantId,
        entityType: 'auction',
        entityId: group.id,
        receiptType: 'dividend_payout',
        notes: { contains: `period ${auction.periodNumber}` },
        status: 'active',
      },
      orderBy: { issuedAt: 'desc' },
      select: { receiptNo: true },
    }),
    prisma.chitSecurity.findFirst({
      where: { auctionId: auction.id, tenantId: group.tenantId },
      include: {
        guarantorMember: {
          include: { customer: { select: { name: true, phone: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const securityDocs = security
    ? await prisma.chitDocument.findMany({
      where: {
        tenantId: group.tenantId,
        entityType: 'chit_security',
        entityId: security.id,
      },
      orderBy: { uploadedAt: 'asc' },
    })
    : [];

  // Resolve collector / issuer names for receipts
  const userIds = Array.from(
    new Set(
      [...subReceipts, ...payoutReceipts]
        .map((r) => r.issuedById)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const users = userIds.length
    ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    })
    : [];
  const userNameMap = new Map(users.map((u) => [u.id, u.name]));

  // Summarize collections for Period N by payment mode
  const modeMap = new Map<string, { count: number; amount: number }>();
  const receiptBySubId = new Map<string, { mode: string; receiptNo: string }>();
  for (const r of subReceipts) {
    receiptBySubId.set(r.entityId, { mode: r.paymentMode, receiptNo: r.receiptNo });
    const key = (r.paymentMode || 'cash').toLowerCase();
    const cur = modeMap.get(key) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount = roundMoney(cur.amount + Number(r.amount));
    modeMap.set(key, cur);
  }
  const byMode: ChitPeriodModeBucket[] = Array.from(modeMap.entries()).map(([mode, stats]) => ({
    mode,
    label: labelMode(mode, copy),
    count: stats.count,
    amount: stats.amount,
  }));

  let totalExpected = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;

  const memberRowById = new Map(breakdown.memberBreakdowns.map((mb) => [mb.memberId, mb]));
  const subByMemberId = new Map(subscriptions.map((s) => [s.memberId, s]));

  const memberRows: ChitPeriodMemberRow[] = group.members.map((m) => {
    const sub = subByMemberId.get(m.id);
    const bd = memberRowById.get(m.id);
    if (sub) {
      const bal = computeSubscriptionBalances(sub, group.dividendDistribution);
      totalExpected = roundMoney(totalExpected + bal.netDue);
      totalCollected = roundMoney(totalCollected + bal.paidAmount);
      totalOutstanding = roundMoney(totalOutstanding + bal.outstanding);
      if (sub.status === 'paid') paidCount += 1;
      else if (sub.status === 'partial') partialCount += 1;
      else unpaidCount += 1;

      const recInfo = receiptBySubId.get(sub.id);
      return {
        ticketNo: m.ticketNo ?? String(m.memberNumber),
        memberName: m.customer.name,
        ticketShare: Number(m.ticketShare),
        role: bd?.roleThisPeriod ?? (m.id === auction.winnerMemberId ? 'winner' : 'member'),
        baseDue: bal.baseDueAmount,
        dividendEarned: Number(sub.dividendAmount),
        deferredDividend: Number(sub.deferredDividendAmount ?? bd?.deferredDividend ?? 0),
        extras: roundMoney(bal.premiumAmount + bal.interestAmount + bal.penaltyAmount),
        netDue: bal.netDue,
        paidAmount: bal.paidAmount,
        outstanding: bal.outstanding,
        goldGramsCredited: bd?.goldGramsCredited ?? 0,
        receiptNo: sub.lastReceiptNo ?? recInfo?.receiptNo ?? '—',
        paymentMode: recInfo ? labelMode(recInfo.mode, copy) : sub.paidAmount && Number(sub.paidAmount) > 0 ? (copy.modeLabels.recorded || 'Recorded') : '—',
        status: sub.status,
      };
    }

    const baseDue = bd?.baseInstalment ?? roundMoney(Number(group.monthlyContrib) * Number(m.ticketShare));
    const expectedFallback = bd?.netPayableNextPeriod ?? baseDue;
    totalExpected = roundMoney(totalExpected + expectedFallback);
    totalOutstanding = roundMoney(totalOutstanding + expectedFallback);
    unpaidCount += 1;
    return {
      ticketNo: m.ticketNo ?? String(m.memberNumber),
      memberName: m.customer.name,
      ticketShare: Number(m.ticketShare),
      role: bd?.roleThisPeriod ?? 'member',
      baseDue,
      dividendEarned: bd?.dividendEarned ?? 0,
      deferredDividend: bd?.deferredDividend ?? 0,
      extras: roundMoney((bd?.premiumAdded ?? 0) + (bd?.winnerInterestAdded ?? 0)),
      netDue: expectedFallback,
      paidAmount: 0,
      outstanding: expectedFallback,
      goldGramsCredited: bd?.goldGramsCredited ?? 0,
      receiptNo: '—',
      paymentMode: '—',
      status: 'upcoming',
    };
  });

  // Statement numbers aligned with each engine template's exact server calculation
  const chitValue = Number(group.chitValue);
  const bidDiscount = breakdown.bidDiscount;
  const grossPrize = breakdown.prizeAmount;
  const multiWinnersFromDb = auction.winners.map((w) => ({
    ticketNo: w.member.ticketNo,
    memberName: w.member.customer.name,
    winType: w.winType,
    prizeAmount: Number(w.prizeAmount),
    bidDiscount: Number(w.bidDiscount),
  }));
  const multiWinnersFallback =
    multiWinnersFromDb.length > 0
      ? multiWinnersFromDb
      : (breakdown.multiDivisionWinners ?? []).map((w) => ({
        ticketNo: w.ticketNo,
        memberName: w.memberName,
        winType: w.winType,
        prizeAmount: w.prizeAmount,
        bidDiscount: w.bidDiscount,
      }));
  const winnerCount = Math.max(1, multiWinnersFallback.length || (auction.winnerMemberId ? 1 : 0));
  const prizePayoutTotal =
    multiWinnersFallback.length > 0
      ? roundMoney(multiWinnersFallback.reduce((s, w) => s + w.prizeAmount, 0))
      : grossPrize;
  const discountPct = chitValue > 0 ? roundMoney((bidDiscount / chitValue) * 100, 2) : 0;
  const commission = breakdown.commission;
  const gstAmount = breakdown.gstAmount;
  const roundingIncome = breakdown.roundingIncome;
  const distributableDividend = breakdown.distributableDividend;
  const deferredDividendTotal = roundMoney(
    breakdown.memberBreakdowns.reduce((s, mb) => s + mb.deferredDividend, 0),
  );
  const eligibleTickets = Math.max(1, breakdown.dividendEligibleTickets || group.totalMembers);
  const grossDiscountSharePerTicket = roundMoney(bidDiscount / eligibleTickets);
  const foremanFeePerTicket = roundMoney(commission / eligibleTickets);
  const dividendPerTicket = breakdown.dividendPerTicket;
  const baseInstallment = breakdown.baseInstalment || Number(group.monthlyContrib);

  const nonWinnerSample =
    breakdown.memberBreakdowns.find((mb) => mb.roleThisPeriod === 'non_prized') ??
    breakdown.memberBreakdowns.find((mb) => mb.memberId !== auction.winnerMemberId);
  const prizedSample =
    breakdown.memberBreakdowns.find((mb) => mb.roleThisPeriod === 'previously_prized') ??
    breakdown.memberBreakdowns.find((mb) => mb.roleThisPeriod === 'winner');
  const netMemberInstallment =
    nonWinnerSample != null
      ? roundMoney(
        Math.max(
          0,
          nonWinnerSample.baseInstalment - nonWinnerSample.nextDueDividendCredit + nonWinnerSample.premiumAdded,
        ),
      )
      : Math.max(0, roundMoney(baseInstallment - dividendPerTicket));
  const prizedMemberInstallment =
    prizedSample != null
      ? roundMoney(
        Math.max(
          0,
          prizedSample.baseInstalment -
          prizedSample.nextDueDividendCredit +
          prizedSample.premiumAdded +
          prizedSample.winnerInterestAdded,
        ),
      )
      : netMemberInstallment;
  const winnerInterestAdded = roundMoney(
    breakdown.memberBreakdowns.reduce((maxVal, mb) => Math.max(maxVal, mb.winnerInterestAdded), 0),
  );

  // Winner(s) current-period instalment reconciliation (from actual ChitSubscription for period N)
  const winnerIdsForPeriod =
    auction.winners.length > 0
      ? auction.winners.map((w) => w.memberId)
      : auction.winnerMemberId
        ? [auction.winnerMemberId]
        : [];
  const winnerSubs = winnerIdsForPeriod
    .map((id) => subByMemberId.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  let winnerPeriodInstallmentDue = 0;
  let winnerPeriodInstallmentPaid = 0;
  let winnerPeriodInstallmentUnpaid = 0;
  if (winnerSubs.length > 0) {
    for (const ws of winnerSubs) {
      const bal = computeSubscriptionBalances(ws, group.dividendDistribution);
      winnerPeriodInstallmentDue = roundMoney(winnerPeriodInstallmentDue + bal.netDue);
      winnerPeriodInstallmentPaid = roundMoney(winnerPeriodInstallmentPaid + bal.paidAmount);
      winnerPeriodInstallmentUnpaid = roundMoney(winnerPeriodInstallmentUnpaid + bal.outstanding);
    }
  } else {
    winnerPeriodInstallmentDue = roundMoney(netMemberInstallment * Math.max(1, winnerIdsForPeriod.length || 1));
    winnerPeriodInstallmentPaid = 0;
    winnerPeriodInstallmentUnpaid = winnerPeriodInstallmentDue;
  }
  const netPayableAfterWinnerInstallment = Math.max(
    0,
    roundMoney(prizePayoutTotal - winnerPeriodInstallmentUnpaid),
  );

  const otherMembersCount = Math.max(0, group.totalMembers - winnerIdsForPeriod.length);
  const otherMembersExpectedCollection = roundMoney(otherMembersCount * netMemberInstallment);
  const netFundsAvailableForWinner = roundMoney(
    otherMembersExpectedCollection - commission - gstAmount,
  );

  const reserveFloorAmount =
    auction.reserveFloorAmount != null
      ? Number(auction.reserveFloorAmount)
      : breakdown.reserveFloorAmount ?? null;
  const reserveFloorPct =
    reserveFloorAmount != null && chitValue > 0 ? roundMoney((reserveFloorAmount / chitValue) * 100, 2) : null;
  const hybridPhase = breakdown.hybridPhase ?? null;

  const statementCopy = buildTemplateStatementCopy({
    engineType,
    chitValue,
    bidDiscount,
    discountPct,
    grossPrize,
    prizePayoutTotal,
    winnerCount,
    commission,
    commissionPct: Number(group.commissionPct),
    commissionBasis: group.commissionBasis,
    foremanMode: breakdown.foremanCompensationMode,
    distributableDividend,
    eligibleTickets,
    grossDiscountSharePerTicket,
    foremanFeePerTicket,
    dividendPerTicket,
    baseInstallment,
    prizedMemberInstallment,
    netMemberInstallment,
    totalMembers: group.totalMembers,
    gstAmount,
    dividendPolicy: group.dividendPolicy,
    dividendDistribution: group.dividendDistribution,
    hybridPhase,
    reserveFloorAmount,
    breakdown,
    sym: effectiveSym,
    copy,
  });

  // Build Payout / Disbursement settlement rows & aggregate saved cash denominations
  const savedDenoms: Record<number, number> = {};
  const payoutRows: ChitPeriodSettlementRow[] = [];
  if (payoutDisbursements.length > 0) {
    payoutDisbursements.forEach((pd, idx) => {
      const modeDesc = labelMode(pd.paymentMode, copy);
      const pdDenoms = normalizeCashDenominations(pd.denominationBreakdown);
      if (pdDenoms) {
        for (const [k, v] of Object.entries(pdDenoms)) {
          const d = Number(k);
          savedDenoms[d] = (savedDenoms[d] ?? 0) + Number(v);
        }
      }
      const denomSummary = formatCashDenominationsSummary(pdDenoms, effectiveSym);
      const baseRef = pd.referenceNumber
        ? `${modeDesc} · ${pd.referenceNumber}`
        : `${modeDesc} · #${pd.trancheNumber}`;
      payoutRows.push({
        slNo: idx + 1,
        description: pd.notes
          ? `#${pd.trancheNumber} · ${pd.notes}`
          : `${modeDesc} ${copy.payoutWord} (#${pd.trancheNumber})`,
        modeOrRef: denomSummary ? `${baseRef} · ${denomSummary}` : baseRef,
        amount: Number(pd.amount),
      });
    });
  } else if (payoutReceipts.length > 0) {
    payoutReceipts.forEach((pr, idx) => {
      const issuer = pr.issuedById ? userNameMap.get(pr.issuedById) : null;
      const modeDesc = labelMode(pr.paymentMode, copy);
      const prDenoms = normalizeCashDenominations((pr as any).cashDenominationsJson);
      if (prDenoms) {
        for (const [k, v] of Object.entries(prDenoms)) {
          const d = Number(k);
          savedDenoms[d] = (savedDenoms[d] ?? 0) + Number(v);
        }
      }
      const denomSummary = formatCashDenominationsSummary(prDenoms, effectiveSym);
      const baseRef = pr.referenceNo ? `${modeDesc} · ${pr.referenceNo}` : `${modeDesc} · ${pr.receiptNo}`;
      payoutRows.push({
        slNo: idx + 1,
        description: pr.notes
          ? pr.notes
          : `${modeDesc} ${copy.payoutWord}${issuer ? ` (${issuer})` : ''}`,
        modeOrRef: denomSummary ? `${baseRef} · ${denomSummary}` : baseRef,
        amount: Number(pr.amount),
      });
    });
  } else if (byMode.length > 0 && auction.payoutStatus === 'paid') {
    byMode.forEach((mb, idx) => {
      payoutRows.push({
        slNo: idx + 1,
        description: `${mb.label} (${mb.count} ${copy.txnsWord})`,
        modeOrRef: mb.label,
        amount: mb.amount,
      });
    });
  }
  const arrearsDeductedAmount = roundMoney(Number((auction as any).arrearsDeductedAmount ?? 0));
  const penaltyDeductedAmount = roundMoney(Number((auction as any).penaltyDeductedAmount ?? 0));
  const netPayableAmount =
    (auction as any).netPayableAmount != null
      ? roundMoney(Number((auction as any).netPayableAmount))
      : Math.max(0, roundMoney(prizePayoutTotal - arrearsDeductedAmount - penaltyDeductedAmount));
  const totalDisbursedToWinner = roundMoney(payoutRows.reduce((s, r) => s + r.amount, 0));
  const targetPayout = netPayableAmount;
  const remainingPayoutBalance = Math.max(0, roundMoney(targetPayout - totalDisbursedToWinner));

  // Hydrate cash denominations: query-param override takes precedence if non-empty, else saved receipt denominations
  const explicitDenoms = normalizeCashDenominations(cashDenominations);
  const effectiveDenoms = explicitDenoms ?? (Object.keys(savedDenoms).length > 0 ? savedDenoms : undefined);
  const defaultDenoms = [500, 200, 100, 50, 20, 10];
  const suppliedKeys = effectiveDenoms
    ? Object.keys(effectiveDenoms).map(Number).filter((d) => d > 0)
    : [];
  const denomList = Array.from(new Set([...defaultDenoms, ...suppliedKeys])).sort((a, b) => b - a);
  const denominations: CashDenominationEntry[] = denomList
    .filter((d) => d === 500 || d === 200 || d === 100 || (effectiveDenoms?.[d] ?? 0) > 0)
    .map((d) => {
      const count = Math.max(0, Math.floor(effectiveDenoms?.[d] ?? 0));
      return { denomination: d, count, amount: roundMoney(d * count) };
    });
  const denominationCashTotal = roundMoney(denominations.reduce((s, d) => s + d.amount, 0));

  const presentCount = auction.attendance.filter((a) => a.status === 'present').length;
  const proxyCount = auction.attendance.filter((a) => a.status === 'proxy').length;
  const absentCount = auction.attendance.filter((a) => a.status === 'absent').length;

  const isFinalized = ['confirmed', 'paid', 'completed'].includes(auction.status);
  const formattedMinutesDate = new Date(auction.auctionDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const minutesText =
    resolvedLang !== 'en' && isFinalized
      ? copy.autoMinutesSummary({
        groupName: group.name,
        period: auction.periodNumber,
        dateStr: formattedMinutesDate,
        present: presentCount + proxyCount,
        total: group.totalMembers,
        winner: auction.winnerMember?.customer?.name ?? copy.winnerPending,
        prize: fmtInr(grossPrize, effectiveSym),
        discount: fmtInr(bidDiscount, effectiveSym),
        comm: fmtInr(commission, effectiveSym),
        div: fmtInr(dividendPerTicket, effectiveSym),
      })
      : auction.minutesText ||
      (isFinalized
        ? generateAuctionMinutes({
          groupName: group.name,
          periodNumber: auction.periodNumber,
          auctionDate: auction.auctionDate,
          winnerName: auction.winnerMember?.customer?.name ?? 'TBD',
          prizeAmount: grossPrize,
          bidDiscount,
          commission,
          dividend: dividendPerTicket,
          presentCount: presentCount + proxyCount,
          totalMembers: group.totalMembers,
        })
        : copy.notFinalizedMinutes);

  const secSpec = security ? getSecurityTypeSpec(security.securityType) : null;

  return {
    lang: resolvedLang,
    tenantName,
    branchName: group.branch?.name ?? 'Main Branch',
    companyAddress: group.branch?.address?.trim() || companyAddress || null,
    companyPhone: group.branch?.phone?.trim() || companyPhone || null,
    companyEmail: companyEmail || null,
    logoDataUri: logoDataUri ?? loadLocalAssetDataUri(null),
    theme: theme ?? DEFAULT_CHIT_PDF_THEME,
    currencySymbol: effectiveSym,
    generatedAt: new Date().toISOString(),
    templateSectionTitle: statementCopy.sectionTitle,
    group: {
      id: group.id,
      groupCode: group.groupCode,
      name: group.name,
      chitValue,
      monthlyContrib: baseInstallment,
      totalMembers: group.totalMembers,
      frequency: group.auctionFrequency || config.collectionFrequency.toLowerCase(),
      auctionType: group.auctionType,
      chitType: group.chitType,
      engineType,
      engineCategory: breakdown.engineCategory,
      engineLabel: engineMeta.name,
      payoutAssetType: breakdown.payoutAssetType,
      commissionPct: Number(group.commissionPct),
      commissionBasis: group.commissionBasis,
      gstPct: Number(group.gstPct ?? 0),
      dividendPolicy: group.dividendPolicy,
      dividendDistribution: group.dividendDistribution,
    },
    auction: {
      id: auction.id,
      periodNumber: auction.periodNumber,
      auctionDate: auction.auctionDate.toISOString(),
      scheduledAt: auction.scheduledAt?.toISOString() ?? null,
      status: auction.status,
      payoutStatus: auction.payoutStatus,
      isFinalized,
      winnerName: auction.winnerMember?.customer?.name ?? null,
      winnerTicketNo: auction.winnerMember?.ticketNo ?? null,
      winnerPhone: auction.winnerMember?.customer?.phone ?? null,
      presentCount,
      absentCount,
      proxyCount,
      reserveFloorAmount,
      goldRatePerGram:
        auction.goldRatePerGram != null
          ? Number(auction.goldRatePerGram)
          : breakdown.goldDetails?.goldRatePerGram ?? null,
      minutesText,
    },
    statement: {
      chitValue,
      bidDiscount,
      discountPct,
      grossPrize,
      prizePayoutTotal,
      winnerCount,
      foremanCompensationMode: breakdown.foremanCompensationMode,
      hybridPhase,
      reserveFloorAmount,
      reserveFloorPct,
      commission,
      gstAmount,
      roundingIncome,
      forfeitedDividendTotal: breakdown.forfeitedDividendTotal,
      distributableDividend,
      deferredDividendTotal,
      eligibleTickets,
      grossDiscountSharePerTicket,
      foremanFeePerTicket,
      dividendPerTicket,
      baseInstallment,
      netMemberInstallment,
      prizedMemberInstallment,
      winnerInterestAdded,
      winnerPeriodInstallmentDue,
      winnerPeriodInstallmentPaid,
      winnerPeriodInstallmentUnpaid,
      netPayableAfterWinnerInstallment,
      otherMembersCount,
      otherMembersExpectedCollection,
      netFundsAvailableForWinner,
      verificationFormulaLine: statementCopy.verificationFormulaLine,
      row2Title: statementCopy.row2Title,
      row2Note: statementCopy.row2Note,
      row3Title: statementCopy.row3Title,
      row4Title: statementCopy.row4Title,
      row4Note: statementCopy.row4Note,
      row5Title: statementCopy.row5Title,
    },
    basePlusPremium: breakdown.basePlusPremiumDetails ?? null,
    gold: breakdown.goldDetails ?? null,
    commodity: breakdown.commodityDetails ?? null,
    asca: breakdown.ascaDetails ?? null,
    collections: {
      totalExpected,
      totalCollected,
      totalOutstanding,
      paidCount,
      partialCount,
      unpaidCount,
      byMode,
    },
    payouts: {
      rows: payoutRows,
      totalDisbursedToWinner,
      remainingPayoutBalance,
      arrearsDeductedAmount,
      penaltyDeductedAmount,
      netPayableAmount,
      dividendReceiptNo: dividendReceipts?.receiptNo ?? null,
    },
    denominations,
    denominationCashTotal,
    security: security && secSpec
      ? {
        typeCode: secSpec.type,
        typeLabel: secSpec.label,
        status: security.status,
        value: security.securityValue != null ? Number(security.securityValue) : null,
        guarantorLabel: security.guarantorMember
          ? `#${security.guarantorMember.ticketNo ?? security.guarantorMember.memberNumber} ${security.guarantorMember.customer.name}`
          : security.guarantorName ?? null,
        guarantorPhone: security.guarantorMember?.customer?.phone ?? security.guarantorPhone ?? null,
        details: security.details ?? null,
        documents: Array.from(
          new Map(securityDocs.map((doc) => [doc.documentType, doc])).values(),
        ).map((doc) => ({
          type: doc.documentType,
          label: SECURITY_DOCUMENT_LABELS[doc.documentType] ?? doc.documentType,
          fileName: doc.fileName,
          status: doc.status,
        })),
      }
      : null,
    multiDivisionWinners: multiWinnersFallback,
    bids: auction.bids.map((b) => ({
      ticketNo: b.member.ticketNo ?? String(b.member.memberNumber),
      memberName: b.member.customer.name,
      prizeAmount: Number(b.bidAmount),
      bidDiscount: Number(b.bidDiscount),
      bidTime: b.bidTime.toISOString(),
      source: b.source ?? 'tap',
      status: b.status,
    })),
    memberRows,
    formulaLines: breakdown.formulaLines.map((f) => `${f.label}: ${f.amount.toLocaleString('en-IN')}`),
  };
}
