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
  static const String googleAuth = '/auth/google';
  static const String pricing = '/pricing';

  // Customers
  static const String customers = '/customers';
  static String customer(String id) => '/customers/$id';
  static String customerLoans(String id) => '/customers/$id/loans';

  // Loans
  static const String loans = '/loans';
  static String loan(String id) => '/loans/$id';
  static String loanInstalments(String id) => '/loans/$id/instalments';
  static const String newLoan = '/loans/new';

  // Collection
  static const String collectionToday = '/collection/today';
  static String collectionByDate(String date) => '/collection/$date';
  static const String collectionEntry = '/collection/entry';
  static const String collectionProofPhoto = '/collection/proof/photo';
  static const String collectionProofQr = '/collection/proof/qr';
  static String receipt(String entryId) => '/receipts/$entryId';

  // Penalties
  static const String penalties = '/penalties';
  static String penaltySettle(String id) => '/penalties/$id/settle';

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

  // Settings
  static const String settings = '/settings';
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
}
