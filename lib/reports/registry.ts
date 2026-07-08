import { ReportBuilderParams, ReportPayload } from './types';

// Loan
import { buildLoanRegister } from './builders/loan-register';
import { buildLoanStatusReport } from './builders/loan-status-report';
import { buildLoanTypeReport } from './builders/loan-type-report';
import { buildLoanMaturityReport } from './builders/loan-maturity-report';

// Collection
import { buildDailyCollection } from './builders/daily-collection';
import { buildDateWiseCollection } from './builders/date-wise-collection';
import { buildAgentWiseCollection } from './builders/agent-wise-collection';
import { buildAreaWiseCollection } from './builders/area-wise-collection';
import { buildCustomerCollectionHistory } from './builders/customer-collection-history';
import { buildCollectionModeReport } from './builders/collection-mode-report';
import { buildMissedCollectionReport } from './builders/missed-collection-report';
import { buildPartialPaymentReport } from './builders/partial-payment-report';
import { buildAdvancePaymentReport } from './builders/advance-payment-report';

// Overdue / risk
import { buildAging } from './builders/aging';
import { buildHighRiskCustomers } from './builders/high-risk-customers';
import { buildChronicDefaulters } from './builders/chronic-defaulters';

// EMI
import { buildEmiSchedule } from './builders/emi-schedule';
import { buildUpcomingEmiReport } from './builders/upcoming-emi-report';
import { buildTodaysEmiReport } from './builders/todays-emi-report';

// Customer
import { buildCustomerRegister } from './builders/customer-register';
import { buildCustomerLoanHistory } from './builders/customer-loan-history';
import { buildRepeatBorrowers } from './builders/repeat-borrowers';
import { buildInactiveCustomers } from './builders/inactive-customers';
import { buildTopBorrowers } from './builders/top-borrowers';

// Agent
import { buildAgentPerformance } from './builders/agent-performance';
import { buildAgentAttendance } from './builders/agent-attendance';
import { buildMissedVisitReport } from './builders/missed-visit-report';
import { buildCollectionEfficiency } from './builders/collection-efficiency';
import { buildCommissionReport } from './builders/commission-report';

// Financial
import { buildCashFlow } from './builders/cash-flow';
import { buildDisbursement } from './builders/disbursement';
import { buildInterestIncome } from './builders/interest-income';
import { buildPenaltyIncomeReport } from './builders/penalty-income-report';
import { buildOutstandingBalance } from './builders/outstanding-balance';
import { buildProfitReport } from './builders/profit-report';

// Branch
import { buildBranchPerformance } from './builders/branch-performance';
import { buildBranchComparison } from './builders/branch-comparison';

// GPS
import { buildGpsRoute } from './builders/gps-route';
import { buildTravelDistance } from './builders/travel-distance';
import { buildCustomerVisitHistory } from './builders/customer-visit-history';
import { buildMissedGpsCheckin } from './builders/missed-gps-checkin';

// Notification / Audit
import { buildNotificationReport } from './builders/notification-report';
import { buildAuditActivity } from './builders/audit-activity';
import { buildLoginHistoryReport } from './builders/login-history-report';

// Payment
import { buildPaymentByMode } from './builders/payment-by-mode';
import { buildFailedPayments } from './builders/failed-payments';
import { buildRefundReport } from './builders/refund-report';
import { buildDuplicatePayments } from './builders/duplicate-payments';
import { buildCancelledPayments } from './builders/cancelled-payments';

// Accounting tabular
import { buildDayBook } from './builders/day-book';
import { buildCashBook } from './builders/cash-book';
import { buildLedgerReport } from './builders/ledger-report';
import { buildBankBook } from './builders/bank-book';

// Module: gold
import { buildGoldPledgeRegister } from './builders/gold-pledge-register';
import { buildGoldMaturityAuction } from './builders/gold-maturity-auction';
import { buildGoldReleasedRedeemed } from './builders/gold-released-redeemed';
import { buildGoldBankRepledgeReport } from './builders/gold-bank-repledge-report';

// Module: property
import { buildPropertyCollateralRegister } from './builders/property-collateral-register';
import { buildPropertyMortgageStatus } from './builders/property-mortgage-status';

// Module: product finance
import { buildProductFinanceRegister } from './builders/product-finance-register';
import { buildProductRepossessionReport } from './builders/product-repossession-report';

// Module: chit funds
import { buildChitGroupReport } from './builders/chit-group-report';
import { buildChitAuctionReport } from './builders/chit-auction-report';
import { buildChitSubscriptionDue } from './builders/chit-subscription-due';
import {
  buildChitAgreementPendingReport,
  buildChitAuctionRegister,
  buildChitBidHistory,
  buildChitDefaultsReport,
  buildChitDividendRegister,
  buildChitForemanCommission,
  buildChitGroupLedger,
  buildChitPayoutReport,
  buildChitPrizedSubscribers,
  buildChitReceiptRegister,
  buildChitSecurityPendingReport,
  buildChitSubscriberLedger,
  buildVacantChitReport,
} from './builders/chit-production-reports';

// Module: wallet / NPA
import { buildWalletFloatLedger } from './builders/wallet-float-ledger';
import { buildNpaClassificationReport } from './builders/npa-classification-report';

export type ReportBuilder = (params: ReportBuilderParams) => Promise<ReportPayload>;

export const reportRegistry: Record<string, ReportBuilder> = {
  // Loan
  'loan-register': buildLoanRegister,
  'loan-status-report': buildLoanStatusReport,
  'loan-type-report': buildLoanTypeReport,
  'loan-maturity-report': buildLoanMaturityReport,

  // Collection
  'daily-collection': buildDailyCollection,
  'date-wise-collection': buildDateWiseCollection,
  'agent-wise-collection': buildAgentWiseCollection,
  'area-wise-collection': buildAreaWiseCollection,
  'customer-collection-history': buildCustomerCollectionHistory,
  'collection-mode-report': buildCollectionModeReport,
  'missed-collection-report': buildMissedCollectionReport,
  'partial-payment-report': buildPartialPaymentReport,
  'advance-payment-report': buildAdvancePaymentReport,

  // Overdue / risk
  'aging': buildAging,
  'high-risk-customers': buildHighRiskCustomers,
  'chronic-defaulters': buildChronicDefaulters,

  // EMI
  'emi-schedule': buildEmiSchedule,
  'upcoming-emi-report': buildUpcomingEmiReport,
  'todays-emi-report': buildTodaysEmiReport,

  // Customer
  'customer-register': buildCustomerRegister,
  'customer-loan-history': buildCustomerLoanHistory,
  'repeat-borrowers': buildRepeatBorrowers,
  'inactive-customers': buildInactiveCustomers,
  'top-borrowers': buildTopBorrowers,

  // Agent
  'agent-performance': buildAgentPerformance,
  'agent-attendance': buildAgentAttendance,
  'missed-visit-report': buildMissedVisitReport,
  'collection-efficiency': buildCollectionEfficiency,
  'commission-report': buildCommissionReport,

  // Financial
  'cash-flow': buildCashFlow,
  'disbursement': buildDisbursement,
  'interest-income': buildInterestIncome,
  'penalty-income-report': buildPenaltyIncomeReport,
  'outstanding-balance': buildOutstandingBalance,
  'profit-report': buildProfitReport,

  // Branch
  'branch-performance': buildBranchPerformance,
  'branch-comparison': buildBranchComparison,

  // GPS
  'gps-route': buildGpsRoute,
  'travel-distance': buildTravelDistance,
  'customer-visit-history': buildCustomerVisitHistory,
  'missed-gps-checkin': buildMissedGpsCheckin,

  // Notification / Audit
  'notification-report': buildNotificationReport,
  'audit-activity': buildAuditActivity,
  'login-history-report': buildLoginHistoryReport,

  // Payment
  'payment-by-mode': buildPaymentByMode,
  'failed-payments': buildFailedPayments,
  'refund-report': buildRefundReport,
  'duplicate-payments': buildDuplicatePayments,
  'cancelled-payments': buildCancelledPayments,

  // Accounting tabular
  'day-book': buildDayBook,
  'cash-book': buildCashBook,
  'ledger-report': buildLedgerReport,
  'bank-book': buildBankBook,

  // Module: gold
  'gold-pledge-register': buildGoldPledgeRegister,
  'gold-maturity-auction': buildGoldMaturityAuction,
  'gold-released-redeemed': buildGoldReleasedRedeemed,
  'gold-bank-repledge-report': buildGoldBankRepledgeReport,

  // Module: property
  'property-collateral-register': buildPropertyCollateralRegister,
  'property-mortgage-status': buildPropertyMortgageStatus,

  // Module: product finance
  'product-finance-register': buildProductFinanceRegister,
  'product-repossession-report': buildProductRepossessionReport,

  // Module: chit funds
  'chit-group-report': buildChitGroupReport,
  'chit-auction-report': buildChitAuctionReport,
  'chit-subscription-due': buildChitSubscriptionDue,
  'chit-group-ledger': buildChitGroupLedger,
  'chit-subscriber-ledger': buildChitSubscriberLedger,
  'chit-auction-register': buildChitAuctionRegister,
  'auction-bid-history': buildChitBidHistory,
  'chit-bid-history': buildChitBidHistory,
  'chit-prized-subscriber-report': buildChitPrizedSubscribers,
  'chit-prized-subscribers': buildChitPrizedSubscribers,
  'prized-subscriber-report': buildChitPrizedSubscribers,
  'chit-dividend-register': buildChitDividendRegister,
  'chit-foreman-commission-report': buildChitForemanCommission,
  'chit-foreman-commission': buildChitForemanCommission,
  'chit-default-report': buildChitDefaultsReport,
  'chit-defaults-report': buildChitDefaultsReport,
  'chit-payout-report': buildChitPayoutReport,
  'chit-security-pending-report': buildChitSecurityPendingReport,
  'chit-agreement-pending-report': buildChitAgreementPendingReport,
  'chit-receipt-register': buildChitReceiptRegister,
  'vacant-chit-report': buildVacantChitReport,

  // Module: wallet / NPA
  'wallet-float-ledger': buildWalletFloatLedger,
  'npa-classification-report': buildNpaClassificationReport,
};
