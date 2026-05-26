class AnalyticsSummary {
  const AnalyticsSummary({
    required this.activeLoans,
    required this.overdueLoans,
    required this.closedLoans,
    required this.monthExpected,
    required this.monthCollected,
    required this.efficiency,
    required this.onTimeRatio,
  });

  final int activeLoans;
  final int overdueLoans;
  final int closedLoans;
  final double monthExpected;
  final double monthCollected;
  final double efficiency;
  final int onTimeRatio;

  factory AnalyticsSummary.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    int i(dynamic v) => v == null
        ? 0
        : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? 0);
    return AnalyticsSummary(
      activeLoans: i(json['activeLoans']),
      overdueLoans: i(json['overdueLoans']),
      closedLoans: i(json['closedLoans']),
      monthExpected: n(json['monthExpected']),
      monthCollected: n(json['monthCollected']),
      efficiency: n(json['efficiency']),
      onTimeRatio: i(json['onTimeRatio']),
    );
  }
}

class CollectionPoint {
  const CollectionPoint({
    required this.date,
    required this.expected,
    required this.collected,
  });
  final String date;
  final double expected;
  final double collected;

  factory CollectionPoint.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return CollectionPoint(
      date: json['date'] as String,
      expected: n(json['expected']),
      collected: n(json['collected']),
    );
  }
}

class AgentPerformance {
  const AgentPerformance({
    required this.id,
    required this.name,
    required this.expected,
    required this.collected,
    required this.hitRate,
  });
  final String id;
  final String name;
  final double expected;
  final double collected;
  final int hitRate;

  factory AgentPerformance.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return AgentPerformance(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      expected: n(json['expected']),
      collected: n(json['collected']),
      hitRate: (json['hitRate'] as num?)?.toInt() ?? 0,
    );
  }
}
