import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/dashboard_summary.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class TodayScheduleCard extends ConsumerWidget {
  const TodayScheduleCard({
    super.key,
    required this.item,
    required this.onCollect,
  });

  final TodayInstalment item;
  final VoidCallback onCollect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    return Container(
      width: 200,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            item.customerName,
            style: AppTypography.bodyLarge,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (item.loanCode.isNotEmpty)
            Text(
              item.loanCode,
              style: AppTypography.caption.copyWith(
                fontFamily: 'monospace',
                color: AppColors.textLight,
              ),
            ),
          const SizedBox(height: 6),
          Text(
            fmt.format(item.dueAmount),
            style: AppTypography.sectionTitle.copyWith(
              color: AppColors.primaryDark,
              fontSize: 14 * 1.1,
            ),
          ),
          const SizedBox(height: 6),
          AppBadge(label: item.status, kind: _kindFor(item.status)),
          const SizedBox(height: 8),
          AppButton(
            label: t.x('btn.collect'),
            size: AppButtonSize.small,
            onPressed: onCollect,
          ),
        ],
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
