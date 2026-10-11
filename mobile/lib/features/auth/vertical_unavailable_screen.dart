import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';

/// Play build only: shown to a staff user whose lending module is not yet
/// available in the Play Store app (see `kPlayVerticals`). They keep using
/// the web portal; nothing about their account changes.
class VerticalUnavailableScreen extends ConsumerWidget {
  const VerticalUnavailableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.apps_outage_rounded, size: 56, color: AppColors.primary),
                const SizedBox(height: 16),
                Text(
                  t.x('play.vertical_unavailable_title'),
                  style: AppTypography.sectionTitle,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  t.x('play.vertical_unavailable_body'),
                  style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary, height: 1.4),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () => ref.read(authControllerProvider.notifier).logout(),
                  icon: const Icon(Icons.logout_rounded),
                  label: Text(t.x('set.logout')),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
