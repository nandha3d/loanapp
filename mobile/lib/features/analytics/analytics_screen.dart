import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/analytics.dart';
import 'package:loantrack/data/services/analytics_service.dart';
import 'package:loantrack/features/customers/widgets/filter_pill.dart';

final _summaryProvider = FutureProvider.autoDispose<AnalyticsSummary>(
  (ref) => ref.watch(analyticsServiceProvider).summary(),
);
final _collectionsProvider =
    FutureProvider.autoDispose<List<CollectionPoint>>(
  (ref) => ref.watch(analyticsServiceProvider).collections(),
);
final _agentsProvider = FutureProvider.autoDispose<List<AgentPerformance>>(
  (ref) => ref.watch(analyticsServiceProvider).agents(),
);

class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  String _period = 'month';

  @override
  Widget build(BuildContext context) {
    final summary = ref.watch(_summaryProvider);
    final collections = ref.watch(_collectionsProvider);
    final agents = ref.watch(_agentsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Analytics'),
        centerTitle: true,
        actions: const [
          Icon(Icons.ios_share_outlined, color: AppColors.textSecondary),
          SizedBox(width: 16),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(_summaryProvider);
          ref.invalidate(_collectionsProvider);
          ref.invalidate(_agentsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _periodSelector(),
            const SizedBox(height: 12),
            _Card(
              title: 'Collection Trend',
              subtitle: DateFormat('MMMM y').format(DateTime.now()),
              child: collections.when(
                loading: () => const SizedBox(
                    height: 160,
                    child: Center(child: CircularProgressIndicator())),
                error: (e, _) => SizedBox(
                    height: 160,
                    child: Center(child: Text('$e', style: AppTypography.bodySmall))),
                data: _trendChart,
              ),
            ),
            const SizedBox(height: 12),
            _Card(
              title: 'Loan Status',
              child: summary.when(
                loading: () => const SizedBox(
                    height: 200,
                    child: Center(child: CircularProgressIndicator())),
                error: (e, _) => SizedBox(
                    height: 200,
                    child: Center(child: Text('$e', style: AppTypography.bodySmall))),
                data: _loanStatusDonut,
              ),
            ),
            const SizedBox(height: 12),
            _Card(
              title: 'Agent Performance',
              child: agents.when(
                loading: () => const Padding(
                    padding: EdgeInsets.all(20),
                    child: Center(child: CircularProgressIndicator())),
                error: (e, _) => Text('$e', style: AppTypography.bodySmall),
                data: _agentBars,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _periodSelector() {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      ),
      child: Row(
        children: [
          FilterPill(
            label: 'Today',
            selected: _period == 'today',
            onTap: () => setState(() => _period = 'today'),
          ),
          const SizedBox(width: 6),
          FilterPill(
            label: 'Week',
            selected: _period == 'week',
            onTap: () => setState(() => _period = 'week'),
          ),
          const SizedBox(width: 6),
          FilterPill(
            label: 'Month',
            selected: _period == 'month',
            onTap: () => setState(() => _period = 'month'),
          ),
          const SizedBox(width: 6),
          FilterPill(
            label: 'Custom',
            selected: _period == 'custom',
            onTap: () => setState(() => _period = 'custom'),
          ),
        ],
      ),
    );
  }

  Widget _trendChart(List<CollectionPoint> points) {
    if (points.isEmpty) {
      return const SizedBox(
        height: 160,
        child: Center(child: Text('No data')),
      );
    }
    final max = points
        .map((p) => p.collected > p.expected ? p.collected : p.expected)
        .fold<double>(0, (a, b) => a > b ? a : b);
    final groups = <BarChartGroupData>[
      for (var i = 0; i < points.length; i++)
        BarChartGroupData(
          x: i,
          barRods: [
            BarChartRodData(
              toY: points[i].collected,
              color: i == points.length - 1
                  ? AppColors.primaryDark
                  : AppColors.primary,
              width: 14,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(4)),
            ),
          ],
        ),
    ];
    return SizedBox(
      height: 180,
      child: BarChart(
        BarChartData(
          maxY: max == 0 ? 1 : max * 1.15,
          barGroups: groups,
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 24,
                interval: (points.length / 6).ceilToDouble().clamp(1, 10),
                getTitlesWidget: (v, _) {
                  final i = v.toInt();
                  if (i < 0 || i >= points.length) return const SizedBox.shrink();
                  return Text(
                    points[i].date.substring(points[i].date.length - 2),
                    style: AppTypography.extraTiny,
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _loanStatusDonut(AnalyticsSummary s) {
    final total = s.activeLoans + s.overdueLoans + s.closedLoans;
    if (total == 0) {
      return const SizedBox(
        height: 200,
        child: Center(child: Text('No loans')),
      );
    }
    return Column(
      children: [
        SizedBox(
          height: 200,
          child: Stack(
            alignment: Alignment.center,
            children: [
              PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 56,
                  sections: [
                    PieChartSectionData(
                      value: s.activeLoans.toDouble(),
                      color: AppColors.primary,
                      showTitle: false,
                      radius: 30,
                    ),
                    PieChartSectionData(
                      value: s.overdueLoans.toDouble(),
                      color: AppColors.danger,
                      showTitle: false,
                      radius: 30,
                    ),
                    PieChartSectionData(
                      value: s.closedLoans.toDouble(),
                      color: AppColors.infoBg,
                      showTitle: false,
                      radius: 30,
                    ),
                  ],
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('$total', style: AppTypography.sectionTitle),
                  Text('Loans', style: AppTypography.caption),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        _legend('Active', s.activeLoans, AppColors.primary),
        _legend('Overdue', s.overdueLoans, AppColors.danger),
        _legend('Closed', s.closedLoans, AppColors.info),
      ],
    );
  }

  Widget _legend(String label, int count, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: AppTypography.bodySmall)),
          Text(
            '$count',
            style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _agentBars(List<AgentPerformance> list) {
    if (list.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: Text('No agents'),
      );
    }
    return Column(
      children: [
        for (final a in list)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(a.name, style: AppTypography.bodySmall),
                ),
                Expanded(
                  flex: 6,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (a.hitRate / 100).clamp(0.0, 1.0),
                      minHeight: 8,
                      backgroundColor: AppColors.background,
                      valueColor:
                          const AlwaysStoppedAnimation<Color>(AppColors.primary),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 36,
                  child: Text(
                    '${a.hitRate}%',
                    textAlign: TextAlign.right,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child, this.subtitle});
  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.sectionTitle.copyWith(fontSize: 14)),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(subtitle!, style: AppTypography.caption),
          ],
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
