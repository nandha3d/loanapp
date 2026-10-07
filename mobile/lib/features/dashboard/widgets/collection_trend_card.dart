import 'dart:math' as math;
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/analytics.dart';
import 'package:zolofund/data/services/analytics_service.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

final trendRangeProvider = StateProvider<int>((ref) => 7);

final _trendProvider = FutureProvider.autoDispose<List<CollectionPoint>>((ref) {
  final range = ref.watch(trendRangeProvider);
  return ref.watch(analyticsServiceProvider).collections(range: range);
});

class CollectionTrendCard extends ConsumerWidget {
  const CollectionTrendCard({super.key, this.responsive = false});
  final bool responsive;

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
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                'Collection Trend',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const _RangePicker(),
            ],
          ),
          const SizedBox(height: 12),
          // Legend row with Expected, Collected, Overdue
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _LineLegend(
                color: AppColors.chartExpected,
                label: 'Expected',
                isDashed: true,
              ),
              _LineLegend(
                color: AppColors.chartCollected,
                label: 'Collected',
              ),
              _LineLegend(
                color: AppColors.chartOverdue,
                label: 'Overdue',
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 220,
            child: asyncPoints.when(
              loading: () =>
                  const Skeleton(height: 220, borderRadius: AppTokens.radius),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Could not load collection trend',
                      style: AppTypography.caption
                          .copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    TextButton.icon(
                      onPressed: () => ref.invalidate(_trendProvider),
                      icon: Icon(
                        Icons.refresh,
                        size: 16,
                          color: AppColors.accent,
                      ),
                      label: Text(
                        'Retry',
                        style: TextStyle(color: AppColors.accent),
                      ),
                    ),
                  ],
                ),
              ),
              data: (points) => _InteractiveChart(points: points, t: t),
            ),
          ),
        ],
      ),
    );
  }
}

class _RangePicker extends ConsumerWidget {
  const _RangePicker();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final range = ref.watch(trendRangeProvider);
    final options = [
      (label: '7D', value: 7),
      (label: '30D', value: 30),
      (label: '90D', value: 90),
      (label: '1Y', value: 365),
    ];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.rowHover,
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.all(3),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: options.map((opt) {
          final isSelected = range == opt.value;
          return GestureDetector(
            onTap: () =>
                ref.read(trendRangeProvider.notifier).state = opt.value,
            child: Semantics(
              button: true,
              selected: isSelected,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                alignment: Alignment.center,
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.chartCollected
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: AppColors.chartCollected.withAlpha(80),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Text(
                  opt.label,
                  style: TextStyle(
                    color: isSelected
                        ? (AppColors.isDark ? AppColors.ink : Colors.white)
                        : AppColors.textSecondary,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                    fontSize: 11.5,
                  ),
                ),
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}

class _LineLegend extends StatelessWidget {
  const _LineLegend({
    required this.color,
    required this.label,
    this.isDashed = false,
  });

  final Color color;
  final String label;
  final bool isDashed;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 16,
          height: 3,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _InteractiveChart extends StatelessWidget {
  const _InteractiveChart({required this.points, required this.t});
  final List<CollectionPoint> points;
  final T t;

  String _fmtVal(double v) {
    if (v >= 10000000) return '${(v / 10000000).toStringAsFixed(1)}Cr';
    if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) {
      return EmptyState(
        icon: Icons.bar_chart_outlined,
        title: t.x('an.no_data_yet'),
      );
    }

    double maxY = 100;
    for (final p in points) {
      if (p.expected > maxY) maxY = p.expected;
      if (p.collected > maxY) maxY = p.collected;
      if (p.overdue > maxY) maxY = p.overdue;
    }
    maxY *= 1.25;

    final expectedSpots = <FlSpot>[];
    final collectedSpots = <FlSpot>[];
    final overdueSpots = <FlSpot>[];
    final labels = <String>[];

    for (var i = 0; i < points.length; i++) {
      final p = points[i];
      expectedSpots.add(FlSpot(i.toDouble(), p.expected));
      collectedSpots.add(FlSpot(i.toDouble(), p.collected));
      overdueSpots.add(FlSpot(i.toDouble(), p.overdue));
      final parts = p.date.split('-');
      labels.add(parts.length >= 3 ? parts[2] : p.date);
    }

    final interval = points.length > 90
        ? (points.length / 6).ceil().toDouble()
        : (points.length > 30 ? 7.0 : (points.length > 7 ? 3.0 : 1.0));

    return LayoutBuilder(builder: (context, constraints) {
      final scale = MediaQuery.textScalerOf(context).scale(1);
      final labelCount = ((constraints.maxWidth - 48 * scale) / (36 * scale))
          .floor()
          .clamp(1, 6);
      final titleInterval =
          math.max(interval, ((points.length - 1) / labelCount).ceilToDouble());
      return LineChart(
        LineChartData(
          clipData: const FlClipData.all(),
          maxY: maxY,
          minY: 0,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) => FlLine(
              color: AppColors.chartGrid,
              strokeWidth: 1,
            ),
          ),
          borderData: FlBorderData(show: false),
          lineTouchData: LineTouchData(
            handleBuiltInTouches: true,
            touchTooltipData: LineTouchTooltipData(
              fitInsideHorizontally: true,
              fitInsideVertically: true,
              tooltipRoundedRadius: 8,
              getTooltipColor: (_) => AppColors.ink,
              getTooltipItems: (touchedSpots) {
                return touchedSpots.map((spot) {
                  final idx = spot.barIndex;
                  final name = idx == 0
                      ? 'Expected'
                      : (idx == 1 ? 'Collected' : 'Overdue');
                  final col = idx == 0
                      ? AppColors.chartExpected
                      : (idx == 1
                          ? const Color(0xFFA78BFA)
                          : const Color(0xFFF87171));
                  return LineTooltipItem(
                    '$name: ₹${_fmtVal(spot.y)}',
                    TextStyle(
                      color: col,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                    ),
                  );
                }).toList();
              },
            ),
            getTouchedSpotIndicator: (data, spots) => spots.map((_) {
              return TouchedSpotIndicatorData(
                const FlLine(
                  color: Color(0xFFCBD5E1),
                  strokeWidth: 1.5,
                  dashArray: [4, 4],
                ),
                FlDotData(
                  show: true,
                  getDotPainter: (spot, pct, bar, idx) => FlDotCirclePainter(
                    radius: 4.5,
                    color: bar.color ?? AppColors.chartCollected,
                    strokeWidth: 2,
                    strokeColor: Colors.white,
                  ),
                ),
              );
            }).toList(),
          ),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 48 * MediaQuery.textScalerOf(context).scale(1),
                interval: maxY > 0 ? (maxY / 4) : 20,
                getTitlesWidget: (value, meta) {
                  if (value == 0) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: Text(
                      _fmtVal(value),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.chartExpected,
                      ),
                      textAlign: TextAlign.right,
                    ),
                  );
                },
              ),
            ),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: titleInterval,
                reservedSize: 32 * MediaQuery.textScalerOf(context).scale(1),
                getTitlesWidget: (value, _) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= labels.length) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      labels[idx],
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          lineBarsData: [
            // 0. Expected Line (Dashed)
            LineChartBarData(
              spots: expectedSpots,
              isCurved: true,
              curveSmoothness: 0.35,
              preventCurveOverShooting: true,
              color: AppColors.chartExpected,
              barWidth: 2,
              dotData: FlDotData(
                show: points.length <= 15,
                getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(
                  radius: 2.5,
                  color: AppColors.chartExpected,
                  strokeWidth: 0,
                ),
              ),
              dashArray: [5, 4],
            ),
            // 1. Collected Line (Solid brand purple + gradient fill)
            LineChartBarData(
              spots: collectedSpots,
              isCurved: true,
              curveSmoothness: 0.35,
              preventCurveOverShooting: true,
              color: AppColors.chartCollected,
              barWidth: 2.8,
              dotData: FlDotData(
                show: points.length <= 15,
                getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(
                  radius: 3,
                  color: AppColors.chartCollected,
                  strokeWidth: 1.5,
                  strokeColor: Colors.white,
                ),
              ),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.chartCollected.withAlpha(55),
                    AppColors.chartCollected.withAlpha(3),
                  ],
                ),
              ),
            ),
            // 2. Overdue Line (Solid red + soft gradient fill)
            LineChartBarData(
              spots: overdueSpots,
              isCurved: true,
              curveSmoothness: 0.35,
              preventCurveOverShooting: true,
              color: AppColors.chartOverdue,
              barWidth: 2.2,
              dotData: FlDotData(
                show: points.length <= 15,
                getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(
                  radius: 2.5,
                  color: AppColors.chartOverdue,
                  strokeWidth: 1.5,
                  strokeColor: Colors.white,
                ),
              ),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.chartOverdue.withAlpha(35),
                    AppColors.chartOverdue.withAlpha(0),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    });
  }
}
