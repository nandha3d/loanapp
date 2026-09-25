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
    this.label = '',
    this.dateKey = '',
  });
  final String date;
  final double expected;
  final double collected;
  final String label;
  final String dateKey;

  factory CollectionPoint.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return CollectionPoint(
      date: (json['date'] ?? json['dateKey']) as String,
      expected: n(json['expected']),
      collected: n(json['collected']),
      label: (json['label'] as String?) ?? '',
      dateKey: (json['dateKey'] ?? json['date'] ?? '') as String,
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
    this.customers = 0,
    this.overdue = 0,
    this.efficiency = 0,
  });
  final String id;
  final String name;
  final double expected;
  final double collected;
  final int hitRate;
  final int customers;
  final double overdue;
  final double efficiency;

  factory AgentPerformance.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return AgentPerformance(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      expected: n(json['expected']),
      collected: n(json['collected']),
      hitRate:
          (json['hitRate'] as num?)?.toInt() ?? n(json['efficiency']).round(),
      customers: (json['customers'] as num?)?.toInt() ?? 0,
      overdue: n(json['overdue']),
      efficiency: n(json['efficiency']),
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

double _analyticsNumber(dynamic value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;

int _analyticsInt(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;

class Forecast30d {
  const Forecast30d({required this.total});
  final double total;

  factory Forecast30d.fromJson(Map<String, dynamic> json) =>
      Forecast30d(total: _analyticsNumber(json['total']));
}

class FunnelStep {
  const FunnelStep({
    required this.label,
    required this.count,
    required this.color,
  });
  final String label;
  final int count;
  final String color;

  factory FunnelStep.fromJson(Map<String, dynamic> json) => FunnelStep(
        label: (json['label'] as String?) ?? '',
        count: _analyticsInt(json['count']),
        color: (json['color'] as String?) ?? '',
      );
}

class AttentionLoan {
  const AttentionLoan({
    required this.customerId,
    required this.customerName,
    required this.customerCode,
    required this.loanCode,
    required this.loanId,
    required this.dueToday,
    required this.overdueDays,
    required this.overdueAmount,
    required this.riskLevel,
    required this.riskColor,
    required this.badges,
  });
  final String customerId;
  final String customerName;
  final String customerCode;
  final String loanCode;
  final String loanId;
  final double dueToday;
  final int overdueDays;
  final double overdueAmount;
  final String riskLevel;
  final String riskColor;
  final List<String> badges;

  factory AttentionLoan.fromJson(Map<String, dynamic> json) => AttentionLoan(
        customerId: (json['customerId'] as String?) ?? '',
        customerName: (json['customerName'] as String?) ?? '',
        customerCode: (json['customerCode'] as String?) ?? '',
        loanCode: (json['loanCode'] as String?) ?? '',
        loanId: (json['loanId'] as String?) ?? '',
        dueToday: _analyticsNumber(json['dueToday']),
        overdueDays: _analyticsInt(json['overdueDays']),
        overdueAmount: _analyticsNumber(json['overdueAmount']),
        riskLevel: (json['riskLevel'] as String?) ?? '',
        riskColor: (json['riskColor'] as String?) ?? '',
        badges: (json['badges'] as List<dynamic>? ?? const [])
            .map((dynamic badge) => badge.toString())
            .toList(growable: false),
      );
}

class OperationalFeedItem {
  const OperationalFeedItem({
    required this.id,
    required this.user,
    required this.action,
    required this.entity,
    required this.time,
  });
  final String id;
  final String user;
  final String action;
  final String entity;
  final DateTime? time;

  factory OperationalFeedItem.fromJson(Map<String, dynamic> json) =>
      OperationalFeedItem(
        id: (json['id'] as String?) ?? '',
        user: (json['user'] as String?) ?? '',
        action: (json['action'] as String?) ?? '',
        entity: (json['entity'] as String?) ?? '',
        time: DateTime.tryParse(json['time']?.toString() ?? ''),
      );
}

class FrequencyTotals {
  const FrequencyTotals({
    required this.daily,
    required this.weekly,
    required this.biweekly,
    required this.monthly,
  });
  final double daily;
  final double weekly;
  final double biweekly;
  final double monthly;

  factory FrequencyTotals.fromJson(Map<String, dynamic> json) =>
      FrequencyTotals(
        daily: _analyticsNumber(json['daily']),
        weekly: _analyticsNumber(json['weekly']),
        biweekly: _analyticsNumber(json['biweekly']),
        monthly: _analyticsNumber(json['monthly']),
      );
}

class BorrowerLeaderboardItem {
  const BorrowerLeaderboardItem({
    required this.id,
    required this.name,
    required this.customerCode,
    required this.totalActivePrincipal,
    required this.overdueAmount,
    required this.missedCount,
  });
  final String id;
  final String name;
  final String customerCode;
  final double totalActivePrincipal;
  final double overdueAmount;
  final int missedCount;

  factory BorrowerLeaderboardItem.fromJson(Map<String, dynamic> json) =>
      BorrowerLeaderboardItem(
        id: (json['id'] as String?) ?? '',
        name: (json['name'] as String?) ?? '',
        customerCode: (json['customerCode'] as String?) ?? '',
        totalActivePrincipal: _analyticsNumber(json['totalActivePrincipal']),
        overdueAmount: _analyticsNumber(json['overdueAmount']),
        missedCount: _analyticsInt(json['missedCount']),
      );
}

class RouteHealthItem {
  const RouteHealthItem({
    required this.name,
    required this.customers,
    required this.overdue,
    required this.collected,
  });
  final String name;
  final int customers;
  final int overdue;
  final double collected;

  factory RouteHealthItem.fromJson(Map<String, dynamic> json) =>
      RouteHealthItem(
        name: (json['name'] as String?) ?? '',
        customers: _analyticsInt(json['customers']),
        overdue: _analyticsInt(json['overdue']),
        collected: _analyticsNumber(json['collected']),
      );
}

class EmiPressure {
  const EmiPressure({required this.count, required this.amount});
  final int count;
  final double amount;

  factory EmiPressure.fromJson(Map<String, dynamic> json) => EmiPressure(
        count: _analyticsInt(json['count']),
        amount: _analyticsNumber(json['amount']),
      );
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
    required this.cashflowForecast30d,
    required this.projectedOverdue,
    required this.collectionFunnel,
    required this.attentionLoans,
    required this.insights,
    required this.operationalFeed,
    required this.frequencyTotals,
    required this.borrowerLeaderboard,
    required this.todayCashCollected,
    required this.todayUpiCollected,
    required this.routeHealth,
    required this.emiPressure,
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
  final Forecast30d cashflowForecast30d;
  final double projectedOverdue;
  final List<FunnelStep> collectionFunnel;
  final List<AttentionLoan> attentionLoans;
  final List<SmartInsight> insights;
  List<SmartInsight> get smartInsights => insights;
  final List<OperationalFeedItem> operationalFeed;
  final FrequencyTotals frequencyTotals;
  final List<BorrowerLeaderboardItem> borrowerLeaderboard;
  final double todayCashCollected;
  final double todayUpiCollected;
  final List<RouteHealthItem> routeHealth;
  final EmiPressure emiPressure;
  final double prevWeekCollected;
  final double currentWeekCollected;

  factory FullAnalytics.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return FullAnalytics(
      collectionEfficiency: CollectionEfficiency.fromJson(
        (json['collectionEfficiency'] as Map<String, dynamic>?) ?? const {},
      ),
      capitalBalance: n(json['capitalBalance']),
      portfolio: PortfolioSummary.fromJson(
        (json['portfolio'] as Map<String, dynamic>?) ?? const {},
      ),
      trend7d: (json['trend7d'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => CollectionPoint.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      agingBuckets: (json['agingBuckets'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => AgingBucket.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      riskScore: RiskScore.fromJson(
        (json['riskScore'] as Map<String, dynamic>?) ?? const {},
      ),
      agentLeaderboard: (json['agentLeaderboard'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => AgentPerformance.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      borrowerSegments: (json['borrowerSegments'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => BorrowerSegment.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      cashflowForecast7d:
          (json['cashflowForecast7d'] as List<dynamic>? ?? const [])
              .map(
                (dynamic e) => ForecastDay.fromJson(e as Map<String, dynamic>),
              )
              .toList(growable: false),
      cashflowForecast30d: Forecast30d.fromJson(
        (json['cashflowForecast30d'] as Map<String, dynamic>?) ?? const {},
      ),
      projectedOverdue: n(json['projectedOverdue']),
      collectionFunnel: (json['collectionFunnel'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => FunnelStep.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      attentionLoans: (json['attentionLoans'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => AttentionLoan.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      insights:
          ((json['smartInsights'] ?? json['insights']) as List<dynamic>? ??
                  const [])
              .map(
                (dynamic e) => SmartInsight.fromJson(e as Map<String, dynamic>),
              )
              .toList(growable: false),
      operationalFeed: (json['operationalFeed'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) =>
                OperationalFeedItem.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      frequencyTotals: FrequencyTotals.fromJson(
        (json['frequencyTotals'] as Map<String, dynamic>?) ?? const {},
      ),
      borrowerLeaderboard:
          (json['borrowerLeaderboard'] as List<dynamic>? ?? const [])
              .map(
                (dynamic e) =>
                    BorrowerLeaderboardItem.fromJson(e as Map<String, dynamic>),
              )
              .toList(growable: false),
      todayCashCollected: n(json['todayCashCollected']),
      todayUpiCollected: n(json['todayUpiCollected']),
      routeHealth: (json['routeHealth'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) => RouteHealthItem.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      emiPressure: EmiPressure.fromJson(
        (json['emiPressure'] as Map<String, dynamic>?) ?? const {},
      ),
      prevWeekCollected: n(json['prevWeekCollected']),
      currentWeekCollected: n(json['currentWeekCollected']),
    );
  }
}
