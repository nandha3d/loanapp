/// API endpoints — verbatim from spec §2.4.
/// All paths are appended to the base URL `<host>/api/v1`.
/// DO NOT add endpoints not in this list. See AGENTS.md.
class Endpoints {
  Endpoints._();

  // Dashboard
  static const String dashboard = '/dashboard';

  // Upload
  static const String upload = '/upload';

  // Auth
  static const String login = '/auth/login';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String verify2fa = '/auth/2fa';
  static const String register = '/auth/register';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String refreshToken = '/auth/refresh';
  static const String googleAuth = '/auth/google';
  static const String pricing = '/pricing';
  static const String profile = '/profile';
  static const String profilePasswordOtp = '/profile/password/otp';
  static const String profilePasswordChange = '/profile/password/change';
  // Generic self-service account (non-superadmin roles) — separate from the
  // superadmin-only /profile endpoints above.
  static const String account = '/account';
  static const String accountPasswordOtp = '/account/password/otp';
  static const String accountPasswordChange = '/account/password/change';

  // Customers
  static const String customers = '/customers';
  static String customer(String id) => '/customers/$id';
  static String customerLoans(String id) => '/customers/$id/loans';

  // Loans
  static const String loans = '/loans';
  static String loan(String id) => '/loans/$id';
  static String loanInstalments(String id) => '/loans/$id/instalments';
  static const String newLoan = '/loans/new';

  // Gold pledge module
  static const String goldMaster = '/gold/master';
  static const String goldConfig = '/gold/config';
  static const String goldRate = '/gold/rate';
  static const String goldReports = '/gold/reports';
  static String goldServicing(String loanId) => '/gold/loans/$loanId/servicing';

  // Collection
  static const String collectionToday = '/collection/today';
  static String collectionByDate(String date) => '/collection/$date';
  static const String collectionEntry = '/collection/entry';
  static const String collectionProofPhoto = '/collection/proof/photo';
  static const String collectionProofQr = '/collection/proof/qr';
  static String customerCollectionReceipt(String customerId) =>
      '/customers/$customerId/collection-receipt';

  // mCollect — route batch collection runs
  static const String runOpen = '/collection/run/open';
  static String runSheet(String id) => '/collection/run/$id/sheet';
  static String runCollect(String id) => '/collection/run/$id/collect';
  static String runClose(String id) => '/collection/run/$id/close';
  static String runReconcile(String id) => '/collection/run/$id/reconcile';
  // mCollect — digital self-pay
  static const String selfPayQueue = '/collection/self-pay';
  static const String selfPayLink = '/collection/self-pay/link';
  // Per-tenant payment gateway config
  static const String paymentGateway = '/settings/payment-gateway';
  static String receipt(String entryId) => '/receipts/$entryId';
  static String agentCollections(String agentId) =>
      '/gps/agent/$agentId/collections';

  // Wallet (agent cash float)
  static const String walletMe = '/wallet/me';
  static const String walletAgents = '/wallet/agents';
  static const String walletRelease = '/wallet/release';
  static const String walletBranch = '/wallet/branch';
  static const String walletDeposit = '/wallet/deposit';

  // Penalties
  static const String penalties = '/penalties';
  static String penaltySettle(String id) => '/penalties/$id/settle';
  static String penaltyWaive(String id) => '/penalties/$id/waive';

  // Approvals
  static const String approvals = '/approvals';
  static String approvalApprove(String id) => '/approvals/$id/approve';
  static String approvalReject(String id) => '/approvals/$id/reject';

  // Analytics
  static const String analyticsSummary = '/analytics/summary';
  static const String analyticsCollections = '/analytics/collections';
  static const String analyticsAgents = '/analytics/agents';

  // Chits
  static const String chits = '/chits';
  static String chit(String id) => '/chits/$id';
  static String chitMembers(String id) => '/chits/$id/members';
  static String chitAuctions(String id) => '/chits/$id/auctions';
  static String chitPayments(String id) => '/chits/$id/payments';

  // Settings
  static const String settings = '/settings';
  static const String integrations = '/settings/integrations';
  // Tenant colour theme (readable by every role, unlike /settings)
  static const String theme = '/theme';
  static const String routes = '/routes';
  static const String packages = '/packages';
  static const String agents = '/agents';

  // Reports
  static const String reportsDaily = '/reports/daily';
  static const String reportsAgent = '/reports/agent';
  static const String reportsOverdue = '/reports/overdue';

  // Payment
  static const String paymentQr = '/payment/qr';

  // Notifications
  static const String notifications = '/notifications';

  // Vehicles
  static const String vehicles = '/vehicles';
  static String vehicle(String id) => '/vehicles/$id';

  // Accounting
  static const String accountingSummary = '/accounting';
  static const String accountingStatements = '/accounting/statements';

  // KYC review
  static const String kycQueue = '/kyc/queue';
  static String kycReview(String customerId) => '/kyc/$customerId/review';

  // Admin & Developer
  static const String adminUsers = '/admin/users';
  static String adminUser(String id) => '/admin/users/$id';
  static const String adminBranches = '/admin/branches';
  static String adminBranch(String id) => '/admin/branches/$id';
  static const String adminBilling = '/admin/billing';
  static const String adminAffiliates = '/admin/affiliates';
  static const String adminRequests = '/admin/requests';

  // Premium Accounting
  static const String accountingCoa = '/accounting/coa';
  static const String accountingJournal = '/accounting/journal';
  static String accountingJournalDetail(String id) => '/accounting/journal/$id';
  static const String accountingPnl = '/accounting/pnl';
  static const String accountingBalanceSheet = '/accounting/balance-sheet';
  static const String accountingTrialBalance = '/accounting/trial-balance';
  static const String accountingBankRec = '/accounting/bank-rec';
  static const String accountingPeriods = '/accounting/periods';
  static const String accountingCashflow = '/accounting/cashflow';
  static const String accountingApprovals = '/accounting/approvals';
  static const String accountingBudget = '/accounting/budget';
  static const String accountingTax = '/accounting/tax';
  static const String accountingVendors = '/accounting/vendors';
  static const String accountingExport = '/accounting/export';
  static const String accountingSettings = '/accounting/settings';

  // NPA
  static const String npaSummary = '/npa/summary';
  static const String npaLoans = '/npa/loans';
  static const String npaHistory = '/npa/history';
  static const String npaUpgrade = '/npa/upgrade';

  // NACH (e-mandate auto-debit)
  static String nachLoan(String loanId) => '/nach/loan/$loanId';
  static const String nachMandate = '/nach/mandate';
  static String nachMandateCancel(String id) => '/nach/mandate/$id';

  // Full analytics (consolidated endpoint for mobile)
  static const String analyticsFull = '/analytics/full';

  // Chit CRUD extensions
  static String chitCancel(String id) => '/chits/$id/cancel';
  static String chitSubscriptions(String id) => '/chits/$id/subscriptions';
  static String chitSubscriptionMiss(String subId) =>
      '/chits/subscriptions/$subId/miss';

  // Dashboard extended fields
  static const String dashboardVerifyUpi = '/collection/verify';
  static const String dashboardCollectCash = '/collection/verify';

  // Borrower portal
  static const String borrowerLogin = '/borrower/auth/login';
  static const String borrowerVerify = '/borrower/auth/verify';
  static const String borrowerLoans = '/borrower/loans';
  static const String borrowerPay = '/borrower/pay';
  static const String borrowerLogout = '/borrower/auth/logout';
}
