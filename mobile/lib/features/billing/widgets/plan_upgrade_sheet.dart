import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/user.dart';

/// In-app route of the plan / subscription screen (superadmin + admin only).
String planSubscriptionRoute(String featureKey) =>
    '/microlending/subscription?feature=$featureKey';

/// Small "lock + Plan" chip for entries that are locked on the current plan.
class PlanLockBadge extends ConsumerWidget {
  const PlanLockBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.warning.withAlpha(120)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.lock_rounded, size: 11, color: AppColors.warning),
          const SizedBox(width: 3),
          Text(
            T.of(ref).x('plan.locked_badge'),
            style: AppTypography.extraTiny.copyWith(
              color: AppColors.warning,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

/// Shown when a feature is locked on the tenant's current plan.
///
/// Premium features are bundled into subscription plans and are no longer sold
/// as separate add-ons, so there is nothing to purchase here — only a path to
/// the plans. What the viewer can do depends on role, mirroring the route
/// guards: superadmin / admin can open the in-app plans screen, only superadmin
/// can open the web subscription page; everyone else is told to ask the owner.
/// [onActivated] is accepted for call-site compatibility and is never invoked
/// (nothing activates from this sheet).
Future<void> showPlanUpgradeSheet(
  BuildContext context,
  WidgetRef ref, {
  required String featureKey,
  VoidCallback? onActivated,
}) {
  final t = T.of(ref);
  final featureName = t.x('plan.feature.$featureKey');
  final user = ref.read(authControllerProvider).user;
  final canViewPlans =
      user?.role == UserRole.superadmin || user?.role == UserRole.admin;
  final canOpenWeb = user?.role == UserRole.superadmin;
  final bodyKey =
      canOpenWeb ? 'plan.upgrade_body_owner' : 'plan.upgrade_body_staff';
  final webUri = Uri.parse(
    '${ref.read(mediaBaseUrlProvider)}'
    '/${AppType.normalize(user?.appType ?? AppType.microlending)}'
    '/subscription?feature=$featureKey#feature-$featureKey',
  );

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
              t.x(bodyKey),
              style: AppTypography.caption.copyWith(color: AppColors.textPrimary, height: 1.35),
            ),
            const SizedBox(height: 18),
            if (canViewPlans) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    GoRouter.of(context).push(planSubscriptionRoute(featureKey));
                  },
                  child: Text(t.x('plan.upgrade_view_plans')),
                ),
              ),
              if (canOpenWeb) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      launchUrl(webUri, mode: LaunchMode.externalApplication);
                    },
                    child: Text(t.x('plan.upgrade_open_web')),
                  ),
                ),
              ],
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: Text(t.x('plan.upgrade_ok')),
                ),
              ),
            ] else
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
