import 'package:flutter/material.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';

enum AppButtonVariant { primary, secondary, danger, ghost }
enum AppButtonSize { regular, small }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.regular,
    this.leading,
    this.loading = false,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final Widget? leading;
  final bool loading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final bg = switch (variant) {
      AppButtonVariant.primary => AppColors.primary,
      AppButtonVariant.secondary => AppColors.background,
      AppButtonVariant.danger => AppColors.danger,
      AppButtonVariant.ghost => Colors.transparent,
    };
    final fg = switch (variant) {
      AppButtonVariant.primary => Colors.white,
      AppButtonVariant.secondary => AppColors.textPrimary,
      AppButtonVariant.danger => Colors.white,
      AppButtonVariant.ghost => AppColors.primaryDark,
    };
    final hasBorder = variant == AppButtonVariant.secondary;
    final padding = size == AppButtonSize.small
        ? const EdgeInsets.symmetric(horizontal: 12, vertical: 5)
        : const EdgeInsets.symmetric(horizontal: 18, vertical: 9);
    final fontSize = size == AppButtonSize.small ? 14 * 0.78 : 14 * 0.85;

    final child = Material(
      color: bg,
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        onTap: loading ? null : onPressed,
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            border: hasBorder
                ? Border.all(color: AppColors.border)
                : null,
          ),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (loading)
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: fg),
                )
              else if (leading != null) ...[
                IconTheme(
                  data: IconThemeData(color: fg, size: 16),
                  child: leading!,
                ),
                const SizedBox(width: 8),
              ],
              if (!loading)
                Text(
                  label,
                  style: AppTypography.body.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w600,
                    fontSize: fontSize,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
    return Opacity(opacity: onPressed == null && !loading ? 0.6 : 1.0, child: child);
  }
}
