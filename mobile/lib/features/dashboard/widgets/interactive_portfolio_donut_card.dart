import 'dart:math' as math;
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';

class InteractivePortfolioDonutCard extends StatefulWidget {
  const InteractivePortfolioDonutCard({
    super.key,
    required this.summary,
    required this.fmt,
  });

  final DashboardSummary summary;
  final NumberFormat fmt;

  @override
  State<InteractivePortfolioDonutCard> createState() =>
      _InteractivePortfolioDonutCardState();
}

class _InteractivePortfolioDonutCardState
    extends State<InteractivePortfolioDonutCard> {
  int _touchedRepaymentIndex = -1;
  int _touchedLoanIndex = -1;

  String _formatShort(double value) {
    if (value >= 10000000) {
      return '₹${(value / 10000000).toStringAsFixed(1)}Cr';
    }
    if (value >= 100000) {
      return '₹${(value / 100000).toStringAsFixed(1)}L';
    }
    if (value >= 1000) {
      return '₹${(value / 1000).toStringAsFixed(1)}K';
    }
    return '₹${value.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.summary;

    // Repayment values
    final paid = s.todayCollected;
    final pending = s.todayGap > 0
        ? s.todayGap
        : math.max(0.0, s.todayExpected - s.todayCollected);
    final overdue = s.overdueOutstanding;
    final totalRepayment = paid + pending + overdue;

    // Loan status / Portfolio health values
    final onTrack = s.portfolioHealth.onTrack;
    final withOverdue = s.portfolioHealth.withOverdue;
    final totalHealthLoans = s.portfolioHealth.total;

    final repaymentCard = _buildRepaymentStatusCard(
      paid: paid,
      pending: pending,
      overdue: overdue,
      total: totalRepayment,
    );

    final loansCard = _buildPortfolioHealthCard(
      onTrack: onTrack,
      withOverdue: withOverdue,
      total: totalHealthLoans,
    );

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: repaymentCard),
          const SizedBox(width: 10),
          Expanded(child: loansCard),
        ],
      ),
    );
  }

  Widget _buildRepaymentStatusCard({
    required double paid,
    required double pending,
    required double overdue,
    required double total,
  }) {
    final safeTotal = total > 0 ? total : 1.0;
    final paidPct = ((paid / safeTotal) * 100).round();
    final pendingPct = ((pending / safeTotal) * 100).round();
    final overduePct = math.max(0, 100 - paidPct - pendingPct);

    String centerTop = _formatShort(safeTotal);
    String centerSub = 'Total Dues';

    if (_touchedRepaymentIndex == 0) {
      centerTop = _formatShort(paid);
      centerSub = 'Paid ($paidPct%)';
    } else if (_touchedRepaymentIndex == 1) {
      centerTop = _formatShort(pending);
      centerSub = 'Pending ($pendingPct%)';
    } else if (_touchedRepaymentIndex == 2) {
      centerTop = _formatShort(overdue);
      centerSub = 'Overdue ($overduePct%)';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 34,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Repayment Status',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          const SizedBox(height: 10),
          if (total <= 0)
            SizedBox(
              height: 110,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.pie_chart_outline_rounded,
                      size: 30,
                      color: AppColors.chartExpected,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'No dues',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Center(
              child: SizedBox(
                width: 108,
                height: 108,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    PieChart(
                      PieChartData(
                        pieTouchData: PieTouchData(
                          touchCallback:
                              (FlTouchEvent event, pieTouchResponse) {
                            setState(() {
                              if (!event.isInterestedForInteractions ||
                                  pieTouchResponse == null ||
                                  pieTouchResponse.touchedSection == null) {
                                _touchedRepaymentIndex = -1;
                                return;
                              }
                              _touchedRepaymentIndex = pieTouchResponse
                                  .touchedSection!.touchedSectionIndex;
                            });
                          },
                        ),
                        sectionsSpace: 2.5,
                        centerSpaceRadius: 28,
                        startDegreeOffset: -90,
                        sections: [
                          PieChartSectionData(
                            value: paid > 0 ? paid : 0.001,
                            color: AppColors.chartSuccess,
                            radius: _touchedRepaymentIndex == 0 ? 19 : 14,
                            showTitle: false,
                          ),
                          PieChartSectionData(
                            value: pending > 0 ? pending : 0.001,
                            color: const Color(0xFFF59E0B),
                            radius: _touchedRepaymentIndex == 1 ? 19 : 14,
                            showTitle: false,
                          ),
                          PieChartSectionData(
                            value: overdue > 0 ? overdue : 0.001,
                            color: AppColors.chartOverdue,
                            radius: _touchedRepaymentIndex == 2 ? 19 : 14,
                            showTitle: false,
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 52,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              centerTop,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                                height: 1.1,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              centerSub,
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 12),
          Column(
            children: [
              _LegendRow(
                color: AppColors.chartSuccess,
                label: 'Paid',
                value: _formatShort(paid),
                percent: '$paidPct%',
                isHighlighted: _touchedRepaymentIndex == 0,
              ),
              const SizedBox(height: 5),
              _LegendRow(
                color: const Color(0xFFF59E0B),
                label: 'Pending',
                value: _formatShort(pending),
                percent: '$pendingPct%',
                isHighlighted: _touchedRepaymentIndex == 1,
              ),
              const SizedBox(height: 5),
              _LegendRow(
                color: AppColors.chartOverdue,
                label: 'Overdue',
                value: _formatShort(overdue),
                percent: '$overduePct%',
                isHighlighted: _touchedRepaymentIndex == 2,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPortfolioHealthCard({
    required int onTrack,
    required int withOverdue,
    required int total,
  }) {
    final safeTotal = total > 0 ? total : 1;
    final onTrackPct = ((onTrack / safeTotal) * 100).round();
    final withOverduePct = math.max(0, 100 - onTrackPct);

    String centerTop = '$onTrackPct%';
    String centerSub = 'On Track';

    if (_touchedLoanIndex == 0) {
      centerTop = '$onTrack';
      centerSub = 'On Track ($onTrackPct%)';
    } else if (_touchedLoanIndex == 1) {
      centerTop = '$withOverdue';
      centerSub = 'Overdue ($withOverduePct%)';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 34,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Portfolio Health',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  'By loan status',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                  maxLines: 1,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (total <= 0)
            SizedBox(
              height: 110,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.donut_large_rounded,
                      size: 30,
                      color: AppColors.chartExpected,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'No loans',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Center(
              child: SizedBox(
                width: 108,
                height: 108,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    PieChart(
                      PieChartData(
                        pieTouchData: PieTouchData(
                          touchCallback:
                              (FlTouchEvent event, pieTouchResponse) {
                            setState(() {
                              if (!event.isInterestedForInteractions ||
                                  pieTouchResponse == null ||
                                  pieTouchResponse.touchedSection == null) {
                                _touchedLoanIndex = -1;
                                return;
                              }
                              _touchedLoanIndex = pieTouchResponse
                                  .touchedSection!.touchedSectionIndex;
                            });
                          },
                        ),
                        sectionsSpace: 2.5,
                        centerSpaceRadius: 28,
                        startDegreeOffset: -90,
                        sections: [
                          PieChartSectionData(
                            value: onTrack > 0 ? onTrack.toDouble() : 0.001,
                            color: AppColors.chartSuccess,
                            radius: _touchedLoanIndex == 0 ? 19 : 14,
                            showTitle: false,
                          ),
                          PieChartSectionData(
                            value: withOverdue > 0
                                ? withOverdue.toDouble()
                                : 0.001,
                            color: AppColors.chartOverdue,
                            radius: _touchedLoanIndex == 1 ? 19 : 14,
                            showTitle: false,
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 52,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              centerTop,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                                height: 1.1,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              centerSub,
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 12),
          Column(
            children: [
              _LegendRow(
                color: AppColors.chartSuccess,
                label: 'On Track',
                value: '$onTrack',
                percent: '$onTrackPct%',
                isHighlighted: _touchedLoanIndex == 0,
              ),
              const SizedBox(height: 5),
              _LegendRow(
                color: AppColors.chartOverdue,
                label: 'With Overdue',
                value: '$withOverdue',
                percent: '$withOverduePct%',
                isHighlighted: _touchedLoanIndex == 1,
              ),
              const SizedBox(height: 5),
              // Balance row height with repayment 3-item list
              const Opacity(
                opacity: 0.0,
                child: _LegendRow(
                  color: Colors.transparent,
                  label: '',
                  value: '',
                  percent: '',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({
    required this.color,
    required this.label,
    required this.value,
    required this.percent,
    this.isHighlighted = false,
  });

  final Color color;
  final String label;
  final String value;
  final String percent;
  final bool isHighlighted;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: EdgeInsets.symmetric(
        horizontal: isHighlighted ? 4 : 0,
        vertical: isHighlighted ? 2 : 1,
      ),
      decoration: BoxDecoration(
        color: isHighlighted ? color.withAlpha(20) : Colors.transparent,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isHighlighted ? FontWeight.w700 : FontWeight.w500,
                color: AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            percent.isNotEmpty ? '$value ($percent)' : value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
