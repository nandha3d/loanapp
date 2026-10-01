import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';
import 'package:zolofund/shared/widgets/app_badge.dart';

class TodayScheduleCard extends ConsumerWidget {
  const TodayScheduleCard({
    super.key,
    required this.item,
    required this.onCollect,
  });

  final TodayInstalment item;
  final VoidCallback onCollect;

  Color _statusColor(String status) {
    switch (status) {
      case 'paid':
        return AppColors.success;
      case 'missed':
        return AppColors.danger;
      case 'partial':
        return AppColors.warning;
      default:
        return AppColors.primary;
    }
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.map((p) => p.isEmpty ? '' : p[0]).take(2).join().toUpperCase();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final statusAccent = _statusColor(item.status);

    return Container(
      width: 210,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
          BoxShadow(
            color: AppColors.primary.withAlpha(15),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.primary.withAlpha(35),
              width: 1.2,
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.surface,
                AppColors.primary.withAlpha(10),
              ],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    _ScheduleAvatar(
                      name: item.customerName,
                      initials: _initials(item.customerName),
                      image: (item.customerPhoto != null &&
                              item.customerPhoto!.isNotEmpty)
                          ? authedImage(ref, item.customerPhoto!)
                          : null,
                      statusColor: statusAccent,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            item.customerName,
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 13.5,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (item.loanCode.isNotEmpty)
                            Text(
                              item.loanCode,
                              style: AppTypography.caption.copyWith(
                                fontFamily: 'monospace',
                                color: AppColors.textLight,
                                fontSize: 10.5,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      fmt.format(item.dueAmount),
                      style: AppTypography.sectionTitle.copyWith(
                        color: AppColors.primaryDark,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    AppBadge(
                      label: item.status,
                      kind: _kindFor(item.status),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  height: 34,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: onCollect,
                    child: Text(
                      t.x('btn.collect'),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  BadgeKind _kindFor(String s) {
    switch (s) {
      case 'paid':
        return BadgeKind.active;
      case 'partial':
        return BadgeKind.partial;
      case 'missed':
        return BadgeKind.overdue;
      default:
        return BadgeKind.upcoming;
    }
  }
}

class _ScheduleAvatar extends StatelessWidget {
  const _ScheduleAvatar({
    required this.name,
    required this.initials,
    this.image,
    this.statusColor,
  });

  final String name;
  final String initials;
  final ImageProvider? image;
  final Color? statusColor;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.primary.withAlpha(25),
            border: Border.all(
              color: statusColor != null
                  ? statusColor!.withAlpha(120)
                  : AppColors.primary.withAlpha(80),
              width: 1.5,
            ),
            image: image != null
                ? DecorationImage(image: image!, fit: BoxFit.cover)
                : null,
          ),
          alignment: Alignment.center,
          child: image != null
              ? null
              : Text(
                  initials.isEmpty ? '?' : initials,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.primaryDark,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
        ),
        if (statusColor != null)
          Positioned(
            right: -1,
            bottom: -1,
            child: Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
            ),
          ),
      ],
    );
  }
}
