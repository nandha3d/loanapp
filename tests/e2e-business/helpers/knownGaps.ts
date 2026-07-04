import type { KnownGapDetails } from './harness';

export const knownGapCatalog = {
  separateLoanApprovalBeforeDisbursement: {
    id: 'MM-GAP-001',
    currentBehavior: 'Admin-created loans activate immediately and debit branch cash during POST /api/v1/loans.',
    expectedBehavior: 'A branch-cash loan that requires approval should be created pending_review, leave branch cash unchanged, and disburse only when approval is accepted.',
    evidenceSource: 'app/api/v1/loans/route.ts sets bypassLoanApproval=true for non-agents and calls disburseFromBranch during create.',
    businessImpact: 'Approval and disbursement are coupled, so a loan can move real cash before an independent approval checkpoint is tested or enforced.',
    fixedAssertion: 'Creating the approval-required branch-cash loan returns pending_review and branch cash remains unchanged until /api/v1/approvals/[id]/approve.',
  },
  handoverApprovalDoesNotSettleWallet: {
    id: 'MM-GAP-002',
    currentBehavior: 'Approving a cash_handover request marks DailyCollection as settled but does not debit agent wallet or credit branch cash.',
    expectedBehavior: 'Approving handover should atomically reduce agent wallet/cash and increase branch cash/account balance by the handover amount.',
    evidenceSource: 'app/api/v1/approvals/[id]/approve/route.ts cash_handover branch only updates DailyCollection.status/lockedAt; lib/wallet.collectFromAgent has settlement logic but is not called there.',
    businessImpact: 'A settled handover can leave cash balances unreconciled, overstating agent-held cash and understating branch cash.',
    fixedAssertion: 'After approval, agent cash decreases by the handover amount, branch cash increases by the same amount, and wallet transactions exist for both sides.',
  },
  duplicateCollectionReplayDoubleCounts: {
    id: 'MM-GAP-003',
    currentBehavior: 'Replaying the same loan-level collection idempotency key can allocate to the next open instalment and create a second receipt/payment/wallet credit.',
    expectedBehavior: 'A duplicate replay should return the original result or a duplicate response without changing principal, interest, wallet, receipt, ledger, or instalment allocation totals.',
    evidenceSource: 'lib/collectionWrite.ts distributeCollectionAcrossLoan derives per-instalment keys as baseKey:instalmentId, so a replay after instalment #1 is paid can generate baseKey:instalment #2.',
    businessImpact: 'Repeated mobile/API submissions can overstate collections, agent cash, receipts, payment ledger, and loan paid count.',
    fixedAssertion: 'After submitting the same loan-level collection twice, collectionEntry/payment/paymentAllocation/wallet counts and loan.totalCollected remain unchanged from the first submission.',
  },
  dashboardBusinessDayMismatch: {
    id: 'MM-GAP-004',
    currentBehavior: 'Collection dashboard can return no dailyCollection while /api/v1/reports/daily and DB totals show the same business-day collection.',
    expectedBehavior: 'Dashboard, collection report, handover lookup, and DailyCollection DB rollup should resolve the same business date and totals.',
    evidenceSource: 'app/api/v1/collection/dashboard/route.ts uses startOfBusinessToday(), while app/api/v1/reports/daily/route.ts and collection/handover use Date.setHours(0,0,0,0).',
    businessImpact: 'Agents/admins can see inconsistent cash totals for the same business day, weakening handover and reconciliation confidence.',
    fixedAssertion: 'Dashboard totalCollected, /api/v1/reports/daily totalCollected, handover total, and DailyCollection.totalCollected all equal the same RUN_ID collection amount.',
  },
  genericReportExportNeedsWebSessionHarness: {
    id: 'REP-GAP-001',
    currentBehavior: '/api/v1/reports/[slug] and /api/v1/reports/[slug]/export require NextAuth web session context, while the business E2E harness currently authenticates via mobile bearer tokens.',
    expectedBehavior: 'The business E2E harness should be able to create a real web-session context or the routes should expose a supported API-auth path for export validation.',
    evidenceSource: 'app/api/v1/reports/[slug]/route.ts and app/api/v1/reports/[slug]/export/route.ts call requireApiContext from lib/apiAuth.ts, which uses auth(), getCurrentTenantId(), getUserAppType(), and getActiveBranchId().',
    businessImpact: 'Generic report/export route downloads cannot be exercised end-to-end in this API-only harness, so Phase 4 validates builders/serializers and keeps route-download coverage visible as a gap.',
    fixedAssertion: 'A Phase 4 test can call the generic report/export route handlers directly and receive CSV, XLSX, and PDF download responses for RUN_ID data.',
  },
  passwordResetExpiryUsesStatelessOtp: {
    id: 'SEC-GAP-001',
    currentBehavior: 'Password reset uses stateless HMAC OTP buckets and does not expose a persisted token object that can be aged directly by the E2E harness.',
    expectedBehavior: 'A reset-token expiry test should be able to create or inspect a reset token and prove it expires after the configured TTL.',
    evidenceSource: 'app/api/v1/auth/reset-password/route.ts validates current and previous 10-minute HMAC buckets with generateOtp/isValidOtp local functions.',
    businessImpact: 'The API rejects invalid/expired-looking codes, but token lifecycle observability is limited for deterministic end-to-end expiry automation.',
    fixedAssertion: 'A generated reset token older than the TTL is rejected, a fresh token is accepted, and both outcomes are observable without relying on hidden local functions.',
  },
} satisfies Record<string, KnownGapDetails>;
