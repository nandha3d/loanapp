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

// ─── Full Analytics (new) ────────────────────────────

class PortfolioSummary {
  const PortfolioSummary({
    required this.totalDisbursed,
    required this.activePrincipal,
    required this.totalRecovered,
    required this.npaAmount,
    required this.recoveryRatio,
    required this.avgLoanSize,
    required this.activeCount,
    required this.closedCount,
    required this.overdueCount,
  });
  final double totalDisbursed;
  final double activePrincipal;
  final double totalRecovered;
  final double npaAmount;
  final double recoveryRatio;
  final double avgLoanSize;
  final int activeCount;
  final int closedCount;
  final int overdueCount;

  factory PortfolioSummary.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    int i(dynamic v) => v == null
        ? 0
        : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? 0);
    return PortfolioSummary(
      totalDisbursed: n(json['totalDisbursed']),
      activePrincipal: n(json['activePrincipal']),
      totalRecovered: n(json['totalRecovered']),
      npaAmount: n(json['npaAmount']),
      recoveryRatio: n(json['recoveryRatio']),
      avgLoanSize: n(json['avgLoanSize']),
      activeCount: i(json['activeCount']),
      closedCount: i(json['closedCount']),
      overdueCount: i(json['overdueCount']),
    );
  }
}

class AgingBucket {
  const AgingBucket({
    required this.label,
    required this.count,
    required this.amount,
    required this.color,
  });
  final String label;
  final int count;
  final double amount;
  final String color;

  factory AgingBucket.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return AgingBucket(
      label: (json['label'] as String?) ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
      amount: n(json['amount']),
      color: (json['color'] as String?) ?? '#6b7280',
    );
  }
}

class RiskScore {
  const RiskScore({
    required this.score,
    required this.label,
    required this.color,
  });
  final int score;
  final String label;
  final String color;

  factory RiskScore.fromJson(Map<String, dynamic> json) {
    return RiskScore(
      score: (json['score'] as num?)?.toInt() ?? 0,
      label: (json['label'] as String?) ?? 'Unknown',
      color: (json['color'] as String?) ?? '#6b7280',
    );
  }
}

class BorrowerSegment {
  const BorrowerSegment({
    required this.label,
    required this.count,
    required this.color,
  });
  final String label;
  final int count;
  final String color;

  factory BorrowerSegment.fromJson(Map<String, dynamic> json) {
    return BorrowerSegment(
      label: (json['label'] as String?) ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
      color: (json['color'] as String?) ?? '#6b7280',
    );
  }
}

class ForecastDay {
  const ForecastDay({
    required this.label,
    required this.expected,
    required this.cumulative,
  });
  final String label;
  final double expected;
  final double cumulative;

  factory ForecastDay.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return ForecastDay(
      label: (json['label'] as String?) ?? '',
      expected: n(json['expected']),
      cumulative: n(json['cumulative']),
    );
  }
}

class SmartInsight {
  const SmartInsight({
    required this.icon,
    required this.text,
    required this.color,
  });
  final String icon;
  final String text;
  final String color;

  factory SmartInsight.fromJson(Map<String, dynamic> json) {
    return SmartInsight(
      icon: (json['icon'] as String?) ?? '💡',
      text: (json['text'] as String?) ?? '',
      color: (json['color'] as String?) ?? '#6b7280',
    );
  }
}

class CollectionEfficiency {
  const CollectionEfficiency({
    required this.pct,
    required this.color,
    required this.label,
    required this.expected,
    required this.collected,
  });
  final double pct;
  final String color;
  final String label;
  final double expected;
  final double collected;

  factory CollectionEfficiency.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return CollectionEfficiency(
      pct: n(json['pct']),
      color: (json['color'] as String?) ?? '#6b7280',
      label: (json['label'] as String?) ?? '',
      expected: n(json['expected']),
      collected: n(json['collected']),
    );
  }
}

class FullAnalytics {
  const FullAnalytics({
    required this.collectionEfficiency,
    required this.capitalBalance,
    required this.portfolio,
    required this.trend7d,
    required this.agingBuckets,
    required this.riskScore,
    required this.agentLeaderboard,
    required this.borrowerSegments,
    required this.cashflowForecast7d,
    required this.insights,
    required this.prevWeekCollected,
    required this.currentWeekCollected,
  });

  final CollectionEfficiency collectionEfficiency;
  final double capitalBalance;
  final PortfolioSummary portfolio;
  final List<CollectionPoint> trend7d;
  final List<AgingBucket> agingBuckets;
  final RiskScore riskScore;
  final List<AgentPerformance> agentLeaderboard;
  final List<BorrowerSegment> borrowerSegments;
  final List<ForecastDay> cashflowForecast7d;
  final List<SmartInsight> insights;
  final double prevWeekCollected;
  final double currentWeekCollected;

  factory FullAnalytics.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return FullAnalytics(
      collectionEfficiency: CollectionEfficiency.fromJson(
          (json['collectionEfficiency'] as Map<String, dynamic>?) ?? const {}),
      capitalBalance: n(json['capitalBalance']),
      portfolio: PortfolioSummary.fromJson(
          (json['portfolio'] as Map<String, dynamic>?) ?? const {}),
      trend7d: (json['trend7d'] as List<dynamic>? ?? const [])
          .map((dynamic e) => CollectionPoint.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      agingBuckets: (json['agingBuckets'] as List<dynamic>? ?? const [])
          .map((dynamic e) => AgingBucket.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      riskScore: RiskScore.fromJson(
          (json['riskScore'] as Map<String, dynamic>?) ?? const {}),
      agentLeaderboard: (json['agentLeaderboard'] as List<dynamic>? ?? const [])
          .map((dynamic e) => AgentPerformance.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      borrowerSegments: (json['borrowerSegments'] as List<dynamic>? ?? const [])
          .map((dynamic e) => BorrowerSegment.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      cashflowForecast7d:
          (json['cashflowForecast7d'] as List<dynamic>? ?? const [])
              .map((dynamic e) => ForecastDay.fromJson(e as Map<String, dynamic>))
              .toList(growable: false),
      insights: (json['insights'] as List<dynamic>? ?? const [])
          .map((dynamic e) => SmartInsight.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      prevWeekCollected: n(json['prevWeekCollected']),
      currentWeekCollected: n(json['currentWeekCollected']),
    );
  }
}
