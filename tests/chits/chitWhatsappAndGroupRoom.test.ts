import assert from 'node:assert/strict';
import { createElement } from 'react';
import { deflateRawSync } from 'node:zlib';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDictionarySync } from '../../lib/i18n';
import { calculateChitPeriodEngine } from '../../lib/chits/engineCalculator';
import { parseChitEngineConfig } from '../../lib/chits/engineTypes';
import {
  formatCashDenominationsSummary,
  normalizeCashDenominations,
  sumCashDenominations,
} from '../../lib/chits/denominations';
import { canMemberPostInRoom, normalizeRoomChatMode } from '../../lib/chits/groupRoom';
import {
  buildChitJoinUrl,
  buildWhatsAppShareUrl,
  createChitInviteToken,
  verifyChitInviteToken,
} from '../../lib/chits/inviteToken';
import { buildTemplateStatementCopy, type ChitPeriodReportData } from '../../lib/chits/periodReport';
import { getPeriodReportCopy } from '../../lib/chits/periodReportI18n';
import { ChitPeriodReportPDF } from '../../lib/chits/periodReportPdf';
import {
  extractWhatsAppTxtFromUpload,
  normalizeWhatsAppPhone,
  parseChitRosterText,
  parseWhatsAppChatExport,
} from '../../lib/chits/whatsappImport';
import { CollectionReportPDF, TableReportPDF } from '../../lib/reports/pdf';
import { ensurePdfFonts, PDF_LANGUAGES, resolvePdfLang } from '../../lib/reports/pdfFonts';

function buildMinimalZip(filename: string, contentUtf8: string, compress: boolean): Buffer {
  const nameBuf = Buffer.from(filename, 'utf8');
  const raw = Buffer.from(contentUtf8, 'utf8');
  const payload = compress ? deflateRawSync(raw) : raw;
  const method = compress ? 8 : 0;

  const localHeader = Buffer.alloc(30 + nameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(method, 8);
  localHeader.writeUInt32LE(payload.length, 18);
  localHeader.writeUInt32LE(raw.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuf.copy(localHeader, 30);

  return Buffer.concat([localHeader, payload]);
}

async function main() {
  // 1. Phone normalization
  assert.equal(normalizeWhatsAppPhone('+91 98765-43210'), '9876543210');
  assert.equal(normalizeWhatsAppPhone('09123456789'), '9123456789');
  assert.equal(normalizeWhatsAppPhone('12345'), null);

  // 2. WhatsApp iOS + Android chat export parser & ZIP extraction
  const chatSample = [
    '[01/11/2026, 7:00:00 PM] Admin Foreman: created group "Lakshmi Priya 1L Chit"',
    '[01/11/2026, 7:02:00 PM] +91 98765 43210: Chit 100000 monthly installment 10000',
    '02/11/2026, 8:10 pm - +91 98765 43211: Paid 9050 via GPay for Period 1',
    '05/11/2026, 9:00 pm - Admin Foreman: Period 2 Winner: Rajesh Kumar 90000 discount 10000',
  ].join('\n');

  const storedZip = buildMinimalZip('_chat.txt', chatSample, false);
  const deflatedZip = buildMinimalZip('_chat.txt', chatSample, true);
  assert.equal(extractWhatsAppTxtFromUpload(Buffer.from(chatSample, 'utf8')).includes('Lakshmi Priya'), true);
  assert.equal(extractWhatsAppTxtFromUpload(storedZip).includes('Lakshmi Priya'), true);
  assert.equal(extractWhatsAppTxtFromUpload(deflatedZip).includes('Lakshmi Priya'), true);

  const preview = parseWhatsAppChatExport(chatSample);
  assert.equal(preview.sourceFormat, 'whatsapp_chat');
  assert.equal(preview.suggestedGroupName, 'Lakshmi Priya 1L Chit');
  assert.equal(preview.suggestedChitValue, 100000);
  assert.equal(preview.suggestedMonthlyContrib, 10000);
  assert.equal(preview.members.length >= 2, true);
  const gpayMember = preview.members.find((m) => m.phone === '9876543211');
  assert.ok(gpayMember);
  assert.equal(gpayMember.paymentMentions, 1);
  assert.equal(gpayMember.lastAmountHint, 9050);
  assert.equal(preview.periodHints.some((h) => h.periodNumber === 2), true);

  // 3. Roster text / CSV parser with deduplication
  const roster = parseChitRosterText([
    'Name,Phone',
    '1. Karthik Subramanian, +91 98400 11111',
    '2. Deepa Natarajan | 9840022222',
    'Deepa Natarajan, 9840022222', // duplicate phone should dedupe
  ].join('\n'));
  assert.equal(roster.sourceFormat, 'roster');
  assert.equal(roster.members.length, 2);
  assert.equal(roster.members[0]?.phone, '9840011111');
  assert.equal(roster.members[1]?.name, 'Deepa Natarajan');

  // 4. Signed HMAC-SHA256 WhatsApp Group Invite tokens
  const secret = 'unit-test-invite-secret-32-characters-ok';
  const token = createChitInviteToken(
    { tenantId: 'ten-1', groupId: 'grp-1', groupCode: 'CF00001', ttlDays: 7 },
    secret,
  );
  const verified = verifyChitInviteToken(token, 'CF00001', secret);
  assert.ok(verified);
  assert.equal(verified.tenantId, 'ten-1');
  assert.equal(verified.groupId, 'grp-1');
  assert.equal(verifyChitInviteToken(token, 'CF99999', secret), null);
  assert.equal(verifyChitInviteToken(`${token}tamper`, 'CF00001', secret), null);

  const joinUrl = buildChitJoinUrl({ origin: 'https://app.zolofund.com/', groupCode: 'CF00001', token });
  assert.equal(joinUrl.startsWith('https://app.zolofund.com/join/CF00001?invite='), true);
  const waUrl = buildWhatsAppShareUrl({
    groupName: 'Priya 1L',
    chitValue: 100_000,
    monthlyContrib: 10_000,
    totalMembers: 10,
    joinUrl,
  });
  assert.equal(waUrl.startsWith('https://wa.me/?text='), true);

  // 5. Persistent Room Mode & Member Post Gate
  assert.equal(normalizeRoomChatMode(undefined), 'open');
  assert.equal(normalizeRoomChatMode('announcements_only'), 'announcements_only');
  assert.equal(canMemberPostInRoom('open'), true);
  assert.equal(canMemberPostInRoom('auction_live'), true);
  assert.equal(canMemberPostInRoom('announcements_only'), false);

  // 6. Cash Denomination normalization, sum & summary
  const norm = normalizeCashDenominations('{"500":100,"200":150,"100":100,"50":0,"10":0}');
  assert.deepEqual(norm, { 500: 100, 200: 150, 100: 100 });
  assert.equal(sumCashDenominations(norm), 90_000);
  assert.equal(formatCashDenominationsSummary(norm, '₹'), '₹500x100, ₹200x150, ₹100x100');
  assert.equal(normalizeCashDenominations('bad-json'), null);

  // 7. All 6 languages PDF font initialization + Period/Collection/Table PDF generation
  assert.equal(ensurePdfFonts(), true, 'Static Noto Sans PDF fonts must exist under public/fonts/pdf');
  assert.equal(PDF_LANGUAGES.length, 6);

  const members = Array.from({ length: 10 }, (_, idx) => ({
    memberId: `m-${idx + 1}`,
    memberName: idx === 0 ? 'மணிகண்டன் மோகன்' : `Member ${idx + 1}`,
    ticketNo: String(idx + 1),
    fractionNo: 1,
    ticketShare: 1,
    hasWonBeforePeriod: false,
    isActive: true,
  }));
  const cfg = parseChitEngineConfig({}, 'AUCTION_STANDARD');
  const bd = calculateChitPeriodEngine({
    engineType: 'AUCTION_STANDARD',
    config: cfg,
    chitValue: 100_000,
    monthlyContrib: 10_000,
    totalMembers: 10,
    periodNumber: 2,
    commissionPct: 5,
    commissionBasis: 'BID_DISCOUNT',
    gstPct: 0,
    dividendPolicy: 'ALL_MEMBERS',
    dividendDistribution: 'ADJUST_NEXT_DUE',
    winnerMemberIds: ['m-9'],
    prizeAmount: 90_000,
    members,
  });
  const stmtCopy = buildTemplateStatementCopy({
    engineType: 'AUCTION_STANDARD',
    chitValue: 100_000,
    bidDiscount: bd.bidDiscount,
    discountPct: 10,
    grossPrize: bd.prizeAmount,
    prizePayoutTotal: bd.prizeAmount,
    winnerCount: 1,
    commission: bd.commission,
    commissionPct: 5,
    commissionBasis: 'BID_DISCOUNT',
    foremanMode: bd.foremanCompensationMode,
    distributableDividend: bd.distributableDividend,
    eligibleTickets: bd.dividendEligibleTickets,
    grossDiscountSharePerTicket: 1_000,
    foremanFeePerTicket: 50,
    dividendPerTicket: bd.dividendPerTicket,
    baseInstallment: 10_000,
    prizedMemberInstallment: 9_050,
    netMemberInstallment: 9_050,
    totalMembers: 10,
    gstAmount: 0,
    dividendPolicy: 'ALL_MEMBERS',
    dividendDistribution: 'ADJUST_NEXT_DUE',
    hybridPhase: null,
    reserveFloorAmount: null,
    breakdown: bd,
    sym: '₹',
  });

  for (const langSpec of PDF_LANGUAGES) {
    const lang = resolvePdfLang(langSpec.code);
    const copy = getPeriodReportCopy(lang);
    assert.ok(copy.totalChitValue.length > 0);
    assert.ok(copy.cashNoteCount.length > 0);

    const periodData: ChitPeriodReportData = {
      lang,
      tenantName: 'ZoloFund Chits · மணிகண்டன்',
      branchName: 'Head Office',
      currencySymbol: '₹',
      generatedAt: '2026-11-25T10:00:00.000Z',
      templateSectionTitle: stmtCopy.sectionTitle,
      group: {
        id: 'grp-1',
        groupCode: 'CF00001',
        name: 'Standard Commercial Auction Chit',
        chitValue: 100_000,
        monthlyContrib: 10_000,
        totalMembers: 10,
        frequency: 'monthly',
        auctionType: 'open_live',
        chitType: 'unregistered',
        engineType: 'AUCTION_STANDARD',
        engineCategory: 'Auction-Based',
        engineLabel: 'Standard Auction Dividend Chit',
        payoutAssetType: 'CASH',
        commissionPct: 5,
        commissionBasis: 'BID_DISCOUNT',
        gstPct: 0,
        dividendPolicy: 'ALL_MEMBERS',
        dividendDistribution: 'ADJUST_NEXT_DUE',
      },
      auction: {
        id: 'auc-2',
        periodNumber: 2,
        auctionDate: '2026-12-25T10:00:00.000Z',
        scheduledAt: null,
        status: 'paid',
        payoutStatus: 'paid',
        isFinalized: true,
        winnerName: 'மணிகண்டன் மோகன்',
        winnerTicketNo: '9',
        winnerPhone: '9876543210',
        presentCount: 9,
        absentCount: 1,
        proxyCount: 0,
        reserveFloorAmount: null,
        goldRatePerGram: null,
        minutesText: 'Auction confirmed & paid with note breakdown.',
      },
      statement: {
        chitValue: 100_000,
        bidDiscount: 10_000,
        discountPct: 10,
        grossPrize: 90_000,
        prizePayoutTotal: 90_000,
        winnerCount: 1,
        foremanCompensationMode: 'PERCENTAGE_COMMISSION',
        hybridPhase: null,
        reserveFloorAmount: null,
        reserveFloorPct: null,
        commission: 500,
        gstAmount: 0,
        roundingIncome: 0,
        forfeitedDividendTotal: 0,
        distributableDividend: 9_500,
        deferredDividendTotal: 0,
        eligibleTickets: 10,
        grossDiscountSharePerTicket: 1_000,
        foremanFeePerTicket: 50,
        dividendPerTicket: 950,
        baseInstallment: 10_000,
        netMemberInstallment: 9_050,
        prizedMemberInstallment: 9_050,
        winnerInterestAdded: 0,
        winnerPeriodInstallmentDue: 10_000,
        winnerPeriodInstallmentPaid: 0,
        winnerPeriodInstallmentUnpaid: 10_000,
        netPayableAfterWinnerInstallment: 80_000,
        otherMembersCount: 9,
        otherMembersExpectedCollection: 81_450,
        netFundsAvailableForWinner: 80_950,
        verificationFormulaLine: stmtCopy.verificationFormulaLine,
        row2Title: stmtCopy.row2Title,
        row2Note: stmtCopy.row2Note,
        row3Title: stmtCopy.row3Title,
        row4Title: stmtCopy.row4Title,
        row4Note: stmtCopy.row4Note,
        row5Title: stmtCopy.row5Title,
      },
      basePlusPremium: null,
      gold: null,
      commodity: null,
      asca: null,
      collections: {
        totalExpected: 91_450,
        totalCollected: 91_450,
        totalOutstanding: 0,
        paidCount: 10,
        partialCount: 0,
        unpaidCount: 0,
        byMode: [{ mode: 'cash', label: 'Cash', count: 10, amount: 91_450 }],
      },
      payouts: {
        rows: [
          {
            slNo: 1,
            description: 'Cash Prize Payout',
            modeOrRef: 'Cash · CHIT-PO-001 · ₹500x100, ₹200x150, ₹100x100',
            amount: 90_000,
          },
        ],
        totalDisbursedToWinner: 90_000,
        remainingPayoutBalance: 0,
        dividendReceiptNo: null,
      },
      denominations: [
        { denomination: 500, count: 100, amount: 50_000 },
        { denomination: 200, count: 150, amount: 30_000 },
        { denomination: 100, count: 100, amount: 10_000 },
      ],
      denominationCashTotal: 90_000,
      security: {
        typeCode: 'INTERNAL_GUARANTOR_JAMEEN',
        typeLabel: 'Internal Guarantor (Jameen)',
        status: 'approved',
        value: null,
        guarantorLabel: '#1 Member 1',
        guarantorPhone: '9876543211',
        details: 'Verified Jameen',
        documents: [{ label: 'Guarantor Photo', fileName: 'photo.jpg', status: 'approved' }],
      },
      multiDivisionWinners: [],
      bids: [
        {
          ticketNo: '9',
          memberName: 'மணிகண்டன் மோகன்',
          prizeAmount: 90_000,
          bidDiscount: 10_000,
          bidTime: '2026-12-25T09:00:00.000Z',
          source: 'tap',
          status: 'winning',
        },
      ],
      memberRows: members.map((m) => ({
        ticketNo: m.ticketNo,
        memberName: m.memberName,
        ticketShare: 1,
        role: m.memberId === 'm-9' ? 'winner' : 'non_prized',
        baseDue: 10_000,
        dividendEarned: 950,
        deferredDividend: 0,
        extras: 0,
        netDue: 9_050,
        paidAmount: 9_050,
        outstanding: 0,
        goldGramsCredited: 0,
        receiptNo: `REC-${m.ticketNo}`,
        paymentMode: 'Cash',
        status: 'paid',
      })),
      formulaLines: ['Gross Prize: 90,000', 'Commission: 500'],
    };

    const dict = getDictionarySync(lang);
    const periodBuf = await renderToBuffer(createElement(ChitPeriodReportPDF, { data: periodData, lang }) as any);
    assert.equal(periodBuf.subarray(0, 5).toString('utf8'), '%PDF-', `ChitPeriodReportPDF failed for ${lang}`);
    assert.ok(periodBuf.byteLength > 3_000, `Period PDF too small for ${lang}`);

    const collBuf = await renderToBuffer(
      createElement(CollectionReportPDF, {
        data: {
          from: '2026-11-01',
          to: '2026-11-25',
          appName: 'ZoloFund',
          branchName: 'Head Office',
          collectionEfficiency: { expected: 100_000, collected: 92_000, efficiency: 92 },
          agentPerformance: [
            { name: 'Agent 1', route: 'Route A', customers: 10, expected: 100_000, collected: 92_000, hitRate: 92 },
          ],
          penaltyReport: { accrued: 500, settled: 300, waived: 50 },
          disbursement: { count: 2, totalPrincipal: 180_000 },
          agingBuckets: {
            short: { count: 1, penalty: 100 },
            medium: { count: 0, penalty: 0 },
            long: { count: 0, penalty: 0 },
          },
          currencySymbol: '₹',
        },
        dict,
        lang,
      }) as any,
    );
    assert.equal(collBuf.subarray(0, 5).toString('utf8'), '%PDF-', `CollectionReportPDF failed for ${lang}`);

    const tableBuf = await renderToBuffer(
      createElement(TableReportPDF, {
        payload: {
          title: 'reports.chitCashFlow.title',
          columns: [
            { key: 'date', label: 'reports.col.date', type: 'date' },
            { key: 'amount', label: 'reports.col.amount', type: 'currency', total: true, align: 'right' },
          ],
          rows: [{ date: '2026-11-25', amount: 90_000 }],
          totals: { amount: 90_000 },
          kpis: [{ label: 'reports.kpi.totalCollected', value: '₹90,000' }],
          meta: {
            from: '2026-11-01',
            to: '2026-11-25',
            branchName: 'Head Office',
            appName: 'ZoloFund',
            currencySymbol: '₹',
          },
        },
        dict,
        lang,
      }) as any,
    );
    assert.equal(tableBuf.subarray(0, 5).toString('utf8'), '%PDF-', `TableReportPDF failed for ${lang}`);
  }

  console.log('WhatsApp import, group room, cash denominations, and 6-language PDF tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
