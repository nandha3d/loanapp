import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/gps/gps_service.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';

/// Shows the mandatory GPS warning popup dialog. It is non-dismissible by tapping
/// outside, and stays active until GPS is switched on or the user chooses to exit
/// to the dashboard.
Future<bool?> showGpsEnforcementDialog(
  BuildContext context, {
  VoidCallback? onGpsEnabled,
}) {
  return showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => PopScope(
      canPop: false,
      child: GpsEnforcementDialog(onGpsEnabled: onGpsEnabled),
    ),
  );
}

class GpsEnforcementDialog extends ConsumerStatefulWidget {
  const GpsEnforcementDialog({super.key, this.onGpsEnabled});

  final VoidCallback? onGpsEnabled;

  @override
  ConsumerState<GpsEnforcementDialog> createState() =>
      _GpsEnforcementDialogState();
}

class _GpsEnforcementDialogState extends ConsumerState<GpsEnforcementDialog>
    with WidgetsBindingObserver {
  bool _serviceEnabled = false;
  LocationPermission _permission = LocationPermission.denied;
  bool _checking = true;
  StreamSubscription<ServiceStatus>? _statusSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkStatus();

    // Listen to hardware service toggle events in real-time.
    final gps = ref.read(gpsServiceProvider);
    _statusSub = gps.serviceStatusStream().listen((status) {
      if (status == ServiceStatus.enabled) {
        _checkStatus();
      } else {
        if (mounted) {
          setState(() => _serviceEnabled = false);
        }
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _statusSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-check when returning from Android/iOS Location Settings or App Settings.
    if (state == AppLifecycleState.resumed) {
      _checkStatus();
    }
  }

  Future<void> _checkStatus() async {
    if (!mounted) return;
    setState(() => _checking = true);
    final gps = ref.read(gpsServiceProvider);
    final status = await gps.checkGpsStatus();

    if (!mounted) return;
    setState(() {
      _serviceEnabled = status.serviceEnabled;
      _permission = status.permission;
      _checking = false;
    });

    if (status.isFullyEnabled) {
      widget.onGpsEnabled?.call();
      if (mounted && Navigator.of(context, rootNavigator: true).canPop()) {
        Navigator.of(context, rootNavigator: true).pop(true);
      }
    }
  }

  Future<void> _openLocationSettings() async {
    final gps = ref.read(gpsServiceProvider);
    await gps.openLocationSettings();
  }

  Future<void> _handlePermissionAction() async {
    final gps = ref.read(gpsServiceProvider);
    if (_permission == LocationPermission.deniedForever) {
      await gps.openAppSettingsScreen();
    } else {
      await gps.ensurePermission();
    }
    await _checkStatus();
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final hasPermission = _permission == LocationPermission.whileInUse ||
        _permission == LocationPermission.always;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radius)),
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Warning header icon
            Center(
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.warning.withAlpha(30),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.location_off_rounded,
                  color: AppColors.warning,
                  size: 36,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Title
            Text(
              t.x('coll.gps_required_title'),
              style: AppTypography.sectionTitle.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),

            // Description
            Text(
              t.x('coll.gps_required_desc'),
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),

            // Live status indicators
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _StatusPill(
                      label: t.x('coll.gps_status_device'),
                      isActive: _serviceEnabled,
                      activeText: t.x('coll.gps_status_on'),
                      inactiveText: t.x('coll.gps_status_off'),
                    ),
                  ),
                  Container(
                    width: 1,
                    height: 24,
                    color: AppColors.border,
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  Expanded(
                    child: _StatusPill(
                      label: t.x('coll.gps_status_permission'),
                      isActive: hasPermission,
                      activeText: t.x('coll.gps_status_granted'),
                      inactiveText: t.x('coll.gps_status_denied'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Step 1: Device Location Setting
            _InstructionCard(
              icon: Icons.phone_android_rounded,
              title: t.x('coll.gps_step_device_title'),
              description: t.x('coll.gps_step_device_desc'),
              isResolved: _serviceEnabled,
              actionLabel: t.x('coll.gps_btn_open_settings'),
              onAction: _openLocationSettings,
            ),
            const SizedBox(height: 10),

            // Step 2: App Permission
            _InstructionCard(
              icon: Icons.security_rounded,
              title: t.x('coll.gps_step_perm_title'),
              description: t.x('coll.gps_step_perm_desc'),
              isResolved: hasPermission,
              actionLabel: _permission == LocationPermission.deniedForever
                  ? t.x('coll.gps_btn_app_settings')
                  : t.x('coll.gps_btn_grant_perm'),
              onAction: _handlePermissionAction,
            ),
            const SizedBox(height: 20),

            // Check Again button
            FilledButton.icon(
              onPressed: _checking ? null : _checkStatus,
              icon: _checking
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.refresh_rounded, size: 18),
              label: Text(t.x('coll.gps_btn_check_again')),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Return to Dashboard button
            TextButton(
              onPressed: () {
                Navigator.of(context, rootNavigator: true).pop(false);
                context.go('/dashboard');
              },
              child: Text(
                t.x('coll.gps_btn_exit_dashboard'),
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.isActive,
    required this.activeText,
    required this.inactiveText,
  });

  final String label;
  final bool isActive;
  final String activeText;
  final String inactiveText;

  @override
  Widget build(BuildContext context) {
    final color = isActive ? AppColors.success : AppColors.warning;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.caption.copyWith(color: AppColors.textSecondary, fontSize: 11),
        ),
        const SizedBox(height: 3),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isActive ? Icons.check_circle_rounded : Icons.cancel_rounded,
              size: 14,
              color: color,
            ),
            const SizedBox(width: 4),
            Text(
              isActive ? activeText : inactiveText,
              style: AppTypography.bodySmall.copyWith(
                color: color,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _InstructionCard extends StatelessWidget {
  const _InstructionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.isResolved,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String description;
  final bool isResolved;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isResolved
            ? AppColors.success.withAlpha(12)
            : AppColors.background,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(
          color: isResolved ? AppColors.success.withAlpha(60) : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isResolved ? Icons.check_circle_rounded : icon,
                size: 18,
                color: isResolved ? AppColors.success : AppColors.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.bodySmall.copyWith(
                    fontWeight: FontWeight.bold,
                    color: isResolved ? AppColors.success : AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            description,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
              height: 1.3,
            ),
          ),
          if (!isResolved) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton(
                onPressed: onAction,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: const Size(0, 32),
                  side: BorderSide(color: AppColors.primary.withAlpha(120)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                ),
                child: Text(
                  actionLabel,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
