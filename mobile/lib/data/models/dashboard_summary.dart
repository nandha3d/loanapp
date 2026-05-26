class DashboardSummary {
  const DashboardSummary({
    required this.activeLoans,
    required this.overdueLoans,
    required this.totalCustomers,
    required this.todayExpected,
    required this.todayCollected,
    required this.pendingPenalties,
    required this.activeAgents,
    required this.recentLoans,
    required this.todayInstalments,
  });

  final int activeLoans;
  final int overdueLoans;
  final int totalCustomers;
  final double todayExpected;
  final double todayCollected;
  final int pendingPenalties;
  final int activeAgents;
  final List<RecentLoan> recentLoans;
  final List<TodayInstalment> todayInstalments;

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
