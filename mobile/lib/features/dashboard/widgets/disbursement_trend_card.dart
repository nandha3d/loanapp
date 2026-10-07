import 'dart:math' as math;
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';

class DisbursementTrendCard extends StatefulWidget {
  const DisbursementTrendCard({
    super.key,
    required this.summary,
  });

  final DashboardSummary summary;

  @override
  State<DisbursementTrendCard> createState() => _DisbursementTrendCardState();
}

class _DisbursementTrendCardState extends State<DisbursementTrendCard> {
  int _touchedBarIndex = -1;
  final _chartScrollController = ScrollController();

  @override
  void dispose() {
    _chartScrollController.dispose();
    super.dispose();
  }

  String _fmtShort(double v) {
    if (v >= 10000000) return '${(v / 10000000).toStringAsFixed(1)}Cr';
    if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }

  @override
  Widget build(BuildContext context) {
    final months = widget.summary.cashFlow;
    final hasData = months.isNotEmpty &&
        months.any((m) => m.disbursed > 0 || m.collected > 0);

    double maxVal = 100000.0;
    if (hasData) {
      for (final m in months) {
        if (m.disbursed > maxVal) maxVal = m.disbursed;
        if (m.collected > maxVal) maxVal = m.collected;
      }
    }
    final maxY = maxVal * 1.35;

    return Container(
      clipBehavior: Clip.hardEdge,
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
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Disbursement & Cash Flow',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Last 6 months cash book',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.rowHover,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '6M',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _CashFlowLegend(
                color: AppColors.chartCollected,
                label: 'Disbursed',
              ),
              _CashFlowLegend(
                color: AppColors.chartSuccess,
                label: 'Collected',
              ),
            ],
          ),
          const SizedBox(height: 20),
          if (!hasData)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 36),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.bar_chart_rounded,
                      size: 36,
                      color: AppColors.chartExpected,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'No disbursement activity in this range',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            SizedBox(
              height: 220,
              child: LayoutBuilder(builder: (context, constraints) {
                final scale = MediaQuery.textScalerOf(context).scale(1);
                var monthWidth = 64 * scale;
                for (final month in months) {
                  final painter = TextPainter(
                    text: TextSpan(
                      text: month.label,
                      style: DefaultTextStyle.of(context).style.copyWith(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    textScaler: MediaQuery.textScalerOf(context),
                    textDirection: Directionality.of(context),
                  )..layout();
                  monthWidth = math.max(monthWidth, painter.width + 16);
                  painter.dispose();
                }
                final chartWidth = math.max(
                  constraints.maxWidth,
                  months.length * monthWidth + 48 * scale,
                );
                return Scrollbar(
                  controller: _chartScrollController,
                  thumbVisibility: true,
                  child: SingleChildScrollView(
                    controller: _chartScrollController,
                    scrollDirection: Axis.horizontal,
                    child: SizedBox(
                      width: chartWidth,
                      child: BarChart(
                        BarChartData(
                          alignment: BarChartAlignment.spaceAround,
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
                          barTouchData: BarTouchData(
                            enabled: true,
                            touchCallback:
                                (FlTouchEvent event, barTouchResponse) {
                              setState(() {
                                if (!event.isInterestedForInteractions ||
                                    barTouchResponse == null ||
                                    barTouchResponse.spot == null) {
                                  _touchedBarIndex = -1;
                                  return;
                                }
                                _touchedBarIndex =
                                    barTouchResponse.spot!.touchedBarGroupIndex;
                              });
                            },
                            touchTooltipData: BarTouchTooltipData(
                              fitInsideHorizontally: true,
                              fitInsideVertically: true,
                              tooltipRoundedRadius: 8,
                              getTooltipColor: (_) => AppColors.ink,
                              getTooltipItem:
                                  (group, groupIndex, rod, rodIndex) {
                                final item = months[groupIndex];
                                return BarTooltipItem(
                                  '${item.label}\nDisbursed: ₹${_fmtShort(item.disbursed)}\nCollected: ₹${_fmtShort(item.collected)}',
                                  const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 11,
                                  ),
                                );
                              },
                            ),
                          ),
                          titlesData: FlTitlesData(
                            leftTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                reservedSize: 48 *
                                    MediaQuery.textScalerOf(context).scale(1),
                                interval: maxY > 0 ? (maxY / 4) : 100000,
                                getTitlesWidget: (val, _) {
                                  if (val == 0) return const SizedBox.shrink();
                                  return Padding(
                                    padding: const EdgeInsets.only(right: 4),
                                    child: Text(
                                      _fmtShort(val),
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
                            rightTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                            topTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                            bottomTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                reservedSize: 32 *
                                    MediaQuery.textScalerOf(context).scale(1),
                                getTitlesWidget: (value, _) {
                                  final idx = value.toInt();
                                  if (idx < 0 || idx >= months.length) {
                                    return const SizedBox.shrink();
                                  }
                                  return Padding(
                                    padding: const EdgeInsets.only(top: 6),
                                    child: Text(
                                      months[idx].label,
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: _touchedBarIndex == idx
                                            ? FontWeight.w800
                                            : FontWeight.w600,
                                        color: _touchedBarIndex == idx
                                            ? AppColors.chartCollected
                                            : AppColors.textSecondary,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                          barGroups: List.generate(months.length, (i) {
                            final isTouched = _touchedBarIndex == i;
                            final item = months[i];
                            return BarChartGroupData(
                              x: i,
                              showingTooltipIndicators: isTouched ? [0] : [],
                              barRods: [
                                BarChartRodData(
                                  toY: item.disbursed,
                                  color: isTouched
                                      ? AppColors.chartCollected
                                      : AppColors.chartCollected,
                                  width: months.length > 6 ? 8 : 12,
                                  borderRadius: const BorderRadius.vertical(
                                    top: Radius.circular(4),
                                  ),
                                ),
                                BarChartRodData(
                                  toY: item.collected,
                                  color: isTouched
                                      ? AppColors.chartSuccess
                                      : AppColors.chartSuccess,
                                  width: months.length > 6 ? 8 : 12,
                                  borderRadius: const BorderRadius.vertical(
                                    top: Radius.circular(4),
                                  ),
                                ),
                              ],
                            );
                          }),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
        ],
      ),
    );
  }
}

class _CashFlowLegend extends StatelessWidget {
  const _CashFlowLegend({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
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
