import 'package:flutter/material.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';

enum BadgeKind { active, overdue, closed, upcoming, pending, waived, partial, info }

class AppBadge extends StatelessWidget {
  const AppBadge({super.key, required this.label, required this.kind});

  final String label;
  final BadgeKind kind;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (kind) {
      BadgeKind.active => (AppColors.successBg, AppColors.successText),
      BadgeKind.overdue => (AppColors.dangerBg, AppColors.dangerText),
      BadgeKind.closed => (AppColors.infoBg, AppColors.infoText),
      BadgeKind.upcoming => (AppColors.infoBg, AppColors.infoText),
      BadgeKind.info => (AppColors.infoBg, AppColors.infoText),
      BadgeKind.pending => (AppColors.primaryLight, AppColors.primaryDark),
      BadgeKind.waived => (AppColors.purpleBg, AppColors.purpleText),
      BadgeKind.partial => (AppColors.warningBg, AppColors.warningText),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
      ),
      child: Text(
        label,
        style: AppTypography.tiny.copyWith(color: fg),
      ),
    );
  }
}
