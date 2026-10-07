import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';

class OverdueAgingCard extends StatelessWidget {
  const OverdueAgingCard({
    super.key,
    required this.summary,
    required this.fmt,
  });

  final DashboardSummary summary;
  final NumberFormat fmt;

  static List<Color> get _bucketColors => [
        AppColors.chartSuccess,
        const Color(0xFFF59E0B),
        const Color(0xFFF97316),
        AppColors.chartOverdue,
        AppColors.isDark ? const Color(0xFFFDA4AF) : const Color(0xFF991B1B),
        AppColors.isDark ? const Color(0xFFC4B5FD) : const Color(0xFF7F1D1D),
      ];

  List<({String label, double amount, Color color, int count})> _getBuckets() {
    if (summary.overdueAgeing.isEmpty) return const [];
    return summary.overdueAgeing.asMap().entries.map((entry) {
      final i = entry.key;
      final b = entry.value;
      return (
        label: b.label,
        amount: b.amount,
        color: _bucketColors[i % _bucketColors.length],
        count: b.count,
      );
    }).toList(growable: false);
  }

  void _showBucketDetail(
    BuildContext context,
    ({String label, double amount, Color color, int count}) bucket,
    double totalOverdue,
  ) {
    final pct = totalOverdue > 0
        ? ((bucket.amount / totalOverdue) * 100).toStringAsFixed(1)
        : '0.0';

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: bucket.color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Overdue Aging: ${bucket.label}',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: bucket.color.withAlpha(20),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: bucket.color.withAlpha(60)),
                ),
                child: Wrap(
                  spacing: 20,
                  runSpacing: 16,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Delinquent Amount',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          fmt.format(bucket.amount),
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: bucket.color,
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Total Share',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$pct%',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 16,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Impacts ${bucket.count} active accounts. Regular collection and reminder calls recommended.',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text(
                    'Close',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final buckets = _getBuckets();
    final maxAmount = buckets.fold<double>(
      1.0,
      (m, b) => b.amount > m ? b.amount : m,
    );
    final totalOverdue = buckets.fold<double>(0.0, (s, b) => s + b.amount);

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
          Text(
            'Overdue Aging',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 18),
          if (buckets.isEmpty || totalOverdue <= 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Column(
                  children: [
                    const Icon(
                      Icons.check_circle_outline_rounded,
                      size: 36,
                      color: AppColors.success,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'No overdue instalments',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            ...buckets.map((b) {
              final fillRatio = (b.amount / maxAmount).clamp(0.08, 1.0);
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => _showBucketDetail(context, b, totalOverdue),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            // Label (e.g. "0 – 7 days")
                            Expanded(
                              child: Text(
                                b.label,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            // Amount
                            Flexible(
                              child: Text(
                                fmt.format(b.amount),
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                                textAlign: TextAlign.right,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: fillRatio,
                            minHeight: 16,
                            color: b.color,
                            backgroundColor: AppColors.chartGrid,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
