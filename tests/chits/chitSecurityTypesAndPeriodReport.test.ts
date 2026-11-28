import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { calculateChitPeriodEngine } from '../../lib/chits/engineCalculator';
import { parseChitEngineConfig } from '../../lib/chits/engineTypes';
import {
  buildTemplateStatementCopy,
  DEFAULT_CHIT_PDF_THEME,
  resolvePeriodMemberDisplayStatus,
  type ChitPeriodReportData,
} from '../../lib/chits/periodReport';
import { ChitPeriodReportPDF } from '../../lib/chits/periodReportPdf';
import {
  ALLOWED_SECURITY_DOCUMENT_TYPES,
  CANONICAL_SECURITY_OPTIONS,
  getSecurityTypeSpec,
  normalizeSecurityType,
} from '../../lib/chits/securityTypes';

async function main() {
  // 1. Dynamic security types expose only type-relevant fields and files
  assert.equal(CANONICAL_SECURITY_OPTIONS.length, 7);
  assert.equal(normalizeSecurityType('guarantor'), 'INTERNAL_GUARANTOR_JAMEEN');
  assert.equal(normalizeSecurityType('gold'), 'GOLD_PLEDGE');
  assert.equal(normalizeSecurityType('cheque'), 'POST_DATED_CHEQUE');
  assert.equal(normalizeSecurityType('property'), 'PROPERTY_DOCUMENT');
  assert.equal(normalizeSecurityType('fd'), 'FD_LIEN');
  assert.equal(normalizeSecurityType('none'), 'NONE');

  const jameen = getSecurityTypeSpec('INTERNAL_GUARANTOR_JAMEEN');
  assert.equal(jameen.showGuarantorMember, true);
  assert.equal(jameen.showPartyName, true);
  assert.equal(jameen.showValue, false);
  assert.deepEqual(
    jameen.documents.map((d) => d.type),
    ['guarantor_photo', 'guarantor_kyc'],
  );

  const promissory = getSecurityTypeSpec('PROMISSORY_NOTE');
  assert.equal(promissory.showGuarantorMember, false);
  assert.equal(promissory.showValue, true);
  assert.equal(promissory.showPartyName, true);
  assert.deepEqual(
    promissory.documents.map((d) => d.type),
    ['promissory_note', 'witness_kyc'],
  );

  const pdc = getSecurityTypeSpec('POST_DATED_CHEQUE');
  assert.equal(pdc.showGuarantorMember, false);
  assert.equal(pdc.showPartyName, false);
  assert.equal(pdc.showValue, true);
  assert.deepEqual(
    pdc.documents.map((d) => d.type),
    ['security_cheque', 'bank_proof'],
  );

  const gold = getSecurityTypeSpec('GOLD_PLEDGE');
  assert.equal(gold.showGuarantorMember, false);
  assert.equal(gold.showPartyName, false);
  assert.deepEqual(
    gold.documents.map((d) => d.type),
    ['gold_photo', 'gold_appraisal'],
  );

  const property = getSecurityTypeSpec('PROPERTY_DOCUMENT');
  assert.deepEqual(
    property.documents.map((d) => d.type),
    ['property_deed', 'property_ec'],
  );

  const fd = getSecurityTypeSpec('FD_LIEN');
  assert.deepEqual(
    fd.documents.map((d) => d.type),
    ['fd_receipt', 'fd_lien_letter'],
  );

  const none = getSecurityTypeSpec('NONE');
  assert.equal(none.showGuarantorMember, false);
  assert.equal(none.showValue, false);
  assert.equal(none.showPartyName, false);
  assert.equal(none.documents.length, 0);

  for (const requiredType of [
    'guarantor_photo',
    'guarantor_kyc',
    'promissory_note',
    'witness_kyc',
    'security_cheque',
    'bank_proof',
    'gold_photo',
    'gold_appraisal',
    'property_deed',
    'property_ec',
    'fd_receipt',
    'fd_lien_letter',
  ]) {
    assert.ok(ALLOWED_SECURITY_DOCUMENT_TYPES.has(requiredType), `missing ${requiredType}`);
  }

  // 2. Verify Gemini 3.00 Lakh Chit Period-3 reconciliation math against server engine
  const members = Array.from({ length: 50 }, (_, idx) => ({
    memberId: `m-${idx + 1}`,
    memberName: idx === 0 ? 'Asvin' : `Member ${idx + 1}`,
    ticketNo: String(idx + 1),
    fractionNo: null,
    ticketShare: 1,
    hasWonBeforePeriod: false,
    isActive: true,
  }));

  const breakdown = calculateChitPeriodEngine({
    engineType: 'AUCTION_STANDARD',
    config: parseChitEngineConfig(null, 'AUCTION_STANDARD'),
    chitValue: 300_000,
    monthlyContrib: 6_000,
    totalMembers: 50,
    periodNumber: 3,
    commissionPct: 5,
    commissionBasis: 'CHIT_VALUE',
    gstPct: 0,
    dividendPolicy: 'ALL_MEMBERS',
    dividendDistribution: 'ADJUST_NEXT_DUE',
    dividendRounding: 1,
    winnerInterestType: 'NONE',
    winnerInterestValue: 0,
    winnerInterestPeriods: 0,
    winnerMemberIds: ['m-1'],
    prizeAmount: 119_000, // 3,00,000 - 1,81,000 discount
    members,
  });

  assert.equal(breakdown.bidDiscount, 181_000);
  assert.equal(breakdown.prizeAmount, 119_000);
  assert.equal(breakdown.commission, 15_000);
  assert.equal(breakdown.distributableDividend, 166_000);
  assert.equal(breakdown.dividendPerTicket, 3_320);

  const nonWinner = breakdown.memberBreakdowns.find((m) => m.memberId === 'm-2');
  assert.ok(nonWinner);
  assert.equal(nonWinner.netPayableNextPeriod, 2_680);

  const winnerNetCashInHand = breakdown.prizeAmount - 2_680;
  assert.equal(winnerNetCashInHand, 116_320);
  assert.equal(49 * 2_680 - breakdown.commission, 116_320);

  // 3. Render period PDF cleanly using @react-pdf/renderer
  const stdCopy = buildTemplateStatementCopy({
    engineType: 'AUCTION_STANDARD',
    chitValue: 300_000,
    bidDiscount: 181_000,
    discountPct: 60.33,
    grossPrize: 119_000,
    prizePayoutTotal: 119_000,
    winnerCount: 1,
    commission: 15_000,
    commissionPct: 5,
    commissionBasis: 'CHIT_VALUE',
    foremanMode: 'PERCENTAGE_COMMISSION',
    distributableDividend: 166_000,
    eligibleTickets: 50,
    grossDiscountSharePerTicket: 3_620,
    foremanFeePerTicket: 300,
    dividendPerTicket: 3_320,
    baseInstallment: 6_000,
    prizedMemberInstallment: 2_680,
    netMemberInstallment: 2_680,
    totalMembers: 50,
    gstAmount: 0,
    dividendPolicy: 'ALL_MEMBERS',
    dividendDistribution: 'ADJUST_NEXT_DUE',
    hybridPhase: null,
    reserveFloorAmount: null,
    breakdown,
    sym: '₹',
  });

  const sampleReport: ChitPeriodReportData = {
    tenantName: 'ZoloFund Demo',
    branchName: 'Head Office',
    currencySymbol: '₹',
    generatedAt: '2026-06-20T10:00:00.000Z',
    templateSectionTitle: stdCopy.sectionTitle,
    group: {
      id: 'g-1',
      groupCode: 'CHIT-3L',
      name: '3.00 Lakh Chit Group',
      startDate: '2026-04-01T00:00:00.000Z',
      chitValue: 300_000,
      monthlyContrib: 6_000,
      totalMembers: 50,
      frequency: 'monthly',
      auctionType: 'open_live',
      chitType: 'registered',
      engineType: 'AUCTION_STANDARD',
      engineCategory: 'AUCTION',
      engineLabel: 'Standard Auction Dividend Chit',
      payoutAssetType: 'CASH',
      commissionPct: 5,
      commissionBasis: 'CHIT_VALUE',
      gstPct: 0,
      dividendPolicy: 'ALL_MEMBERS',
      dividendDistribution: 'ADJUST_NEXT_DUE',
    },
    auction: {
      id: 'a-3',
      periodNumber: 3,
      auctionDate: '2026-06-20T00:00:00.000Z',
      scheduledAt: null,
      status: 'paid',
      payoutStatus: 'paid',
      isFinalized: true,
      winnerName: 'Asvin',
      winnerTicketNo: '1',
      winnerPhone: '9000000001',
      presentCount: 45,
      absentCount: 3,
      proxyCount: 2,
      reserveFloorAmount: null,
      goldRatePerGram: null,
      minutesText: 'Period 3 auction concluded cleanly.',
    },
    statement: {
      chitValue: 300_000,
      bidDiscount: 181_000,
      discountPct: 60.33,
      grossPrize: 119_000,
      prizePayoutTotal: 119_000,
      winnerCount: 1,
      foremanCompensationMode: 'PERCENTAGE_COMMISSION',
      hybridPhase: null,
      reserveFloorAmount: null,
      reserveFloorPct: null,
      commission: 15_000,
      gstAmount: 0,
      roundingIncome: 0,
      forfeitedDividendTotal: 0,
      distributableDividend: 166_000,
      deferredDividendTotal: 0,
      eligibleTickets: 50,
      grossDiscountSharePerTicket: 3_620,
      foremanFeePerTicket: 300,
      dividendPerTicket: 3_320,
      baseInstallment: 6_000,
      netMemberInstallment: 2_680,
      prizedMemberInstallment: 2_680,
      winnerInterestAdded: 0,
      winnerPeriodInstallmentDue: 2_680,
      winnerPeriodInstallmentPaid: 0,
      winnerPeriodInstallmentUnpaid: 2_680,
      netPayableAfterWinnerInstallment: 116_320,
      otherMembersCount: 49,
      otherMembersExpectedCollection: 131_320,
      netFundsAvailableForWinner: 116_320,
      verificationFormulaLine: stdCopy.verificationFormulaLine,
      row2Title: stdCopy.row2Title,
      row2Note: stdCopy.row2Note,
      row3Title: stdCopy.row3Title,
      row4Title: stdCopy.row4Title,
      row4Note: stdCopy.row4Note,
      row5Title: stdCopy.row5Title,
    },
    basePlusPremium: null,
    gold: null,
    commodity: null,
    asca: null,
    collections: {
      totalExpected: 134_000,
      totalCollected: 131_320,
      totalOutstanding: 2_680,
      paidCount: 49,
      partialCount: 0,
      unpaidCount: 1,
      byMode: [
        { mode: 'upi', label: 'UPI / GPay', count: 24, amount: 116_320 },
        { mode: 'cash', label: 'Cash', count: 25, amount: 15_000 },
      ],
    },
    payouts: {
      rows: [
        { slNo: 1, description: 'GPay Direct (22 Members x 2,680)', modeOrRef: 'UPI / GPay', amount: 58_960 },
        { slNo: 2, description: 'GPay Tharun (Foreman Transfer)', modeOrRef: 'UPI · TXN-001', amount: 50_000 },
        { slNo: 3, description: 'GPay Gowri (Foreman Transfer)', modeOrRef: 'UPI · TXN-002', amount: 7_360 },
      ],
      totalDisbursedToWinner: 116_320,
      remainingPayoutBalance: 0,
      dividendReceiptNo: 'DIV-003',
    },
    denominations: [
      { denomination: 500, count: 0, amount: 0 },
      { denomination: 200, count: 0, amount: 0 },
      { denomination: 100, count: 0, amount: 0 },
    ],
    denominationCashTotal: 0,
    security: {
      typeCode: 'GOLD_PLEDGE',
      typeLabel: 'Gold Pledge',
      status: 'approved',
      value: 150_000,
      guarantorLabel: null,
      guarantorPhone: null,
      details: '22K Gold Bangles, Net 24g',
      documents: [{ label: 'Gold Ornament Photo', fileName: 'bangles.jpg', status: 'approved' }],
    },
    multiDivisionWinners: [],
    bids: [
      {
        ticketNo: '1',
        memberName: 'Asvin',
        prizeAmount: 119_000,
        bidDiscount: 181_000,
        bidTime: '2026-06-20T10:00:00.000Z',
        source: 'tap',
        status: 'winning',
      },
    ],
    memberRows: [
      {
        ticketNo: '1',
        memberName: 'Asvin',
        ticketShare: 1,
        role: 'winner',
        baseDue: 6_000,
        dividendEarned: 3_320,
        deferredDividend: 0,
        extras: 0,
        netDue: 2_680,
        paidAmount: 0,
        outstanding: 2_680,
        goldGramsCredited: 0,
        receiptNo: '—',
        paymentMode: '—',
        status: 'pending',
      },
    ],
    formulaLines: breakdown.formulaLines.map((f) => `${f.label}: ${f.amount.toLocaleString('en-IN')}`),
  };

  const pdfBuffer = await renderToBuffer(createElement(ChitPeriodReportPDF, { data: sampleReport }) as any);
  assert.ok(pdfBuffer.byteLength > 2000, 'rendered PDF buffer should be non-trivial');
  assert.equal(pdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-', 'must emit valid PDF header');

  // 4. Verify non-standard templates compute distinct period mechanics & render distinct PDFs
  const goldMembers = Array.from({ length: 12 }, (_, idx) => ({
    memberId: `gm-${idx + 1}`,
    memberName: `Gold Member ${idx + 1}`,
    ticketNo: String(idx + 1),
    ticketShare: 1,
    hasWonBeforePeriod: false,
    isActive: true,
  }));
  const goldBreakdown = calculateChitPeriodEngine({
    engineType: 'GOLD_WEIGHT_ACCUMULATION',
    config: parseChitEngineConfig(null, 'GOLD_WEIGHT_ACCUMULATION'),
    chitValue: 120_000,
    monthlyContrib: 10_000,
    totalMembers: 12,
    periodNumber: 4,
    commissionPct: 0,
    commissionBasis: 'CHIT_VALUE',
    gstPct: 0,
    dividendPolicy: 'NONE',
    dividendDistribution: 'NONE',
    winnerMemberIds: ['gm-4'],
    goldRatePerGram: 8_000,
    members: goldMembers,
  });
  assert.equal(goldBreakdown.dividendPerTicket, 0);
  assert.equal(goldBreakdown.goldDetails?.gramsPerFullTicket, 1.25); // 10,000 / 8,000
  const goldCopy = buildTemplateStatementCopy({
    engineType: 'GOLD_WEIGHT_ACCUMULATION',
    chitValue: 120_000,
    bidDiscount: goldBreakdown.bidDiscount,
    discountPct: 0,
    grossPrize: goldBreakdown.prizeAmount,
    prizePayoutTotal: goldBreakdown.prizeAmount,
    winnerCount: 1,
    commission: goldBreakdown.commission,
    commissionPct: 0,
    commissionBasis: 'CHIT_VALUE',
    foremanMode: 'ZERO_COMMISSION',
    distributableDividend: 0,
    eligibleTickets: 12,
    grossDiscountSharePerTicket: 0,
    foremanFeePerTicket: 0,
    dividendPerTicket: 0,
    baseInstallment: 10_000,
    prizedMemberInstallment: 10_000,
    netMemberInstallment: 10_000,
    totalMembers: 12,
    gstAmount: 0,
    dividendPolicy: 'NONE',
    dividendDistribution: 'NONE',
    hybridPhase: null,
    reserveFloorAmount: null,
    breakdown: goldBreakdown,
    sym: '₹',
  });
  assert.match(goldCopy.sectionTitle, /Gold Weight/i);
  assert.match(goldCopy.verificationFormulaLine, /1\.25 g\/ticket/);

  const bpMembers = Array.from({ length: 10 }, (_, idx) => ({
    memberId: `bp-${idx + 1}`,
    memberName: `BP Member ${idx + 1}`,
    ticketNo: String(idx + 1),
    ticketShare: 1,
    hasWonBeforePeriod: idx < 2,
    isActive: true,
  }));
  const bpCfg = parseChitEngineConfig(
    { differentialInstalment: { enabled: true, baseInstalment: 5_000, prizedPremiumAmount: 1_500 } },
    'BASE_PLUS_PREMIUM',
  );
  const bpBreakdown = calculateChitPeriodEngine({
    engineType: 'BASE_PLUS_PREMIUM',
    config: bpCfg,
    chitValue: 50_000,
    monthlyContrib: 5_000,
    totalMembers: 10,
    periodNumber: 3,
    commissionPct: 5,
    commissionBasis: 'CHIT_VALUE',
    gstPct: 0,
    dividendPolicy: 'NONE',
    dividendDistribution: 'NONE',
    winnerMemberIds: ['bp-3'],
    prizeAmount: 47_500,
    members: bpMembers,
  });
  assert.equal(bpBreakdown.basePlusPremiumDetails?.nonPrizedInstalment, 5_000);
  assert.equal(bpBreakdown.basePlusPremiumDetails?.prizedInstalment, 6_500);
  assert.equal(bpBreakdown.basePlusPremiumDetails?.collectedPool, 53_000);
  assert.equal(bpBreakdown.memberBreakdowns[0]?.netPayableNextPeriod, 6_500); // previously prized
  assert.equal(bpBreakdown.memberBreakdowns[5]?.netPayableNextPeriod, 5_000); // non-prized

  const goldPdfBuffer = await renderToBuffer(
    createElement(ChitPeriodReportPDF, {
      data: {
        ...sampleReport,
        templateSectionTitle: goldCopy.sectionTitle,
        group: { ...sampleReport.group, engineType: 'GOLD_WEIGHT_ACCUMULATION', engineLabel: 'Gold Weight-Accumulation Chit', commissionPct: 0 },
        statement: {
          ...sampleReport.statement,
          chitValue: 120_000,
          bidDiscount: 0,
          discountPct: 0,
          grossPrize: 120_000,
          prizePayoutTotal: 120_000,
          commission: 0,
          distributableDividend: 0,
          dividendPerTicket: 0,
          baseInstallment: 10_000,
          netMemberInstallment: 10_000,
          prizedMemberInstallment: 10_000,
          verificationFormulaLine: goldCopy.verificationFormulaLine,
          row2Title: goldCopy.row2Title,
          row2Note: goldCopy.row2Note,
          row3Title: goldCopy.row3Title,
          row4Title: goldCopy.row4Title,
          row4Note: goldCopy.row4Note,
          row5Title: goldCopy.row5Title,
        },
        gold: goldBreakdown.goldDetails ?? null,
        memberRows: [
          {
            ticketNo: '1',
            memberName: 'Gold Member 1',
            ticketShare: 1,
            role: 'member',
            baseDue: 10_000,
            dividendEarned: 0,
            deferredDividend: 0,
            extras: 0,
            netDue: 10_000,
            paidAmount: 10_000,
            outstanding: 0,
            goldGramsCredited: 1.25,
            receiptNo: 'REC-10',
            paymentMode: 'UPI / GPay',
            status: 'paid',
          },
        ],
        formulaLines: goldBreakdown.formulaLines.map((f) => `${f.label}: ${f.amount}`),
      },
    }) as any,
  );
  assert.equal(goldPdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');

  // 5. Verify a 10-member and 20-member period report build validly in English & Tamil without errors,
  // and all 6 language dictionaries provide full everyday translations for statuses, roles, and security types.
  const tenMemberReport: ChitPeriodReportData = {
    ...sampleReport,
    companyAddress: '42 Anna Salai, Teynampet, Chennai 600018',
    companyPhone: '+91 98400 12345',
    theme: DEFAULT_CHIT_PDF_THEME,
    memberRows: Array.from({ length: 10 }, (_, idx) => ({
      ticketNo: String(idx + 1),
      memberName: idx === 2 ? 'Vijay Anand' : `Subscriber ${idx + 1}`,
      ticketShare: 1,
      role: idx === 2 ? 'winner' : idx === 8 ? 'previously_prized' : 'non_prized',
      baseDue: 10_000,
      dividendEarned: 950,
      deferredDividend: 0,
      extras: 0,
      netDue: 9_050,
      paidAmount: idx === 2 ? 9_050 : 0,
      outstanding: idx === 2 ? 0 : 9_050,
      goldGramsCredited: 0,
      receiptNo: idx === 2 ? 'REC-003' : '—',
      paymentMode: idx === 2 ? 'Recorded' : '—',
      status: idx === 2 ? 'paid' : 'upcoming',
    })),
    denominations: [
      { denomination: 500, count: 50, amount: 25_000 },
      { denomination: 200, count: 200, amount: 40_000 },
      { denomination: 100, count: 9, amount: 900 },
      { denomination: 50, count: 1, amount: 50 },
    ],
    denominationCashTotal: 65_950,
  };
  const tenMemberPdfBuffer = await renderToBuffer(createElement(ChitPeriodReportPDF, { data: tenMemberReport }) as any);
  assert.equal(tenMemberPdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');
  const tenPageCount = (tenMemberPdfBuffer.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
  assert.ok(tenPageCount >= 1 && tenPageCount <= 2, `Expected 10-member period PDF to render in 1-2 intact pages, got ${tenPageCount}`);

  const twentyMemberReport: ChitPeriodReportData = {
    ...tenMemberReport,
    lang: 'ta',
    memberRows: Array.from({ length: 20 }, (_, idx) => ({
      ticketNo: String(idx + 1),
      memberName: idx === 2 ? 'Eswari Murugesan' : `Member ${idx + 1}`,
      ticketShare: 1,
      role: idx === 2 ? 'winner' : idx < 7 ? 'previously_prized' : 'non_prized',
      baseDue: 250_000,
      dividendEarned: 2_750,
      deferredDividend: 0,
      extras: 0,
      netDue: 247_250,
      paidAmount: idx === 2 ? 247_250 : 0,
      outstanding: idx === 2 ? 0 : 247_250,
      goldGramsCredited: 0,
      receiptNo: '—',
      paymentMode: '—',
      status: idx === 2 ? 'paid' : 'upcoming',
    })),
    security: {
      typeCode: 'INTERNAL_GUARANTOR_JAMEEN',
      typeLabel: 'Internal Guarantor (Jameen)',
      status: 'verified',
      value: 50_00_000,
      guarantorLabel: '#1 Bharathi Balasubramanian',
      guarantorPhone: null,
      details: null,
      documents: [
        { type: 'guarantor_photo', label: 'Guarantor Photo', fileName: 'photo.jpg', status: 'verified' },
        { type: 'guarantor_kyc', label: 'Guarantor KYC', fileName: 'kyc.pdf', status: 'verified' },
      ],
    },
  };
  const tamilTwentyPdfBuffer = await renderToBuffer(createElement(ChitPeriodReportPDF, { data: twentyMemberReport, lang: 'ta' }) as any);
  assert.equal(tamilTwentyPdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');

  const { getPeriodReportCopy } = await import('../../lib/chits/periodReportI18n');
  for (const l of ['en', 'ta', 'hi', 'te', 'kn', 'ml']) {
    const copy = getPeriodReportCopy(l);
    assert.ok(copy.statusLabels.paid && copy.statusLabels.upcoming && copy.statusLabels.security_pending, `Missing statusLabels for ${l}`);
    assert.ok(copy.roleLabels.winner && copy.roleLabels.non_prized && copy.roleLabels.previously_prized, `Missing roleLabels for ${l}`);
    assert.ok(copy.commissionBasisLabels.CHIT_VALUE && copy.commissionBasisLabels.BID_DISCOUNT, `Missing commissionBasisLabels for ${l}`);
    assert.ok(copy.securityTypeLabels.INTERNAL_GUARANTOR_JAMEEN && copy.securityDocLabels.guarantor_kyc, `Missing security labels for ${l}`);
    assert.ok(copy.chitTypeLabels.unregistered && copy.frequencyLabels.monthly, `Missing chitType/frequency labels for ${l}`);
    assert.ok(copy.commencedWord, `Missing commencedWord for ${l}`);
  }

  assert.equal(DEFAULT_CHIT_PDF_THEME.primary, '#27AE60');
  assert.equal(DEFAULT_CHIT_PDF_THEME.primaryDark, '#1E8449');
  assert.equal(DEFAULT_CHIT_PDF_THEME.primaryLight, '#EAFAF1');

  assert.equal(
    resolvePeriodMemberDisplayStatus({
      rawStatus: 'upcoming',
      paidAmount: 0,
      outstanding: 249_750,
      isFinalized: true,
      dueDate: '2027-05-27T00:00:00.000Z',
    }),
    'pending',
  );
  assert.equal(
    resolvePeriodMemberDisplayStatus({
      rawStatus: 'upcoming',
      paidAmount: 0,
      outstanding: 249_750,
      isFinalized: false,
      dueDate: '2028-05-27T00:00:00.000Z',
      now: new Date('2026-11-28T00:00:00.000Z'),
    }),
    'upcoming',
  );

  console.log('chit security types and period PDF report tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
