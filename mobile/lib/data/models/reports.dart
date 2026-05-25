/// Models for the Reports feature.
library;

class OverdueItem {
  const OverdueItem({
    required this.loanId,
    required this.loanCode,
    required this.customerCode,
    required this.customerName,
    required this.phone,
    required this.overdueAmount,
    required this.overdueDays,
    required this.missedCount,
  });

  final String loanId;
  final String loanCode;
  final String customerCode;
  final String customerName;
  final String phone;
  final double overdueAmount;
  final int overdueDays;
  final int missedCount;

  /// Kept for backwards compat with reports_screen
  double get outstanding => overdueAmount;
  int get missedInstalments => missedCount;
  String get id => loanId;

  factory OverdueItem.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    int i(dynamic v) => v == null
        ? 0
        : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? 0);

    // API returns nested customer object
    final cust = json['customer'] as Map<String, dynamic>? ?? {};
    return OverdueItem(
      loanId:       (json['loanId']  as String?) ?? '',
      loanCode:     (json['loanCode'] as String?) ?? '',
      customerCode: (cust['customerCode'] as String?) ?? '',
      customerName: (cust['name']         as String?) ?? '',
      phone:        (cust['phone']        as String?) ?? '',
      overdueAmount: n(json['overdueAmount']),
      overdueDays:   i(json['overdueDays']),
      missedCount:   i(json['missedCount']),
    );
  }
}

class AgentPerf {
  const AgentPerf({
    required this.agentId,
    required this.name,
    required this.expected,
    required this.collected,
    required this.entryCount,
    required this.hitRate,
  });

  final String agentId;
  final String name;
  final double expected;
  final double collected;
  final int entryCount;
  final int hitRate;

  factory AgentPerf.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    int i(dynamic v) => v == null
        ? 0
        : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? 0);
    return AgentPerf(
      agentId:    (json['agentId'] as String?) ?? '',
      name:       (json['name']    as String?) ?? '',
      expected:   n(json['expected']),
      collected:  n(json['collected']),
      entryCount: i(json['entryCount']),
      hitRate:    i(json['hitRate']),
    );
  }
}

class AccountingSummary {
  const AccountingSummary({
    required this.totalCollected,
    required this.totalDisbursed,
    required this.totalExpenses,
    required this.currentCapital,
    required this.netProfit,
    required this.projectedRevenue,
    required this.capitalIn,
    required this.capitalOut,
  });

  final double totalCollected;
  final double totalDisbursed;
  final double totalExpenses;
  final double currentCapital;
  final double netProfit;
  final double projectedRevenue;
  final double capitalIn;
  final double capitalOut;

  factory AccountingSummary.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return AccountingSummary(
      totalCollected:   n(json['totalCollected']),
      totalDisbursed:   n(json['totalDisbursed']),
      totalExpenses:    n(json['totalExpenses']),
      currentCapital:   n(json['currentCapital']),
      netProfit:        n(json['netProfit']),
      projectedRevenue: n(json['projectedRevenue']),
      capitalIn:        n(json['capitalIn']),
      capitalOut:       n(json['capitalOut']),
    );
  }
}
