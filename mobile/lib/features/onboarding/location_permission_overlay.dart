import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:loantrack/core/gps/gps_service.dart';
import 'package:loantrack/core/theme/app_colors.dart';

const _kPrefsBox = 'prefs';
const _kAskedKey = 'location_always_prompt_seen_v1';
// v2: expanded from camera+notifications to the FULL permission set, so
// existing installs get one re-prompt with the complete list.
const _kCoreAskedKey = 'core_permissions_prompt_seen_v2';

/// One-time, every-role prompt (shown once after first login) that requests
/// ALL the app's runtime permissions up front — location, camera, photos/
/// storage, phone, SMS, microphone (voice entry) and notifications — instead
/// of asking contextually the first time each feature is used. Declining any
/// of them doesn't block the app; those features just re-prompt (or silently
/// no-op) when used later.
Future<void> maybeRequestCorePermissions(BuildContext context) async {
  final box = Hive.isBoxOpen(_kPrefsBox)
      ? Hive.box<dynamic>(_kPrefsBox)
      : await Hive.openBox<dynamic>(_kPrefsBox);
  final asked = (box.get(_kCoreAskedKey) as bool?) ?? false;
  if (asked) return;
  await box.put(_kCoreAskedKey, true);
  if (!context.mounted) return;

  final proceed = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          icon: Icon(Icons.verified_user_outlined, color: AppColors.primary),
          title: const Text('App permissions'),
          content: const Text(
            'LoanTrack needs a few permissions to work in the field:\n\n'
            '• Location — collection visits and route tracking\n'
            '• Camera & Photos — customer photos and KYC documents\n'
            '• Phone & SMS — call or message customers in one tap\n'
            '• Microphone — voice entry of amounts\n'
            '• Notifications — payment and approval alerts\n\n'
            'Grant them now so nothing interrupts you during collection.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Not now'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Continue'),
            ),
          ],
        ),
      ) ??
      false;
  if (!proceed) return;

  // Sequential — Android shows one system sheet per permission group.
  // While-in-use location first (agents get the separate "all the time"
  // upgrade flow right after this, see maybeRequestAlwaysLocation).
  await Permission.locationWhenInUse.request();
  await Permission.camera.request();
  // Android 13+ scoped photos; older versions fall back to storage.
  await Permission.photos.request();
  await Permission.storage.request();
  await Permission.phone.request();
  await Permission.sms.request();
  await Permission.microphone.request();
  await Permission.notification.request();
}

/// One-time, agent-only prompt (shown once after first login, like the
/// onboarding tour) explaining why the app wants "Allow all the time"
/// location and walking them through the two-step Android permission flow.
/// Declining doesn't block the app — [LocationStatusBanner] keeps reminding
/// them afterward since agent GPS tracking silently stops in the background
/// without it.
Future<void> maybeRequestAlwaysLocation(
  BuildContext context,
  WidgetRef ref, {
  required String role,
}) async {
  if (role != 'agent') return;
  final box = Hive.isBoxOpen(_kPrefsBox)
      ? Hive.box<dynamic>(_kPrefsBox)
      : await Hive.openBox<dynamic>(_kPrefsBox);
  final asked = (box.get(_kAskedKey) as bool?) ?? false;
  if (asked) return;
  await box.put(_kAskedKey, true);
  if (!context.mounted) return;

  final proceed = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          icon: Icon(Icons.location_on_outlined, color: AppColors.primary),
          title: const Text('Allow location "All the time"'),
          content: const Text(
            'We use your location during collection runs so the office can see '
            'your route and verify visits — even if the app is in the '
            'background. Choose "Allow all the time" on the next screen(s).',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Not now'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Continue'),
            ),
          ],
        ),
      ) ??
      false;
  if (!proceed || !context.mounted) return;

  await ref.read(gpsServiceProvider).requestAlwaysPermission();
}

/// Persistent reminder while an agent's location permission is anything less
/// than "always" — background tracking silently stops otherwise. Tapping it
/// re-runs the two-step request flow, or opens Settings if permanently denied.
class LocationStatusBanner extends ConsumerStatefulWidget {
  const LocationStatusBanner({super.key});

  @override
  ConsumerState<LocationStatusBanner> createState() =>
      _LocationStatusBannerState();
}

class _LocationStatusBannerState extends ConsumerState<LocationStatusBanner>
    with WidgetsBindingObserver {
  LocationPermission? _permission;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-check after returning from Settings.
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    final p = await ref.read(gpsServiceProvider).currentPermission();
    if (mounted) setState(() => _permission = p);
  }

  Future<void> _fix() async {
    if (_permission == LocationPermission.deniedForever) {
      await ref.read(gpsServiceProvider).ensurePermission();
    } else {
      await ref.read(gpsServiceProvider).requestAlwaysPermission();
    }
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final ok = _permission == LocationPermission.always;
    if (ok || _permission == null) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      color: AppColors.warning.withAlpha(28),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.location_off_outlined,
              size: 16, color: AppColors.warning,),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Location tracking is limited in the background. Allow "All the time" for uninterrupted tracking.',
              style: TextStyle(fontSize: 12, color: AppColors.warning, fontWeight: FontWeight.w600),
            ),
          ),
          TextButton(
            onPressed: _fix,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 28),
            ),
            child: const Text('Fix', style: TextStyle(color: AppColors.warning)),
          ),
        ],
      ),
    );
  }
}
