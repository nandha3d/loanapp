import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/analytics.dart';
import 'package:loantrack/data/services/analytics_service.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final trendRangeProvider = StateProvider<int>((ref) => 7);

final _trendProvider = FutureProvider.autoDispose<List<CollectionPoint>>((ref) {
  final range = ref.watch(trendRangeProvider);
  return ref.watch(analyticsServiceProvider).collections(range: range);
});

class CollectionTrendCard extends ConsumerWidget {
  const CollectionTrendCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final asyncPoints = ref.watch(_trendProvider);

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
              Text(t.x('an.collection_trend'), style: AppTypography.sectionTitle),
              const Spacer(),
              _RangePicker(),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _Legend(color: const Color(0xFFCBD5E1), label: t.x('an.expected')),
              const SizedBox(width: 12),
              _Legend(color: AppColors.primary, label: t.x('an.collected')),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 160,
            child: asyncPoints.when(
              loading: () => const Skeleton(height: 160, borderRadius: AppTokens.radius),
              error: (e, _) => Center(
                child: Text(e.toString(), style: AppTypography.caption.copyWith(color: AppColors.danger)),
              ),
              data: (points) => _Chart(points: points, t: t),
            ),
          ),
        ],
      ),
    );
  }
}

class _RangePicker extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final range = ref.watch(trendRangeProvider);
    return Row(
      children: [7, 30, 90].map((r) {
        final isSelected = range == r;
        return GestureDetector(
          onTap: () => ref.read(trendRangeProvider.notifier).state = r,
          child: Container(
            margin: const EdgeInsets.only(left: 6),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected ? AppColors.primary : AppColors.border,
              ),
            ),
            child: Text(
              '${r}d',
              style: AppTypography.caption.copyWith(
                color: isSelected ? Colors.white : AppColors.textSecondary,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        );
      }).toList(growable: false),
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

class _Chart extends StatelessWidget {
  const _Chart({required this.points, required this.t});
  final List<CollectionPoint> points;
  final T t;

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) {
      return EmptyState(icon: Icons.bar_chart_outlined, title: t.x('an.no_data_yet'));
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

    return LineChart(
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
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: points.length > 30 ? 7 : (points.length > 7 ? 3 : 1),
              reservedSize: 22,
              getTitlesWidget: (value, _) {
                final idx = value.toInt();
                if (idx < 0 || idx >= labels.length) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(labels[idx], style: AppTypography.extraTiny),
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
    );
  }
}
