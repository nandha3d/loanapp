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

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return DashboardSummary(
      activeLoans: (json['activeLoans'] as num?)?.toInt() ?? 0,
      overdueLoans: (json['overdueLoans'] as num?)?.toInt() ?? 0,
      totalCustomers: (json['totalCustomers'] as num?)?.toInt() ?? 0,
      todayExpected: toNum(json['todayExpected']),
      todayCollected: toNum(json['todayCollected']),
      cashCollectedToday: toNum(json['cashCollectedToday']),
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
  });

  final String id;
  final double dueAmount;
  final double overdueAmount;
  final String customerName;
  final String customerCode;

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
    );
  }
}

class RoutePerformance {
  const RoutePerformance({
    required this.id,
    required this.name,
    required this.agent,
    required this.customers,
    required this.overdue,
  });

  final String id;
  final String name;
  final String agent;
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
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
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
  });

  final String id;
  final String loanCode;
  final DateTime createdAt;
  final String customerName;
  final String customerCode;

  factory RecentLoan.fromJson(Map<String, dynamic> json) {
    final c = (json['customer'] as Map<String, dynamic>?) ?? const {};
    return RecentLoan(
      id: json['id'] as String,
      loanCode: json['loanCode'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      customerName: (c['name'] as String?) ?? '—',
      customerCode: (c['customerCode'] as String?) ?? '',
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
  });

  final String id;
  final double dueAmount;
  final double receivedAmount;
  final String status;
  final String customerName;
  final String loanCode;

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
    );
  }
}
