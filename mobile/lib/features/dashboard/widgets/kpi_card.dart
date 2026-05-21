import 'package:flutter/material.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';

enum KpiTone { green, orange, red, blue, purple }

class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    required this.tone,
  });

  final IconData icon;
  final String value;
  final String label;
  final KpiTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      KpiTone.green => (AppColors.successBg, AppColors.success),
      KpiTone.orange => (AppColors.primaryLight, AppColors.primaryDark),
      KpiTone.red => (AppColors.dangerBg, AppColors.danger),
      KpiTone.blue => (AppColors.infoBg, AppColors.info),
      KpiTone.purple => (AppColors.purpleBg, AppColors.purple),
    };
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(AppTokens.radiusKpiIcon),
            ),
            child: Icon(icon, color: fg, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(value, style: AppTypography.kpiValue),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: AppTypography.caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
