import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/data/models/analytics.dart';
import 'package:zolofund/data/services/analytics_service.dart';

final dailyCollectionHeatMapPointsProvider =
    FutureProvider.autoDispose<List<CollectionPoint>>((ref) {
  return ref.watch(analyticsServiceProvider).collections(range: 90);
});

class DailyCollectionHeatMapCard extends ConsumerStatefulWidget {
  const DailyCollectionHeatMapCard({super.key});

  @override
  ConsumerState<DailyCollectionHeatMapCard> createState() =>
      _DailyCollectionHeatMapCardState();
}

class _DailyCollectionHeatMapCardState
    extends ConsumerState<DailyCollectionHeatMapCard> {
  void _showDayPopup({
    required BuildContext context,
    required String dayName,
    required String weekName,
    required DateTime date,
    required double collected,
    required double expected,
    required bool isRestDay,
    bool isFuture = false,
  }) {
    final fmt = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );

    final pct = expected > 0
        ? ((collected / expected) * 100).clamp(0.0, 100.0)
        : (collected > 0 ? 100.0 : 0.0);

    Color statusColor;
    String statusTitle;
    String statusDesc;

    if (isFuture) {
      statusColor = const Color(0xFF64748B);
      statusTitle = 'Upcoming Day';
      statusDesc = 'No collections recorded for this future date.';
    } else if (isRestDay) {
      statusColor = const Color(0xFF64748B);
      statusTitle = 'Sunday / Rest Day';
      statusDesc = 'No regular collection schedule assigned for this day.';
    } else if (expected <= 0 && collected <= 0) {
      statusColor = const Color(0xFF64748B);
      statusTitle = 'No Collections Recorded';
      statusDesc =
          'No collection schedule or transactions recorded for this day.';
    } else if (pct >= 80) {
      statusColor = const Color(0xFF22C55E);
      statusTitle = 'High Collection Day';
      statusDesc = 'Exceeded or met the target collection expectations.';
    } else if (pct >= 40) {
      statusColor = const Color(0xFFF59E0B);
      statusTitle = 'Partial Collection';
      statusDesc = 'Some pending EMIs remained uncollected.';
    } else {
      statusColor = const Color(0xFFF43F5E);
      statusTitle = 'Low / Delinquent Collection';
      statusDesc = 'High overdue count reported on this schedule.';
    }

    showDialog<void>(
      context: context,
      builder: (ctx) {
        return Dialog(
          backgroundColor: const Color(0xFF18181B),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: statusColor.withAlpha(80), width: 1.5),
          ),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '$weekName • $dayName',
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withAlpha(40),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        DateFormat('dd MMM yyyy').format(date),
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'Amount Collected',
                  style: TextStyle(
                    color: Color(0xFFE2E8F0),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  collected <= 0 ? '₹0' : fmt.format(collected),
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: statusColor,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF27272A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Target Expected',
                            style: TextStyle(
                              color: AppColors.onInkMuted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            expected <= 0 ? '₹0' : fmt.format(expected),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'Collection Rate',
                            style: TextStyle(
                              color: AppColors.onInkMuted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            expected <= 0 && collected <= 0
                                ? '0%'
                                : '${pct.toStringAsFixed(1)}%',
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.insights_rounded,
                      size: 16,
                      color: statusColor,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '$statusTitle: $statusDesc',
                        style: const TextStyle(
                          color: Color(0xFFA1A1AA),
                          fontSize: 12,
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3F3F46),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text(
                      'Done',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncPoints = ref.watch(dailyCollectionHeatMapPointsProvider);
    final points = asyncPoints.valueOrNull ?? const <CollectionPoint>[];

    if (asyncPoints.hasError && points.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFF18181B),
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
        child: Column(
          children: [
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Overall Collection Heat Map',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Collection heat map temporarily unavailable',
              style:
                  TextStyle(color: Colors.white.withAlpha(160), fontSize: 13),
            ),
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: () =>
                  ref.invalidate(dailyCollectionHeatMapPointsProvider),
              icon: const Icon(
                Icons.refresh,
                size: 16,
                color: Color(0xFFA855F7),
              ),
              label: const Text(
                'Retry',
                style: TextStyle(color: Color(0xFFA855F7)),
              ),
            ),
          ],
        ),
      );
    }

    // Build the 4-5 weeks grid for Mon-Sun
    final daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Map date points by key
    final dateMap = <String, CollectionPoint>{};
    for (final p in points) {
      dateMap[p.date] = p;
    }

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final firstDayOfMonth = DateTime(now.year, now.month, 1);
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0);

    // Monday of the week containing the 1st of the month (weekday: Mon=1..Sun=7)
    final startMonday =
        firstDayOfMonth.subtract(Duration(days: firstDayOfMonth.weekday - 1));
    final totalDays = (firstDayOfMonth.weekday - 1) + lastDayOfMonth.day;
    final totalWeeks = (totalDays / 7.0).ceil();
    final weeks = List.generate(totalWeeks, (i) => 'Week ${i + 1}');

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF18181B),
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: const [
          BoxShadow(
            color: Color(0x35000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Text(
                'Overall Collection Heat Map',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF27272A),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      DateFormat('MMMM yyyy').format(now),
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFA1A1AA),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  InkWell(
                    onTap: () =>
                        ref.invalidate(dailyCollectionHeatMapPointsProvider),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF27272A),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.refresh,
                        size: 14,
                        color: Color(0xFFA1A1AA),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Tap any day tile to view exact collection breakdown',
            style: TextStyle(
              fontSize: 11,
              color: AppColors.onInkMuted,
            ),
          ),
          const SizedBox(height: 18),

          // Column Days Header (Mon Tue Wed Thu Fri Sat Sun)
          Row(
            children: [
              const SizedBox(width: 58), // spacer for Week label
              ...daysOfWeek.map(
                (d) => Expanded(
                  child: Center(
                    child: Text(
                      d,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(
                          0xFFFDE047,
                        ), // Vibrant yellow from image
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Week Rows
          ...List.generate(weeks.length, (weekIdx) {
            final weekName = weeks[weekIdx];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  SizedBox(
                    width: 58,
                    child: Text(
                      weekName,
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF67E8F9), // Vibrant cyan from image
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                  ...List.generate(7, (dayIdx) {
                    final cellDate = DateTime(
                      startMonday.year,
                      startMonday.month,
                      startMonday.day + (weekIdx * 7) + dayIdx,
                    );
                    final isCurrentMonth = cellDate.month == now.month &&
                        cellDate.year == now.year;

                    if (!isCurrentMonth) {
                      return const Expanded(
                        child: Center(
                          child: SizedBox(
                            width: 22,
                            height: 22,
                            child: Center(
                              child: Text(
                                '·',
                                style: TextStyle(
                                  color: Color(0xFF3F3F46),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }

                    final isSunday = dayIdx == 6;
                    final isFuture = cellDate.isAfter(today);
                    final dateKey = DateFormat('yyyy-MM-dd').format(cellDate);

                    final point = dateMap[dateKey];
                    final double exp = point?.expected ?? 0.0;
                    final double col = point?.collected ?? 0.0;

                    Color boxColor;
                    if (isSunday || isFuture || (exp <= 0 && col <= 0)) {
                      boxColor = Colors.transparent;
                    } else {
                      final ratio = exp > 0 ? (col / exp) : 1.0;
                      if (ratio >= 0.8) {
                        boxColor = const Color(0xFF34D399); // Green
                      } else if (ratio >= 0.4) {
                        boxColor = const Color(0xFFFBBF24); // Amber
                      } else {
                        boxColor = const Color(0xFFF43F5E); // Red
                      }
                    }

                    return Expanded(
                      child: Center(
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            _showDayPopup(
                              context: context,
                              dayName: daysOfWeek[dayIdx],
                              weekName: weekName,
                              date: cellDate,
                              collected: col,
                              expected: exp,
                              isRestDay: isSunday,
                              isFuture: isFuture,
                            );
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            width: 28,
                            height: 40,
                            decoration: BoxDecoration(
                              color: boxColor,
                              borderRadius: BorderRadius.circular(4),
                              boxShadow: boxColor != Colors.transparent
                                  ? [
                                      BoxShadow(
                                        color: boxColor.withAlpha(90),
                                        blurRadius: 4,
                                        offset: const Offset(0, 1),
                                      ),
                                    ]
                                  : null,
                            ),
                            alignment: Alignment.center,
                            child:
                                isSunday || isFuture || (exp <= 0 && col <= 0)
                                    ? const Text(
                                        '-',
                                        style: TextStyle(
                                          color: AppColors.onInkMuted,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      )
                                    : null,
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            );
          }),

          const SizedBox(height: 8),
          // Heat Map Scale Legend
          Wrap(
            alignment: WrapAlignment.end,
            runSpacing: 8,
            children: [
              const Text(
                'Low',
                style: TextStyle(fontSize: 10, color: AppColors.onInkMuted),
              ),
              const SizedBox(width: 5),
              _scaleDot(const Color(0xFFF43F5E)),
              const SizedBox(width: 4),
              _scaleDot(const Color(0xFFFBBF24)),
              const SizedBox(width: 4),
              _scaleDot(const Color(0xFF34D399)),
              const SizedBox(width: 5),
              const Text(
                'High',
                style: TextStyle(fontSize: 10, color: AppColors.onInkMuted),
              ),
              const SizedBox(width: 12),
              const Text(
                '- Off',
                style: TextStyle(fontSize: 10, color: AppColors.onInkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _scaleDot(Color color) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}
