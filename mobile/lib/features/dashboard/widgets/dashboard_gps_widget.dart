import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/customer_service.dart';
import 'package:zolofund/features/admin/tracking/tracking_provider.dart';

// ── Map pin data ──────────────────────────────────────────────────────────────

class MapPin {
  const MapPin({
    required this.point,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.icon,
    this.navRoute,
  });
  final LatLng point;
  final String label;
  final String subtitle;
  final Color color;
  final IconData icon;
  final String? navRoute;
}

final mapPinsProvider = FutureProvider.autoDispose<List<MapPin>>((ref) async {
  final pins = <MapPin>[];

  // Agent live locations
  try {
    final agents = await ref.read(liveAgentLocationsProvider.future);
    for (final a in agents) {
      if (!a.hasLocation) continue;
      pins.add(
        MapPin(
          point: LatLng(a.lat!, a.lng!),
          label: a.agentName,
          subtitle: a.online ? 'Online' : 'Offline',
          color: a.online ? AppColors.success : AppColors.textLight,
          icon: Icons.person_pin_circle_rounded,
          navRoute: '/tracking',
        ),
      );
    }
  } catch (_) {}

  // Customer collection points (lat/lng optional — skip if missing)
  try {
    final customers = await ref.read(customerServiceProvider).list();
    for (final c in customers) {
      for (final cp in c.collectionPoints) {
        if (cp.latitude == null || cp.longitude == null) continue;
        pins.add(
          MapPin(
            point: LatLng(cp.latitude!, cp.longitude!),
            label: c.name,
            subtitle: cp.isPrimary ? '${cp.name} · Primary' : cp.name,
            color: AppColors.primary,
            icon: Icons.location_on_rounded,
            navRoute: '/customers/${c.id}',
          ),
        );
      }
    }
  } catch (_) {}

  return pins;
});

// ── Header Badge (near Up Next) ───────────────────────────────────────────────

class GpsHeaderBadge extends StatelessWidget {
  const GpsHeaderBadge({
    super.key,
    required this.isSubscribed,
    required this.onTapSubscribe,
  });

  final bool isSubscribed;
  final VoidCallback onTapSubscribe;

  @override
  Widget build(BuildContext context) {
    if (isSubscribed) {
      return GestureDetector(
        onTap: () => context.push('/tracking'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.successBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.success.withAlpha(80)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: AppColors.success,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.gps_fixed_rounded, size: 12, color: AppColors.success),
              const SizedBox(width: 4),
              Text(
                'LIVE GPS',
                style: AppTypography.extraTiny.copyWith(
                  color: AppColors.success,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: onTapSubscribe,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(8),
              blurRadius: 3,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.gps_fixed_rounded, size: 12, color: AppColors.textLight),
            const SizedBox(width: 4),
            Text(
              'GPS',
              style: AppTypography.extraTiny.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.lock_rounded, size: 11, color: AppColors.warning),
          ],
        ),
      ),
    );
  }
}

// ── Dashboard GPS Section (Near Up Next) ──────────────────────────────────────

class DashboardGpsWidget extends ConsumerWidget {
  const DashboardGpsWidget({
    super.key,
    required this.isSubscribed,
    required this.onTapSubscribe,
  });

  final bool isSubscribed;
  final VoidCallback onTapSubscribe;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!isSubscribed) {
      return _LockedGpsCard(onTapSubscribe: onTapSubscribe);
    }

    final pinsAsync = ref.watch(mapPinsProvider);
    final t = T.of(ref);

    return _LiveMapSection(
      pinsAsync: pinsAsync,
      onPinTap: (pin) => _showPinSheet(context, t, pin),
      onExpand: () => context.push('/tracking'),
    );
  }
}

// ── Locked GPS Card (for non-subscribers) ──────────────────────────────────────

class _LockedGpsCard extends StatelessWidget {
  const _LockedGpsCard({required this.onTapSubscribe});
  final VoidCallback onTapSubscribe;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppTokens.shadow,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTapSubscribe,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Icon(
                        Icons.gps_fixed_rounded,
                        color: AppColors.primary,
                        size: 22,
                      ),
                      Positioned(
                        bottom: 4,
                        right: 4,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.lock_rounded,
                            size: 11,
                            color: AppColors.warning,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'Live GPS Tracking',
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.warningBg,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.lock_rounded,
                                  size: 9,
                                  color: AppColors.warning,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  'ADD-ON',
                                  style: AppTypography.extraTiny.copyWith(
                                    color: AppColors.warning,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 9,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Track field agent routes, live map & collection geotags.',
                        style: AppTypography.caption.copyWith(fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Subscribe',
                    style: AppTypography.extraTiny.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Live Map Section (for subscribers) ────────────────────────────────────────

class _LiveMapSection extends StatelessWidget {
  const _LiveMapSection({
    required this.pinsAsync,
    required this.onPinTap,
    required this.onExpand,
  });

  final AsyncValue<List<MapPin>> pinsAsync;
  final void Function(MapPin) onPinTap;
  final VoidCallback onExpand;

  LatLng _center(List<MapPin> pins) {
    if (pins.isEmpty) return const LatLng(20.5937, 78.9629);
    final lat =
        pins.map((p) => p.point.latitude).reduce((a, b) => a + b) / pins.length;
    final lng = pins.map((p) => p.point.longitude).reduce((a, b) => a + b) /
        pins.length;
    return LatLng(lat, lng);
  }

  double _zoom(List<MapPin> pins) {
    if (pins.isEmpty) return 4.5;
    if (pins.length == 1) return 14.0;
    double minLat = pins.first.point.latitude;
    double maxLat = minLat;
    double minLng = pins.first.point.longitude;
    double maxLng = minLng;
    for (final p in pins) {
      if (p.point.latitude < minLat) minLat = p.point.latitude;
      if (p.point.latitude > maxLat) maxLat = p.point.latitude;
      if (p.point.longitude < minLng) minLng = p.point.longitude;
      if (p.point.longitude > maxLng) maxLng = p.point.longitude;
    }
    final spread = (maxLat - minLat) + (maxLng - minLng);
    if (spread < 0.05) return 13.0;
    if (spread < 0.5) return 11.0;
    if (spread < 5) return 8.0;
    return 5.0;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: Border.all(color: AppColors.border),
        color: AppColors.surface,
        boxShadow: AppTokens.shadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: pinsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.map_outlined,
                color: AppColors.textLight,
                size: 32,
              ),
              const SizedBox(height: 6),
              Text('Map unavailable', style: AppTypography.caption),
            ],
          ),
        ),
        data: (pins) {
          final center = _center(pins);
          final zoom = _zoom(pins);
          return Stack(
            children: [
              FlutterMap(
                options: MapOptions(
                  initialCenter: center,
                  initialZoom: zoom,
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.zolofund.app',
                  ),
                  MarkerLayer(
                    markers: pins
                        .map(
                          (pin) => Marker(
                            point: pin.point,
                            width: 36,
                            height: 36,
                            child: GestureDetector(
                              onTap: () => onPinTap(pin),
                              child: Icon(
                                pin.icon,
                                size: 32,
                                color: pin.color,
                                shadows: const [
                                  Shadow(
                                    color: Colors.black26,
                                    blurRadius: 4,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ),
              // Legend
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(230),
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: AppTokens.shadow,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.person_pin_circle_rounded,
                        size: 13,
                        color: AppColors.success,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        'Live Agents',
                        style: AppTypography.extraTiny
                            .copyWith(color: AppColors.textSecondary),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.location_on_rounded,
                        size: 13,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        'Customers',
                        style: AppTypography.extraTiny
                            .copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
              // Pin count badge
              if (pins.isNotEmpty)
                Positioned(
                  top: 8,
                  right: 44,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(230),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: AppTokens.shadow,
                    ),
                    child: Text(
                      '${pins.length} location${pins.length == 1 ? '' : 's'}',
                      style: AppTypography.extraTiny
                          .copyWith(color: AppColors.textSecondary),
                    ),
                  ),
                ),
              // Expand to full tracking screen
              Positioned(
                top: 6,
                right: 6,
                child: GestureDetector(
                  onTap: onExpand,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(6),
                      boxShadow: AppTokens.shadow,
                    ),
                    child: const Icon(
                      Icons.open_in_full,
                      size: 16,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
              // Empty overlay
              if (pins.isEmpty)
                Positioned.fill(
                  child: Container(
                    color: Colors.black12,
                    alignment: Alignment.center,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.location_off_outlined,
                          color: Colors.white70,
                          size: 28,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'No location data yet',
                          style: AppTypography.caption
                              .copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

// ── Pin Bottom Sheet ──────────────────────────────────────────────────────────

void _showPinSheet(BuildContext context, T t, MapPin pin) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Icon(pin.icon, color: pin.color, size: 30),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(pin.label, style: AppTypography.sectionTitle),
                      const SizedBox(height: 2),
                      Text(pin.subtitle, style: AppTypography.caption),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (pin.navRoute != null)
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    context.push(pin.navRoute!);
                  },
                  child: Text(t.x('btn.view_details')),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

// ── Add-on & Payment Subscription Sheet ───────────────────────────────────────

void showGpsAddonSubscribeSheet(BuildContext context, WidgetRef ref) {
  final user = ref.read(authControllerProvider).user;
  final canManageBilling = user?.role == UserRole.superadmin ||
      user?.role == UserRole.admin ||
      user?.role == UserRole.developer;

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 14, 22, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Header with icon
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.satellite_alt_rounded,
                      color: AppColors.primary,
                      size: 28,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'GPS Live Tracking',
                        style: AppTypography.nameLg.copyWith(fontSize: 18),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '₹299 / month',
                              style: AppTypography.extraTiny.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '· Add-on Feature',
                            style: AppTypography.caption,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Feature list
            _buildFeatureBullet(
              icon: Icons.alt_route_rounded,
              title: 'Live Agent Routes & Trail',
              subtitle: 'Track field agent paths, speed, and real-time locations.',
            ),
            const SizedBox(height: 10),
            _buildFeatureBullet(
              icon: Icons.add_location_alt_outlined,
              title: 'Customer Visit Geotagging',
              subtitle: 'Auto-verify GPS coordinates on every collection visit.',
            ),
            const SizedBox(height: 10),
            _buildFeatureBullet(
              icon: Icons.shield_outlined,
              title: 'Anti-Fraud & Proof of Visit',
              subtitle: 'Detect mock locations and enforce field visit compliance.',
            ),
            const SizedBox(height: 10),
            _buildFeatureBullet(
              icon: Icons.map_outlined,
              title: 'Interactive Field Map',
              subtitle: 'Unified view of all agents and customer collection points.',
            ),
            const SizedBox(height: 22),

            if (canManageBilling) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.payment_rounded, size: 18),
                  label: const Text(
                    'Proceed to Subscribe & Pay',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    context.push('/portal/billing');
                  },
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  'Powered by Razorpay · Cancel or update anytime',
                  style: AppTypography.extraTiny.copyWith(color: AppColors.textLight),
                ),
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.warningBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.warning.withAlpha(80)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: AppColors.warning, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'GPS Live Tracking is an organization add-on. Please contact your workspace administrator to subscribe.',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textPrimary,
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                  child: const Text('Close'),
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

Widget _buildFeatureBullet({
  required IconData icon,
  required String title,
  required String subtitle,
}) {
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: AppColors.primary, size: 16),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: AppTypography.bodyLarge.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 1),
            Text(
              subtitle,
              style: AppTypography.caption.copyWith(fontSize: 11),
            ),
          ],
        ),
      ),
    ],
  );
}
