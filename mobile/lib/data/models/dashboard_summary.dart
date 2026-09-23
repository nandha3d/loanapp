/// Metrics per status bucket (expected/collected/remaining/loanCount/customerCount/pct).
class StatusSubMetrics {
  const StatusSubMetrics({
    this.expected = 0,
    this.collected = 0,
    this.remaining = 0,
    this.loanCount = 0,
    this.customerCount = 0,
    this.pct = 0,
  });
  final double expected;
  final double collected;
  final double remaining;
  final int loanCount;
  final int customerCount;
  final double pct;

  factory StatusSubMetrics.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return StatusSubMetrics(
      expected: n(json['expected']),
      collected: n(json['collected']),
      remaining: n(json['remaining']),
      loanCount: (json['loanCount'] as num?)?.toInt() ?? 0,
      customerCount: (json['customerCount'] as num?)?.toInt() ?? 0,
      pct: n(json['pct']),
    );
  }
}

/// Per-frequency (daily/weekly/monthly) breakdown for today's collection.
class TodayFrequencyMetrics {
  const TodayFrequencyMetrics({
    this.total = const StatusSubMetrics(),
    this.active = const StatusSubMetrics(),
    this.inactive = const StatusSubMetrics(),
  });
  final StatusSubMetrics total;
  final StatusSubMetrics active;
  final StatusSubMetrics inactive;

  factory TodayFrequencyMetrics.fromJson(Map<String, dynamic> json) {
    return TodayFrequencyMetrics(
      total: json['total'] != null ? StatusSubMetrics.fromJson(json['total'] as Map<String, dynamic>) : const StatusSubMetrics(),
      active: json['active'] != null ? StatusSubMetrics.fromJson(json['active'] as Map<String, dynamic>) : const StatusSubMetrics(),
      inactive: json['inactive'] != null ? StatusSubMetrics.fromJson(json['inactive'] as Map<String, dynamic>) : const StatusSubMetrics(),
    );
  }
}

/// Full today's collection breakdown: status summary + frequency sub-breakdown.
class TodayCollectionBreakdown {
  const TodayCollectionBreakdown({
    this.total = const StatusSubMetrics(),
    this.active = const StatusSubMetrics(),
    this.inactive = const StatusSubMetrics(),
    this.breakdown = const {},
  });
  final StatusSubMetrics total;
  final StatusSubMetrics active;
  final StatusSubMetrics inactive;
  final Map<String, TodayFrequencyMetrics> breakdown;

  factory TodayCollectionBreakdown.fromJson(Map<String, dynamic> json) {
    final bd = json['breakdown'] as Map<String, dynamic>? ?? const {};
    return TodayCollectionBreakdown(
      total: json['total'] != null ? StatusSubMetrics.fromJson(json['total'] as Map<String, dynamic>) : const StatusSubMetrics(),
      active: json['active'] != null ? StatusSubMetrics.fromJson(json['active'] as Map<String, dynamic>) : const StatusSubMetrics(),
      inactive: json['inactive'] != null ? StatusSubMetrics.fromJson(json['inactive'] as Map<String, dynamic>) : const StatusSubMetrics(),
      breakdown: bd.map((k, dynamic v) => MapEntry(k, TodayFrequencyMetrics.fromJson(v as Map<String, dynamic>))),
    );
  }
}

/// Overdue status sub-metrics (totalOverdue/collectedToday/remaining).
class OverdueStatusSubMetrics {
  const OverdueStatusSubMetrics({
    this.totalOverdue = 0,
    this.collectedToday = 0,
    this.remaining = 0,
    this.loanCount = 0,
    this.customerCount = 0,
    this.pct = 0,
  });
  final double totalOverdue;
  final double collectedToday;
  final double remaining;
  final int loanCount;
  final int customerCount;
  final double pct;

  factory OverdueStatusSubMetrics.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return OverdueStatusSubMetrics(
      totalOverdue: n(json['totalOverdue']),
      collectedToday: n(json['collectedToday']),
      remaining: n(json['remaining']),
      loanCount: (json['loanCount'] as num?)?.toInt() ?? 0,
      customerCount: (json['customerCount'] as num?)?.toInt() ?? 0,
      pct: n(json['pct']),
    );
  }
}

/// Per-frequency breakdown for overdue collection.
class OverdueFrequencyMetrics {
  const OverdueFrequencyMetrics({
    this.total = const OverdueStatusSubMetrics(),
    this.active = const OverdueStatusSubMetrics(),
    this.inactive = const OverdueStatusSubMetrics(),
  });
  final OverdueStatusSubMetrics total;
  final OverdueStatusSubMetrics active;
  final OverdueStatusSubMetrics inactive;

  factory OverdueFrequencyMetrics.fromJson(Map<String, dynamic> json) {
    return OverdueFrequencyMetrics(
      total: json['total'] != null ? OverdueStatusSubMetrics.fromJson(json['total'] as Map<String, dynamic>) : const OverdueStatusSubMetrics(),
      active: json['active'] != null ? OverdueStatusSubMetrics.fromJson(json['active'] as Map<String, dynamic>) : const OverdueStatusSubMetrics(),
      inactive: json['inactive'] != null ? OverdueStatusSubMetrics.fromJson(json['inactive'] as Map<String, dynamic>) : const OverdueStatusSubMetrics(),
    );
  }
}

/// Full overdue collection breakdown.
class OverdueCollectionBreakdown {
  const OverdueCollectionBreakdown({
    this.total = const OverdueStatusSubMetrics(),
    this.active = const OverdueStatusSubMetrics(),
    this.inactive = const OverdueStatusSubMetrics(),
    this.breakdown = const {},
  });
  final OverdueStatusSubMetrics total;
  final OverdueStatusSubMetrics active;
  final OverdueStatusSubMetrics inactive;
  final Map<String, OverdueFrequencyMetrics> breakdown;

  factory OverdueCollectionBreakdown.fromJson(Map<String, dynamic> json) {
    final bd = json['breakdown'] as Map<String, dynamic>? ?? const {};
    return OverdueCollectionBreakdown(
      total: json['total'] != null ? OverdueStatusSubMetrics.fromJson(json['total'] as Map<String, dynamic>) : const OverdueStatusSubMetrics(),
      active: json['active'] != null ? OverdueStatusSubMetrics.fromJson(json['active'] as Map<String, dynamic>) : const OverdueStatusSubMetrics(),
      inactive: json['inactive'] != null ? OverdueStatusSubMetrics.fromJson(json['inactive'] as Map<String, dynamic>) : const OverdueStatusSubMetrics(),
      breakdown: bd.map((k, dynamic v) => MapEntry(k, OverdueFrequencyMetrics.fromJson(v as Map<String, dynamic>))),
    );
  }
}

class DashboardSummary {
  const DashboardSummary({
    required this.activeLoans,
    required this.overdueLoans,
    required this.totalCustomers,
    required this.todayExpected,
    required this.todayCollected,
    required this.cashCollectedToday,
    required this.todayGap,
    required this.overdueOutstanding,
    required this.overdueCollectedToday,
    required this.overdueTotalTillToday,
    required this.pendingPenalties,
    required this.activeAgents,
    required this.recentLoans,
    required this.todayInstalments,
    required this.hitRate,
    required this.todayPending,
    required this.defaulterAlerts,
    required this.routePerformance,
    required this.recentActivity,
    required this.todayActivity,
    required this.totalDisbursed,
    required this.totalCollectedAllTime,
    this.bestPayer,
    this.highestBorrower,
    this.pendingUpiCollections = const [],
    this.pendingCashCollections = const [],
    this.todayByMode = const {},
    this.todayBreakdown = const TodayCollectionBreakdown(),
    this.overdueBreakdown = const OverdueCollectionBreakdown(),
    this.todaysActivity = const TodaysActivityBundle(),
  });

  final int activeLoans;
  final int overdueLoans;
  final int totalCustomers;
  final double todayExpected;
  final double todayCollected;

  /// Actual cash collected today across all instalments (today/overdue/future).
  final double cashCollectedToday;
  final double todayGap;
  final double hitRate;
  final double todayPending;
  // Overdue collection (daily snapshot — see API /v1/dashboard).
  final double overdueOutstanding;
  final double overdueCollectedToday;
  final double overdueTotalTillToday;
  final int pendingPenalties;
  final int activeAgents;
  final List<RecentLoan> recentLoans;
  final List<TodayInstalment> todayInstalments;
  final List<DefaulterAlert> defaulterAlerts;
  final List<RoutePerformance> routePerformance;
  final List<RecentActivity> recentActivity;
  final List<TodayActivity> todayActivity;

  // Web dashboard parity additions
  final double totalDisbursed;
  final double totalCollectedAllTime;
  final String? bestPayer;
  final String? highestBorrower;
  final List<TodayActivity> pendingUpiCollections;
  final List<TodayActivity> pendingCashCollections;
  final Map<String, double> todayByMode;
  final TodayCollectionBreakdown todayBreakdown;
  final OverdueCollectionBreakdown overdueBreakdown;
  final TodaysActivityBundle todaysActivity;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final todayCollectedValue = toNum(json['todayCollected']);
    final cashCollectedTodayValue =
        toNum(json['cashCollectedToday'] ?? json['todayCollected']);
    return DashboardSummary(
      activeLoans: (json['activeLoans'] as num?)?.toInt() ?? 0,
      overdueLoans: (json['overdueLoans'] as num?)?.toInt() ?? 0,
      totalCustomers: (json['totalCustomers'] as num?)?.toInt() ?? 0,
      todayExpected: toNum(json['todayExpected']),
      todayCollected: todayCollectedValue,
      cashCollectedToday: cashCollectedTodayValue,
      todayGap: toNum(json['todayGap']),
      hitRate: toNum(json['hitRate']),
      todayPending: toNum(json['todayPending']),
      overdueOutstanding: toNum(json['overdueOutstanding']),
      overdueCollectedToday: toNum(json['overdueCollectedToday']),
      overdueTotalTillToday: toNum(json['overdueTotalTillToday']),
      pendingPenalties: (json['pendingPenalties'] as num?)?.toInt() ?? 0,
      activeAgents: (json['activeAgents'] as num?)?.toInt() ?? 0,
      recentLoans: (json['recentLoans'] as List<dynamic>? ?? const [])
          .map((dynamic e) => RecentLoan.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      todayInstalments: (json['todayInstalments'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => TodayInstalment.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      defaulterAlerts: (json['defaulterAlerts'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => DefaulterAlert.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      routePerformance: (json['routePerformance'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => RoutePerformance.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      recentActivity: (json['recentActivity'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => RecentActivity.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      todayActivity: (json['todayActivity'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => TodayActivity.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      totalDisbursed: toNum(json['totalDisbursed']),
      totalCollectedAllTime: toNum(json['totalCollectedAllTime']),
      bestPayer: json['bestPayer'] as String?,
      highestBorrower: json['highestBorrower'] as String?,
      pendingUpiCollections: (json['pendingUpiCollections'] as List<dynamic>? ??
              const [])
          .map((dynamic e) => TodayActivity.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      pendingCashCollections: (json['pendingCashCollections']
                  as List<dynamic>? ??
              const [])
          .map((dynamic e) => TodayActivity.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      todayByMode: (json['todayByMode'] as Map<String, dynamic>? ?? const {})
          .map((k, dynamic v) => MapEntry(k, toNum(v))),
      todayBreakdown: json['todayBreakdown'] != null
          ? TodayCollectionBreakdown.fromJson(json['todayBreakdown'] as Map<String, dynamic>)
          : TodayCollectionBreakdown(
              total: StatusSubMetrics(expected: toNum(json['todayExpected']), collected: toNum(json['todayCollected']), remaining: toNum(json['todayGap']), pct: toNum(json['hitRate'])),
              active: const StatusSubMetrics(),
              inactive: const StatusSubMetrics(),
            ),
      overdueBreakdown: json['overdueBreakdown'] != null
          ? OverdueCollectionBreakdown.fromJson(json['overdueBreakdown'] as Map<String, dynamic>)
          : OverdueCollectionBreakdown(
              total: OverdueStatusSubMetrics(
                totalOverdue: toNum(json['overdueTotalTillToday']),
                collectedToday: toNum(json['overdueCollectedToday']),
                remaining: toNum(json['overdueOutstanding']),
              ),
              active: const OverdueStatusSubMetrics(),
              inactive: const OverdueStatusSubMetrics(),
            ),
      todaysActivity: json['todaysActivity'] != null
          ? TodaysActivityBundle.fromJson(json['todaysActivity'] as Map<String, dynamic>)
          : TodaysActivityBundle(
              paidItems: (json['todayActivity'] as List<dynamic>? ?? const [])
                  .map((dynamic e) {
                    final m = e as Map<String, dynamic>;
                    return TodayPaidItem(
                      id: (m['id'] as String?) ?? '',
                      receivedAmount: toNum(m['amount']),
                      dueAmount: toNum(m['amount']),
                      paymentMode: (m['paymentMode'] as String?) ?? 'cash',
                      submittedAt: DateTime.tryParse(m['submittedAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
                      verificationStatus: (m['verificationStatus'] as String?) ?? 'verified',
                      customerId: (m['customerId'] as String?) ?? '',
                      customerName: (m['customerName'] as String?) ?? '—',
                      customerCode: (m['customerCode'] as String?) ?? '',
                      loanId: '',
                      loanCode: (m['loanCode'] as String?) ?? '',
                      agentName: (m['agentName'] as String?) ?? '',
                    );
                  })
                  .toList(growable: false),
            ),
    );
  }
}

/// One collection recorded today — for the dashboard "Today's Activity" feed.
class TodayActivity {
  const TodayActivity({
    required this.id,
    required this.amount,
    required this.count,
    required this.paymentMode,
    required this.submittedAt,
    required this.customerName,
    required this.customerCode,
    required this.customerId,
    required this.agentName,
    required this.loanCode,
    required this.verificationStatus,
    this.customerPhoto,
  });

  final String id;
  final double amount;

  /// Number of instalments this single payment was distributed across.
  final int count;
  final String paymentMode;
  final DateTime submittedAt;
  final String customerName;
  final String customerCode;
  final String customerId;
  final String agentName;
  final String loanCode;
  final String verificationStatus;
  final String? customerPhoto;

  factory TodayActivity.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return TodayActivity(
      id: (json['id'] as String?) ?? '',
      amount: toNum(json['amount']),
      count: (json['count'] as num?)?.toInt() ?? 1,
      paymentMode: (json['paymentMode'] as String?) ?? 'cash',
      submittedAt:
          DateTime.tryParse(json['submittedAt'] as String? ?? '')?.toLocal() ??
              DateTime.now(),
      customerName: (json['customerName'] as String?) ?? '—',
      customerCode: (json['customerCode'] as String?) ?? '',
      customerId: (json['customerId'] as String?) ?? '',
      agentName: (json['agentName'] as String?) ?? '—',
      loanCode: (json['loanCode'] as String?) ?? '',
      verificationStatus: (json['verificationStatus'] as String?) ?? 'pending',
      customerPhoto: json['customerPhoto'] as String?,
    );
  }
}

class DefaulterAlert {
  const DefaulterAlert({
    required this.id,
    required this.dueAmount,
    required this.overdueAmount,
    required this.customerName,
    required this.customerCode,
    this.customerPhoto,
  });

  final String id;
  final double dueAmount;
  final double overdueAmount;
  final String customerName;
  final String customerCode;
  final String? customerPhoto;

  factory DefaulterAlert.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final loan = (json['loan'] as Map<String, dynamic>?) ?? const {};
    final customer = (loan['customer'] as Map<String, dynamic>?) ?? const {};
    return DefaulterAlert(
      id: json['id'] as String,
      dueAmount: toNum(json['dueAmount']),
      overdueAmount: toNum(json['overdueAmount']),
      customerName: (customer['name'] as String?) ?? '—',
      customerCode: (customer['customerCode'] as String?) ?? '',
      customerPhoto: customer['profilePhoto'] as String?,
    );
  }
}

class RoutePerformance {
  const RoutePerformance({
    required this.id,
    required this.name,
    required this.agent,
    this.agentId,
    required this.customers,
    required this.overdue,
  });

  final String id;
  final String name;
  final String agent;
  final String? agentId;
  final int customers;
  final double overdue;

  factory RoutePerformance.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return RoutePerformance(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      agent: json['agent'] as String? ?? '—',
      agentId: json['agentId'] as String?,
      customers: (json['customers'] as num?)?.toInt() ?? 0,
      overdue: toNum(json['overdue']),
    );
  }
}

class RecentActivity {
  const RecentActivity({
    required this.id,
    required this.action,
    required this.resource,
    required this.userName,
    required this.createdAt,
  });

  final String id;
  final String action;
  final String resource;
  final String userName;
  final DateTime createdAt;

  factory RecentActivity.fromJson(Map<String, dynamic> json) {
    final user = (json['user'] as Map<String, dynamic>?) ?? const {};
    return RecentActivity(
      id: json['id'] as String,
      action: json['action'] as String? ?? '',
      resource: json['resource'] as String? ?? '',
      userName: user['name'] as String? ?? '—',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}

class RecentLoan {
  const RecentLoan({
    required this.id,
    required this.loanCode,
    required this.createdAt,
    required this.customerName,
    required this.customerCode,
    this.customerPhoto,
  });

  final String id;
  final String loanCode;
  final DateTime createdAt;
  final String customerName;
  final String customerCode;
  final String? customerPhoto;

  factory RecentLoan.fromJson(Map<String, dynamic> json) {
    final c = (json['customer'] as Map<String, dynamic>?) ?? const {};
    return RecentLoan(
      id: json['id'] as String,
      loanCode: json['loanCode'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      customerName: (c['name'] as String?) ?? '—',
      customerCode: (c['customerCode'] as String?) ?? '',
      customerPhoto: c['profilePhoto'] as String?,
    );
  }
}

class TodayInstalment {
  const TodayInstalment({
    required this.id,
    required this.dueAmount,
    required this.receivedAmount,
    required this.status,
    required this.customerName,
    required this.loanCode,
    this.customerPhoto,
  });

  final String id;
  final double dueAmount;
  final double receivedAmount;
  final String status;
  final String customerName;
  final String loanCode;
  final String? customerPhoto;

  factory TodayInstalment.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final loan = (json['loan'] as Map<String, dynamic>?) ?? const {};
    final customer = (loan['customer'] as Map<String, dynamic>?) ?? const {};
    return TodayInstalment(
      id: json['id'] as String,
      dueAmount: toNum(json['dueAmount']),
      receivedAmount: toNum(json['receivedAmount']),
      status: (json['status'] as String?) ?? 'upcoming',
      customerName: (customer['name'] as String?) ?? '—',
      loanCode: (loan['loanCode'] as String?) ?? '',
      customerPhoto: customer['profilePhoto'] as String?,
    );
  }
}

class TodayPaidItem {
  const TodayPaidItem({
    required this.id,
    required this.receivedAmount,
    required this.dueAmount,
    required this.paymentMode,
    required this.submittedAt,
    required this.verificationStatus,
    required this.customerId,
    required this.customerName,
    required this.customerCode,
    this.customerPhone,
    this.routeName,
    required this.loanId,
    required this.loanCode,
    this.frequency,
    this.principal = 0,
    this.agentName,
  });

  final String id;
  final double receivedAmount;
  final double dueAmount;
  final String paymentMode;
  final DateTime submittedAt;
  final String verificationStatus;
  final String customerId;
  final String customerName;
  final String customerCode;
  final String? customerPhone;
  final String? routeName;
  final String loanId;
  final String loanCode;
  final String? frequency;
  final double principal;
  final String? agentName;

  factory TodayPaidItem.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final cust = (json['customer'] as Map<String, dynamic>?) ?? const {};
    final route = cust['route'] as Map<String, dynamic>?;
    final loan = (json['loan'] as Map<String, dynamic>?) ?? const {};
    final agent = json['agent'] as Map<String, dynamic>?;
    return TodayPaidItem(
      id: (json['id'] as String?) ?? '',
      receivedAmount: toNum(json['receivedAmount']),
      dueAmount: toNum(json['dueAmount']),
      paymentMode: (json['paymentMode'] as String?) ?? 'cash',
      submittedAt: DateTime.tryParse(json['submittedAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      verificationStatus: (json['verificationStatus'] as String?) ?? 'verified',
      customerId: (cust['id'] as String?) ?? '',
      customerName: (cust['name'] as String?) ?? '—',
      customerCode: (cust['customerCode'] as String?) ?? '',
      customerPhone: cust['phone'] as String?,
      routeName: route?['name'] as String?,
      loanId: (loan['id'] as String?) ?? '',
      loanCode: (loan['loanCode'] as String?) ?? '',
      frequency: loan['frequency'] as String?,
      principal: toNum(loan['principal']),
      agentName: agent?['name'] as String?,
    );
  }
}

class TodayPendingItem {
  const TodayPendingItem({
    required this.id,
    required this.dueAmount,
    required this.receivedAmount,
    required this.remainingAmount,
    required this.dueDate,
    required this.status,
    required this.customerId,
    required this.customerName,
    required this.customerCode,
    this.customerPhone,
    this.routeName,
    required this.loanId,
    required this.loanCode,
    this.frequency,
    this.perInstalment = 0,
  });

  final String id;
  final double dueAmount;
  final double receivedAmount;
  final double remainingAmount;
  final DateTime dueDate;
  final String status;
  final String customerId;
  final String customerName;
  final String customerCode;
  final String? customerPhone;
  final String? routeName;
  final String loanId;
  final String loanCode;
  final String? frequency;
  final double perInstalment;

  factory TodayPendingItem.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final cust = (json['customer'] as Map<String, dynamic>?) ?? const {};
    final route = cust['route'] as Map<String, dynamic>?;
    final loan = (json['loan'] as Map<String, dynamic>?) ?? const {};
    return TodayPendingItem(
      id: (json['id'] as String?) ?? '',
      dueAmount: toNum(json['dueAmount']),
      receivedAmount: toNum(json['receivedAmount']),
      remainingAmount: toNum(json['remainingAmount']),
      dueDate: DateTime.tryParse(json['dueDate'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      status: (json['status'] as String?) ?? 'pending',
      customerId: (cust['id'] as String?) ?? '',
      customerName: (cust['name'] as String?) ?? '—',
      customerCode: (cust['customerCode'] as String?) ?? '',
      customerPhone: cust['phone'] as String?,
      routeName: route?['name'] as String?,
      loanId: (loan['id'] as String?) ?? '',
      loanCode: (loan['loanCode'] as String?) ?? '',
      frequency: loan['frequency'] as String?,
      perInstalment: toNum(loan['perInstalment']),
    );
  }
}

class TodayNewLoanItem {
  const TodayNewLoanItem({
    required this.id,
    required this.loanCode,
    required this.principal,
    required this.frequency,
    required this.tenure,
    required this.createdAt,
    required this.customerId,
    required this.customerName,
    required this.customerCode,
    this.customerPhone,
    this.routeName,
    this.createdByName,
  });

  final String id;
  final String loanCode;
  final double principal;
  final String frequency;
  final int tenure;
  final DateTime createdAt;
  final String customerId;
  final String customerName;
  final String customerCode;
  final String? customerPhone;
  final String? routeName;
  final String? createdByName;

  factory TodayNewLoanItem.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final cust = (json['customer'] as Map<String, dynamic>?) ?? const {};
    final route = cust['route'] as Map<String, dynamic>?;
    final createdBy = json['createdBy'] as Map<String, dynamic>?;
    return TodayNewLoanItem(
      id: (json['id'] as String?) ?? '',
      loanCode: (json['loanCode'] as String?) ?? '',
      principal: toNum(json['principal']),
      frequency: (json['frequency'] as String?) ?? 'daily',
      tenure: (json['tenure'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      customerId: (cust['id'] as String?) ?? '',
      customerName: (cust['name'] as String?) ?? '—',
      customerCode: (cust['customerCode'] as String?) ?? '',
      customerPhone: cust['phone'] as String?,
      routeName: route?['name'] as String?,
      createdByName: createdBy?['name'] as String?,
    );
  }
}

class TodayNewCustomerItem {
  const TodayNewCustomerItem({
    required this.id,
    required this.name,
    required this.customerCode,
    this.phone,
    required this.createdAt,
    this.routeName,
  });

  final String id;
  final String name;
  final String customerCode;
  final String? phone;
  final DateTime createdAt;
  final String? routeName;

  factory TodayNewCustomerItem.fromJson(Map<String, dynamic> json) {
    final route = json['route'] as Map<String, dynamic>?;
    return TodayNewCustomerItem(
      id: (json['id'] as String?) ?? (json['id_cust'] as String?) ?? '',
      name: (json['name'] as String?) ?? '—',
      customerCode: (json['customerCode'] as String?) ?? '',
      phone: json['phone'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      routeName: route?['name'] as String?,
    );
  }
}

class TodayOtherActivityItem {
  const TodayOtherActivityItem({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.timestamp,
    this.status,
    this.customerCode,
    this.loanCode,
    this.amount,
  });

  final String id;
  final String type;
  final String title;
  final String description;
  final DateTime timestamp;
  final String? status;
  final String? customerCode;
  final String? loanCode;
  final double? amount;

  factory TodayOtherActivityItem.fromJson(Map<String, dynamic> json) {
    double? toNum(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));
    return TodayOtherActivityItem(
      id: (json['id'] as String?) ?? '',
      type: (json['type'] as String?) ?? 'other',
      title: (json['title'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      timestamp: DateTime.tryParse(json['timestamp'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      status: json['status'] as String?,
      customerCode: json['customerCode'] as String?,
      loanCode: json['loanCode'] as String?,
      amount: toNum(json['amount']),
    );
  }
}

class TodaysActivityBundle {
  const TodaysActivityBundle({
    this.paidItems = const [],
    this.pendingItems = const [],
    this.newLoanItems = const [],
    this.newCustomerItems = const [],
    this.otherItems = const [],
  });

  final List<TodayPaidItem> paidItems;
  final List<TodayPendingItem> pendingItems;
  final List<TodayNewLoanItem> newLoanItems;
  final List<TodayNewCustomerItem> newCustomerItems;
  final List<TodayOtherActivityItem> otherItems;

  bool get isEmpty =>
      paidItems.isEmpty &&
      pendingItems.isEmpty &&
      newLoanItems.isEmpty &&
      newCustomerItems.isEmpty &&
      otherItems.isEmpty;

  factory TodaysActivityBundle.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const TodaysActivityBundle();
    return TodaysActivityBundle(
      paidItems: (json['paidItems'] as List<dynamic>? ?? const [])
          .map((dynamic e) => TodayPaidItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      pendingItems: (json['pendingItems'] as List<dynamic>? ?? const [])
          .map((dynamic e) => TodayPendingItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      newLoanItems: (json['newLoanItems'] as List<dynamic>? ?? const [])
          .map((dynamic e) => TodayNewLoanItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      newCustomerItems: (json['newCustomerItems'] as List<dynamic>? ?? const [])
          .map((dynamic e) => TodayNewCustomerItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      otherItems: (json['otherItems'] as List<dynamic>? ?? const [])
          .map((dynamic e) => TodayOtherActivityItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}
