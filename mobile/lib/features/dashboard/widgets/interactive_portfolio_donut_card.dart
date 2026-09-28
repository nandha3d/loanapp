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
    final paid = s.todayCollected > 0
        ? s.todayCollected
        : (s.totalCollectedAllTime > 0 ? s.totalCollectedAllTime : 0.0);
    final pending = math.max(0.0, s.todayExpected - s.todayCollected);
    final overdue = s.overdueOutstanding;
    final totalRepayment = paid + pending + overdue;

    // Loan status values
    final active = s.activeLoans;
    final overdueLoan = s.overdueLoans;
    final completed = math.max(0, s.totalCustomers - (active + overdueLoan));
    final totalLoans = active + overdueLoan + completed;

    final isWide = MediaQuery.sizeOf(context).width >= 620;

    final repaymentCard = _buildRepaymentStatusCard(
      paid: paid,
      pending: pending,
      overdue: overdue,
      total: totalRepayment > 0
          ? totalRepayment
          : (s.totalDisbursed > 0 ? s.totalDisbursed : 1.0),
    );

    final loansCard = _buildLoansStatusCard(
      active: active,
      completed: completed > 0 ? completed : math.max(1, (active * 1.5).round()),
      overdue: overdueLoan,
      total: totalLoans > 0
          ? totalLoans
          : (active + overdueLoan + math.max(1, (active * 1.5).round())),
    );

    if (isWide) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: repaymentCard),
          const SizedBox(width: 14),
          Expanded(child: loansCard),
        ],
      );
    }

    return Column(
      children: [
        repaymentCard,
        const SizedBox(height: 14),
        loansCard,
      ],
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
    String centerSub = 'Total Lent';

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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border.withAlpha(80)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Portfolio by Repayment Status',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              // Interactive Donut Chart with Center Text
              SizedBox(
                width: 130,
                height: 130,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    PieChart(
                      PieChartData(
                        pieTouchData: PieTouchData(
                          touchCallback: (FlTouchEvent event, pieTouchResponse) {
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
                        sectionsSpace: 3,
                        centerSpaceRadius: 36,
                        startDegreeOffset: -90,
                        sections: [
                          PieChartSectionData(
                            value: paid > 0 ? paid : 0.001,
                            color: const Color(0xFF10B981),
                            radius: _touchedRepaymentIndex == 0 ? 25 : 18,
                            showTitle: false,
                          ),
                          PieChartSectionData(
                            value: pending > 0 ? pending : 0.001,
                            color: const Color(0xFFF59E0B),
                            radius: _touchedRepaymentIndex == 1 ? 25 : 18,
                            showTitle: false,
                          ),
                          PieChartSectionData(
                            value: overdue > 0 ? overdue : 0.001,
                            color: const Color(0xFFEF4444),
                            radius: _touchedRepaymentIndex == 2 ? 25 : 18,
                            showTitle: false,
                          ),
                        ],
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          centerTop,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          centerSub,
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              // Right-side Legend
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _LegendRow(
                      color: const Color(0xFF10B981),
                      label: 'Paid',
                      value: _formatShort(paid),
                      percent: '$paidPct%',
                      isHighlighted: _touchedRepaymentIndex == 0,
                    ),
                    const SizedBox(height: 10),
                    _LegendRow(
                      color: const Color(0xFFF59E0B),
                      label: 'Pending',
                      value: _formatShort(pending),
                      percent: '$pendingPct%',
                      isHighlighted: _touchedRepaymentIndex == 1,
                    ),
                    const SizedBox(height: 10),
                    _LegendRow(
                      color: const Color(0xFFEF4444),
                      label: 'Overdue',
                      value: _formatShort(overdue),
                      percent: '$overduePct%',
                      isHighlighted: _touchedRepaymentIndex == 2,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLoansStatusCard({
    required int active,
    required int completed,
    required int overdue,
    required int total,
  }) {
    final safeTotal = total > 0 ? total : 1;
    final activePct = ((active / safeTotal) * 100).round();
    final completedPct = ((completed / safeTotal) * 100).round();
    final overduePct = math.max(0, 100 - activePct - completedPct);

    String centerTop = '$safeTotal';
    String centerSub = 'Total Loans';

    if (_touchedLoanIndex == 0) {
      centerTop = '$active';
      centerSub = 'Active ($activePct%)';
    } else if (_touchedLoanIndex == 1) {
      centerTop = '$completed';
      centerSub = 'Completed ($completedPct%)';
    } else if (_touchedLoanIndex == 2) {
      centerTop = '$overdue';
      centerSub = 'Overdue ($overduePct%)';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border.withAlpha(80)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Loans by Status',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              // Interactive Donut Chart with Center Text
              SizedBox(
                width: 130,
                height: 130,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    PieChart(
                      PieChartData(
                        pieTouchData: PieTouchData(
                          touchCallback: (FlTouchEvent event, pieTouchResponse) {
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
                        sectionsSpace: 3,
                        centerSpaceRadius: 36,
                        startDegreeOffset: -90,
                        sections: [
                          PieChartSectionData(
                            value: active > 0 ? active.toDouble() : 0.001,
                            color: const Color(0xFF8B5CF6),
                            radius: _touchedLoanIndex == 0 ? 25 : 18,
                            showTitle: false,
                          ),
                          PieChartSectionData(
                            value: completed > 0 ? completed.toDouble() : 0.001,
                            color: const Color(0xFF0284C7),
                            radius: _touchedLoanIndex == 1 ? 25 : 18,
                            showTitle: false,
                          ),
                          PieChartSectionData(
                            value: overdue > 0 ? overdue.toDouble() : 0.001,
                            color: const Color(0xFFEF4444),
                            radius: _touchedLoanIndex == 2 ? 25 : 18,
                            showTitle: false,
                          ),
                        ],
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          centerTop,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          centerSub,
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              // Right-side Legend
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _LegendRow(
                      color: const Color(0xFF8B5CF6),
                      label: 'Active',
                      value: '$active',
                      percent: '$activePct%',
                      isHighlighted: _touchedLoanIndex == 0,
                    ),
                    const SizedBox(height: 10),
                    _LegendRow(
                      color: const Color(0xFF0284C7),
                      label: 'Completed',
                      value: '$completed',
                      percent: '$completedPct%',
                      isHighlighted: _touchedLoanIndex == 1,
                    ),
                    const SizedBox(height: 10),
                    _LegendRow(
                      color: const Color(0xFFEF4444),
                      label: 'Overdue',
                      value: '$overdue',
                      percent: '$overduePct%',
                      isHighlighted: _touchedLoanIndex == 2,
                    ),
                  ],
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
        horizontal: isHighlighted ? 6 : 0,
        vertical: isHighlighted ? 3 : 0,
      ),
      decoration: BoxDecoration(
        color: isHighlighted ? color.withAlpha(20) : Colors.transparent,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isHighlighted ? FontWeight.w700 : FontWeight.w500,
                color: const Color(0xFF334155),
              ),
            ),
          ),
          Text(
            '$value ($percent)',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}
