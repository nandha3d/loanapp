import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';

/// Shown when a feature is locked on the tenant's current plan.
///
/// Premium features are bundled into subscription plans and are no longer sold
/// as separate add-ons, so there is nothing to purchase here — only a pointer to
/// upgrading the plan. [onActivated] is accepted for call-site compatibility and
/// is never invoked (nothing activates from this sheet).
Future<void> showPlanUpgradeSheet(
  BuildContext context,
  WidgetRef ref, {
  required String featureKey,
  VoidCallback? onActivated,
}) {
  final t = T.of(ref);
  final featureName = t.x('plan.feature.$featureKey');
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 18, 22, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.lock_outline, color: AppColors.warning),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(t.x('plan.upgrade_title'), style: AppTypography.sectionTitle),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(featureName, style: AppTypography.bodyLarge),
            const SizedBox(height: 8),
            Text(
              t.x('plan.upgrade_body'),
              style: AppTypography.caption.copyWith(color: AppColors.textPrimary, height: 1.35),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: Text(t.x('plan.upgrade_ok')),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
