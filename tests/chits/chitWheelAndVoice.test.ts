import assert from 'node:assert/strict';
import {
  extractShortBidderName,
  formatBidSpokenPhrase,
  formatBidVoicePhrase,
  formatIndianNumberForSpeech,
  getRoomChatStrings,
  resolveRoomEffectiveVoiceLang,
} from '../../lib/chits/bidVoiceAnnouncer';
import {
  computeWheelTargetAngle,
  resolveFrozenSpinWinnerIndex,
} from '../../components/chits/FortuneWheelSpinner';
import { resolveNonAuctionPeriodInTx } from '../../lib/chits/groupService';

function testVoicePhraseFormatting() {
  assert.equal(extractShortBidderName('Oviya Kandasamy'), 'Oviya');
  assert.equal(extractShortBidderName('S. Rajesh'), 'Rajesh');
  assert.equal(extractShortBidderName('Yogeshwaran Thirumalai'), 'Yogeshwaran');

  assert.equal(formatIndianNumberForSpeech(48000), '48 thousand');
  assert.equal(formatIndianNumberForSpeech(4749700), '47 lakh 49 thousand 7 hundred');
  assert.equal(formatIndianNumberForSpeech(100000), '1 lakh');

  assert.equal(
    formatBidVoicePhrase({ prizeAmount: 48000, memberName: 'Oviya Kandasamy', ticketNo: '11', lang: 'en' }),
    '48,000 by Oviya',
  );
  assert.equal(
    formatBidSpokenPhrase({ prizeAmount: 48000, memberName: 'Oviya Kandasamy', ticketNo: '11', lang: 'en' }),
    '48 thousand by Oviya',
  );
  assert.equal(
    formatBidVoicePhrase({ prizeAmount: 50000, memberName: 'S. Rajesh', ticketNo: '4', lang: 'en' }),
    '50,000 by Rajesh',
  );
  assert.equal(
    formatBidSpokenPhrase({ prizeAmount: 4749700, memberName: 'Yogeshwaran Thirumalai', ticketNo: '19', lang: 'en' }),
    '47 lakh 49 thousand 7 hundred by Yogeshwaran',
  );
  assert.equal(formatIndianNumberForSpeech(48000, 'ml'), '48 ആയിരം');
  assert.equal(
    formatBidSpokenPhrase({ prizeAmount: 48000, memberName: 'Oviya Kandasamy', ticketNo: '11', lang: 'ml' }),
    '48 ആയിരം, Oviya',
  );
  assert.equal(
    formatBidSpokenPhrase({ prizeAmount: 100000, memberName: 'S. Rajesh', ticketNo: '4', lang: 'ta' }),
    '1 லட்சம், Rajesh',
  );
  assert.equal(
    formatBidSpokenPhrase({ prizeAmount: 50000, memberName: 'Oviya Kandasamy', ticketNo: '11', lang: 'hi' }),
    '50 हजार, Oviya द्वारा',
  );
  assert.equal(
    formatBidSpokenPhrase({ prizeAmount: 48000, memberName: 'Oviya Kandasamy', ticketNo: '11', lang: 'te' }),
    '48 వేలు, Oviya',
  );
  assert.equal(
    formatBidSpokenPhrase({ prizeAmount: 48000, memberName: 'Oviya Kandasamy', ticketNo: '11', lang: 'kn' }),
    '48 ಸಾವಿರ, Oviya',
  );

  // Foreman fixed language vs member-allowed override (never affected by main UI locale)
  assert.equal(
    resolveRoomEffectiveVoiceLang({
      roomLanguage: 'ml',
      allowMemberChange: false,
      customerOverride: 'ta',
    }),
    'ml',
  );
  assert.equal(
    resolveRoomEffectiveVoiceLang({
      roomLanguage: 'ml',
      allowMemberChange: true,
      customerOverride: 'ta',
    }),
    'ta',
  );
  assert.equal(
    resolveRoomEffectiveVoiceLang({
      roomLanguage: undefined,
      allowMemberChange: false,
      customerOverride: 'hi',
    }),
    'en',
  );

  assert.equal(getRoomChatStrings('ml').quickCalloutsAuction[0], 'ഒന്നാം വിളി!');
  assert.equal(getRoomChatStrings('ta').sendBtn, 'அனுப்பு');
}

function testWheelAngleMath() {
  for (const total of [2, 5, 10, 20]) {
    const slice = 360 / total;
    for (let idx = 0; idx < total; idx += 1) {
      for (const startRot of [0, 73, 412.5]) {
        const target = computeWheelTargetAngle(idx, total, startRot, 5);
        assert.ok(target >= startRot + 5 * 360, `Expected 5+ forward spins for slice ${idx}/${total}`);
        const sliceCenter = (idx + 0.5) * slice;
        const landedPosMod = (((sliceCenter + target) % 360) + 360) % 360;
        const distFromTop = Math.min(landedPosMod, 360 - landedPosMod);
        assert.ok(distFromTop < 1e-6, `Expected slice center at 12-o-clock pointer, got ${landedPosMod}`);
      }
    }
  }

  // Frozen candidate snapshot keeps exact drawn winner aligned even if live prop drops winner
  const frozen = resolveFrozenSpinWinnerIndex(
    [
      { memberId: 'm_5', ticketNo: '5', name: 'Hemalatha Vijay' },
      { memberId: 'm_6', ticketNo: '6', name: 'Ilango Perumal' },
      { memberId: 'm_8', ticketNo: '8', name: 'Kalaiselvi Mani' },
    ],
    { memberId: 'm_6', ticketNo: '6', name: 'Ilango Perumal' },
  );
  assert.equal(frozen.winnerIndex, 1);
  assert.equal(frozen.candidates[frozen.winnerIndex]?.memberId, 'm_6');

  const recovered = resolveFrozenSpinWinnerIndex(
    [
      { memberId: 'm_5', ticketNo: '5', name: 'Hemalatha Vijay' },
      { memberId: 'm_8', ticketNo: '8', name: 'Kalaiselvi Mani' },
    ],
    { memberId: 'm_6', ticketNo: '6', name: 'Ilango Perumal' },
  );
  assert.equal(recovered.candidates[recovered.winnerIndex]?.memberId, 'm_6');
  assert.equal(recovered.candidates[recovered.winnerIndex]?.ticketNo, '6');
}

async function testZeroBidFallbackDrawInTx() {
  const createdBids: Array<Record<string, unknown>> = [];
  const makeTx = (validBidCount: number) => {
    const baseGroup = {
      id: 'grp_zero_bid_test',
      tenantId: 'ten_1',
      branchId: 'br_1',
      name: '50L Chit Test',
      chitValue: 100000,
      monthlyContrib: 10000,
      totalMembers: 10,
      commissionPct: 5,
      gstPct: 0,
      commissionBasis: 'CHIT_VALUE',
      bidStartAtCommission: true,
      minDiscountPct: null,
      maxDiscountPct: 40,
      fixedDiscountPct: null,
      dividendPolicy: 'ALL_MEMBERS',
      dividendDistribution: 'ADJUST_NEXT_DUE',
      dividendRounding: 'NONE',
      winnerInterestType: 'NONE',
      winnerInterestValue: null,
      winnerInterestPeriods: null,
      auctionType: 'open_live',
      chitType: 'private',
      engineType: 'AUCTION_STANDARD',
      engineConfig: null,
      prizedMemberInstallment: null,
      penaltyRuleType: null,
      penaltyValue: null,
      foremanCommissionMode: 'PERCENTAGE_COMMISSION',
      foremanFixedAmount: null,
      foremanTicketNo: null,
      regulatoryTier: 'UNORGANIZED_INFORMAL',
      lateFeeType: 'NONE',
      lateFeeValue: null,
    };
    const members = [
      {
        id: 'mem_1',
        ticketNo: '1',
        fractionNo: null,
        memberNumber: 1,
        hasWon: false,
        subscriberStatus: 'active',
        isForemanTicket: false,
        ticketShare: 1,
        customer: { name: 'Oviya' },
      },
      {
        id: 'mem_2',
        ticketNo: '2',
        fractionNo: null,
        memberNumber: 2,
        hasWon: false,
        subscriberStatus: 'active',
        isForemanTicket: false,
        ticketShare: 1,
        customer: { name: 'Rajesh' },
      },
    ];
    return {
      chitBid: {
        count: async () => validBidCount,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const rec = { id: 'bid_synth_1', ...data };
          createdBids.push(rec);
          return rec;
        },
        update: async ({ data }: { data: Record<string, unknown> }) => data,
        updateMany: async () => ({ count: 0 }),
      },
      chitMember: {
        findMany: async () => members,
        update: async () => ({}),
      },
      chitAuction: {
        findMany: async () => [{ periodNumber: 1, status: 'completed', auctionDate: new Date('2026-11-27T10:00:00Z') }],
        findFirst: async () => null,
        update: async ({ data }: { data: Record<string, unknown> }) => data,
        updateMany: async () => ({ count: 1 }),
      },
      chitSubscription: {
        findMany: async () => [],
        update: async () => ({}),
        updateMany: async () => ({ count: 0 }),
      },
      chitSecurity: {
        create: async () => ({}),
      },
      chitInstallment: {
        findMany: async () => [],
        create: async () => ({}),
        update: async () => ({}),
      },
      chitAuctionEvent: { create: async () => ({}) },
      chitRoomMessage: { create: async () => ({}) },
      chitAuditLog: { create: async () => ({}) },
      auditLog: { create: async () => ({}) },
      cashLedger: { findFirst: async () => null, create: async () => ({}) },
      receiptSequence: { upsert: async () => ({ lastNo: 1 }) },
      chitDividendReceipt: { create: async () => ({ id: 'rcpt_1', receiptNo: 'CDR-1' }) },
      _group: baseGroup,
    };
  };

  type TxArg = Parameters<typeof resolveNonAuctionPeriodInTx>[0];

  // 1) When 0 valid bids exist on AUCTION_STANDARD, resolveNonAuctionPeriodInTx performs audited floor draw
  const txZero = makeTx(0);
  const res = await resolveNonAuctionPeriodInTx(txZero as unknown as TxArg, {
    scope: { tenantId: 'ten_1', appType: 'chitfunds', userId: 'usr_1' },
    auction: { id: 'auc_1', chitGroupId: 'grp_zero_bid_test', periodNumber: 1, status: 'completed', auctionDate: new Date('2026-11-27T10:00:00Z') },
    group: txZero._group,
    presentCount: 2,
  });
  assert.equal(createdBids.length, 1);
  assert.equal(createdBids[0].bidDiscount, 5000); // 5% starting commission discount on 100,000
  assert.equal(createdBids[0].bidAmount, 95000);
  assert.ok(['mem_1', 'mem_2'].includes(String(createdBids[0].memberId)));
  assert.equal(res.calc.bidDiscount, 5000);
  assert.equal(res.calc.prizeAmount, 95000);

  // 2) When valid bids DO exist on AUCTION_STANDARD, fallback draw must reject
  const txWithBids = makeTx(2);
  await assert.rejects(
    () =>
      resolveNonAuctionPeriodInTx(txWithBids as unknown as TxArg, {
        scope: { tenantId: 'ten_1', appType: 'chitfunds', userId: 'usr_1' },
        auction: { id: 'auc_1', chitGroupId: 'grp_zero_bid_test', periodNumber: 1, status: 'completed', auctionDate: new Date('2026-11-27T10:00:00Z') },
        group: txWithBids._group,
        presentCount: 2,
      }),
    /Valid bids exist/,
  );
}

async function runTests() {
  testVoicePhraseFormatting();
  testWheelAngleMath();
  await testZeroBidFallbackDrawInTx();
  console.log('chitWheelAndVoice tests passed!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
