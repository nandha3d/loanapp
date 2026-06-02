import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/analytics.dart';
import 'package:loantrack/data/services/analytics_service.dart';
import 'package:loantrack/features/dashboard/widgets/kpi_card.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _summaryProvider = FutureProvider.autoDispose<AnalyticsSummary>((ref) {
  return ref.watch(analyticsServiceProvider).summary();
});

final _collectionsProvider =
    FutureProvider.autoDispose<List<CollectionPoint>>((ref) {
  return ref.watch(analyticsServiceProvider).collections();
});

final _agentsProvider =
    FutureProvider.autoDispose<List<AgentPerformance>>((ref) {
  return ref.watch(analyticsServiceProvider).agents();
});

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = ref.watch(currencyFmtProvider);
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar:
          AppBar(title: Text(t.x('title.analytics')), centerTitle: true),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(_summaryProvider);
          ref.invalidate(_collectionsProvider);
          ref.invalidate(_agentsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ref.watch(_summaryProvider).when(
                  loading: () => const _KpiSkeleton(),
                  error: (e, _) => _ErrorCard(message: e.toString()),
                  data: (s) => _SummaryKpis(summary: s, fmt: fmt),
                ),
            const SizedBox(height: 16),
            ref.watch(_collectionsProvider).when(
                  loading: () => const Skeleton(
                      height: 220, borderRadius: AppTokens.radius,),
                  error: (e, _) => _ErrorCard(message: e.toString()),
                  data: (pts) => _CollectionChart(points: pts),
                ),
            const SizedBox(height: 16),
            ref.watch(_agentsProvider).when(
                  loading: () => const Skeleton(
                      height: 180, borderRadius: AppTokens.radius,),
                  error: (e, _) => _ErrorCard(message: e.toString()),
                  data: (agents) => _AgentLeaderboard(agents: agents, fmt: fmt),
                ),
            const SizedBox(height: 16),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/analytics'),
    );
  }
}

class _SummaryKpis extends ConsumerWidget {
  const _SummaryKpis({required this.summary, required this.fmt});
  final AnalyticsSummary summary;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final eff = summary.efficiency.toStringAsFixed(1);
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: KpiCard(
                icon: Icons.trending_up,
                value: '${summary.activeLoans}',
                label: t.x('dash.active_loans'),
                tone: KpiTone.blue,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: KpiCard(
                icon: Icons.warning_amber_rounded,
                value: '${summary.overdueLoans}',
                label: t.x('status.overdue'),
                tone: KpiTone.red,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: KpiCard(
                icon: Icons.account_balance_wallet,
                value: fmt.format(summary.monthCollected),
                label: t.x('an.month_collected'),
                tone: KpiTone.green,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: KpiCard(
                icon: Icons.percent,
                value: '$eff%',
                label: t.x('an.efficiency'),
                tone: KpiTone.orange,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _CollectionChart extends ConsumerWidget {
  const _CollectionChart({required this.points});
  final List<CollectionPoint> points;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    if (points.isEmpty) {
      return Container(
        height: 180,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
        ),
        child: EmptyState(
            icon: Icons.bar_chart_outlined, title: t.x('an.no_data_yet'),),
      );
    }

    double maxY = 100;
    for (final p in points) {
      if (p.expected > maxY) maxY = p.expected;
      if (p.collected > maxY) maxY = p.collected;
    }
    maxY *= 1.2;

    final expectedSpots = <FlSpot>[];
    final collectedSpots = <FlSpot>[];
    final labels = <String>[];
    for (var i = 0; i < points.length; i++) {
      final p = points[i];
      expectedSpots.add(FlSpot(i.toDouble(), p.expected));
      collectedSpots.add(FlSpot(i.toDouble(), p.collected));
      final parts = p.date.split('-');
      labels.add(parts.length >= 3 ? parts[2] : p.date);
    }

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
          Row(
            children: [
              Text(t.x('an.collection_trend'),
                  style: AppTypography.sectionTitle,),
              const Spacer(),
              _Legend(color: const Color(0xFFCBD5E1), label: t.x('an.expected')),
              const SizedBox(width: 12),
              _Legend(color: AppColors.primary, label: t.x('an.collected')),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 160,
            child: LineChart(
              LineChartData(
                maxY: maxY,
                minY: 0,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) =>
                      const FlLine(color: Color(0xFFE2E8F0), strokeWidth: 1),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 1,
                      reservedSize: 22,
                      getTitlesWidget: (value, _) {
                        final idx = value.toInt();
                        if (idx < 0 || idx >= labels.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child:
                              Text(labels[idx], style: AppTypography.extraTiny),
                        );
                      },
                    ),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: expectedSpots,
                    isCurved: true,
                    color: const Color(0xFFCBD5E1),
                    barWidth: 2,
                    dotData: const FlDotData(show: false),
                    dashArray: [5, 4],
                  ),
                  LineChartBarData(
                    spots: collectedSpots,
                    isCurved: true,
                    color: AppColors.primary,
                    barWidth: 2.5,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: const Color(0x14F5A623),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(width: 16, height: 2.5, color: color),
          const SizedBox(width: 4),
          Text(label, style: AppTypography.caption),
        ],
      );
}

class _AgentLeaderboard extends ConsumerWidget {
  const _AgentLeaderboard({required this.agents, required this.fmt});
  final List<AgentPerformance> agents;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    if (agents.isEmpty) {
      return Container(
        height: 120,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
        ),
        child: EmptyState(
            icon: Icons.leaderboard_outlined, title: t.x('an.no_agent_data'),),
      );
    }

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
          Text(t.x('an.agent_leaderboard'),
              style: AppTypography.sectionTitle,),
          const SizedBox(height: 16),
          ...agents.asMap().entries.map(
                (e) => _AgentRow(rank: e.key + 1, agent: e.value, fmt: fmt),
              ),
        ],
      ),
    );
  }
}

class _AgentRow extends ConsumerWidget {
  const _AgentRow({required this.rank, required this.agent, required this.fmt});
  final int rank;
  final AgentPerformance agent;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final pct = agent.expected > 0
        ? (agent.collected / agent.expected).clamp(0.0, 1.0)
        : 0.0;

    Color rankColor;
    if (rank == 1) {
      rankColor = const Color(0xFFFFD700);
    } else if (rank == 2) {
      rankColor = const Color(0xFFC0C0C0);
    } else if (rank == 3) {
      rankColor = const Color(0xFFCD7F32);
    } else {
      rankColor = AppColors.textLight;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: rankColor.withAlpha(38),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '$rank',
                style: AppTypography.label.copyWith(color: rankColor),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        agent.name,
                        style: AppTypography.bodyLarge,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      fmt.format(agent.collected),
                      style: AppTypography.label
                          .copyWith(color: AppColors.success),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: pct,
                    backgroundColor: AppColors.border,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(AppColors.primary),
                    minHeight: 4,
                  ),
                ),
                const SizedBox(height: 3),
                Text('${agent.hitRate}% ${t.x('an.hit_rate')}',
                    style: AppTypography.caption,),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiSkeleton extends StatelessWidget {
  const _KpiSkeleton();

  @override
  Widget build(BuildContext context) => const Column(
        children: [
          Row(
            children: [
              Expanded(
                  child: Skeleton(height: 80, borderRadius: AppTokens.radius),),
              SizedBox(width: 12),
              Expanded(
                  child: Skeleton(height: 80, borderRadius: AppTokens.radius),),
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: Skeleton(height: 80, borderRadius: AppTokens.radius),),
              SizedBox(width: 12),
              Expanded(
                  child: Skeleton(height: 80, borderRadius: AppTokens.radius),),
            ],
          ),
        ],
      );
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.dangerBg,
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
        child: Text(
          message,
          style: AppTypography.body.copyWith(color: AppColors.danger),
        ),
      );
}
