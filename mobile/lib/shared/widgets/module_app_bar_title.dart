import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/shared/widgets/app_logo.dart';

/// Universal module header title widget: shows the official ZoloFund logo
/// paired with a clear, prominent module title identifier across all modules.
class ModuleAppBarTitle extends ConsumerWidget {
  const ModuleAppBarTitle({
    super.key,
    this.title,
    this.subtitle,
    this.logoHeight = 28,
  });

  /// Explicit module title (e.g. "Micro Lending", "Auto Finance", "Chit Funds").
  /// If omitted, automatically resolves from the active user's current appType.
  final String? title;

  /// Optional subtitle or screen context (e.g. "Collections", "Vehicles").
  final String? subtitle;

  /// Height for the branded logo. Defaults to 28.
  final double logoHeight;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final resolvedTitle = title ?? AppType.label(user?.appType ?? AppType.microlending);

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        AppLogo.square(
          size: logoHeight,
        ),
        const SizedBox(width: 8),
        Container(
          width: 1.5,
          height: 18,
          color: AppColors.border,
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                resolvedTitle,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.sectionTitle.copyWith(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                ),
              ),
              if (subtitle != null && subtitle!.isNotEmpty)
                Text(
                  subtitle!,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.1,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
