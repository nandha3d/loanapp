import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import 'package:loantrack/core/a11y/ui_prefs.dart';
import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/services/customer_service.dart';
import 'package:loantrack/features/admin/tracking/tracking_provider.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';

// ── Map pin data ──────────────────────────────────────────────────────────────

class _MapPin {
  const _MapPin({
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

final _mapPinsProvider = FutureProvider.autoDispose<List<_MapPin>>((ref) async {
  final pins = <_MapPin>[];

  // Agent live locations
  try {
    final agents = await ref.read(liveAgentLocationsProvider.future);
    for (final a in agents) {
      if (!a.hasLocation) continue;
      pins.add(
        _MapPin(
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
          _MapPin(
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

// ── Module tile config ────────────────────────────────────────────────────────

class _ModuleItem {
  const _ModuleItem({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.route,
    required this.color,
    required this.bgColor,
    this.moduleKey,
    this.minRole,
  });
  final IconData icon;
  final String label, subtitle, route;
  final Color color, bgColor;
  final String? moduleKey;
  final UserRole? minRole;
}

// Not const: module tiles reference the runtime tenant theme (AppColors).
final _allModules = <_ModuleItem>[
  _ModuleItem(
    icon: Icons.payments_outlined,
    label: 'Collection',
    subtitle: 'Daily dues, route work, and chit contributions',
    route: '/collection',
    color: AppColors.success,
    bgColor: AppColors.successBg,
  ),
  _ModuleItem(
    icon: Icons.warning_amber_rounded,
    label: 'Penalties',
    subtitle: 'Manage & settle overdue fines',
    route: '/penalties',
    color: AppColors.danger,
    bgColor: AppColors.dangerBg,
  ),
  const _ModuleItem(
    icon: Icons.fact_check_outlined,
    label: 'Approvals',
    subtitle: 'Review pending requests',
    route: '/approvals',
    moduleKey: 'approvals',
    color: AppColors.success,
    bgColor: AppColors.successBg,
  ),
  const _ModuleItem(
    icon: Icons.verified_user_outlined,
    label: 'KYC Review',
    subtitle: 'Verify pending customer KYC',
    route: '/kyc-review',
    color: AppColors.warning,
    bgColor: AppColors.warningBg,
    minRole: UserRole.admin,
  ),
  const _ModuleItem(
    icon: Icons.bar_chart_rounded,
    label: 'Reports & Analytics',
    subtitle: 'Collection trends & agent performance',
    route: '/analytics',
    moduleKey: 'analytics',
    color: AppColors.info,
    bgColor: AppColors.infoBg,
  ),
  const _ModuleItem(
    icon: Icons.savings_outlined,
    label: 'Chit Funds',
    subtitle: 'Group savings management',
    route: '/chits',
    moduleKey: 'chitfunds',
    color: AppColors.purple,
    bgColor: AppColors.purpleBg,
  ),
  _ModuleItem(
    icon: Icons.receipt_long_outlined,
    label: 'Reports',
    subtitle: 'Daily, agent, and overdue reports',
    route: '/reports',
    moduleKey: 'reports',
    color: AppColors.purple,
    bgColor: AppColors.purpleBg,
  ),
  _ModuleItem(
    icon: Icons.workspace_premium_outlined,
    label: 'Gold Pledge Report',
    subtitle: 'Pending interests & pledged weight',
    route: '/gold-reports',
    moduleKey: 'goldloan',
    color: AppColors.warning,
    bgColor: AppColors.warningBg,
  ),
  _ModuleItem(
    icon: Icons.account_balance_outlined,
    label: 'Accounting & P&L',
    subtitle: 'Daily financials, capital & overdue',
    route: '/accounting',
    moduleKey: 'accounting',
    color: AppColors.info,
    bgColor: AppColors.infoBg,
  ),
  const _ModuleItem(
    icon: Icons.health_and_safety_outlined,
    label: 'NPA Monitoring',
    subtitle: 'Portfolio risk, provisioning & upgrades',
    route: '/npa',
    moduleKey: 'npa',
    color: AppColors.warning,
    bgColor: AppColors.warningBg,
    minRole: UserRole.admin,
  ),
  _ModuleItem(
    icon: Icons.account_balance_wallet_outlined,
    label: 'Cash Float',
    subtitle: 'Agent float & fund release',
    route: '/wallet',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
  ),
  const _ModuleItem(
    icon: Icons.account_balance_rounded,
    label: 'Payment Gateway',
    subtitle: 'UPI & Razorpay for borrower self-pay',
    route: '/settings/payment-gateway',
    color: AppColors.info,
    bgColor: AppColors.infoBg,
    minRole: UserRole.admin,
  ),
  const _ModuleItem(
    icon: Icons.settings_outlined,
    label: 'Settings',
    subtitle: 'Routes, account & app preferences',
    route: '/settings',
    moduleKey: 'settings',
    color: AppColors.textSecondary,
    bgColor: AppColors.background,
  ),
];

bool _canAccess(_ModuleItem item, User user) {
  final privileged = user.role == UserRole.admin ||
      user.role == UserRole.superadmin ||
      user.role == UserRole.developer;

  final roleOk =
      item.minRole == null || privileged || item.minRole == UserRole.agent;
  if (!roleOk) return false;

  final key = item.moduleKey;
  if (key == null) return true;
  if (user.role == UserRole.developer) return true;

  // Core features are role-gated, not subscription-gated.
  switch (key) {
    case 'approvals':
    case 'analytics':
    case 'accounting':
    case 'npa':
    case 'settings':
    case 'reports':
      return user.role != UserRole.agent;
  }

  // Everything else is subscription-gated.
  if (user.enabledModules.isNotEmpty) return user.hasModule(key);
  return privileged;
}

// ── Screen ────────────────────────────────────────────────────────────────────

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final user = ref.watch(authControllerProvider).user;
    final simpleMode = ref.watch(simpleModeProvider);
    // Simple mode (U4): field agents see only daily-work items. Admin roles
    // keep the full grid regardless of the toggle - never hides capability.
    const dailyWorkRoutes = {'/penalties', '/wallet', '/settings'};
    final visible = user == null
        ? <_ModuleItem>[]
        : _allModules
            .where((m) => _canAccess(m, user))
            .where(
              (m) =>
                  !simpleMode ||
                  user.role != UserRole.agent ||
                  dailyWorkRoutes.contains(m.route),
            )
            .toList();
    final pinsAsync = ref.watch(_mapPinsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(t.x('nav.more')), centerTitle: true),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ProfileHeader(
            name: user?.name ?? '—',
            role: user?.role.name ?? '',
            tenantSlug: user?.tenantSlug ?? '',
          ),
          const SizedBox(height: 16),
          // Module switcher — the portal hub is where superadmin/admin move
          // between business modules (microlending, auto finance, gold loan,
          // chits, …). They land there at login, but once inside a module
          // the only way back used to be re-logging in.
          if (user?.role == UserRole.superadmin ||
              user?.role == UserRole.admin) ...[
            _ModuleTile(
              item: _ModuleItem(
                icon: Icons.apps_rounded,
                label: 'Portal · Switch Module',
                subtitle: 'Auto finance, gold loan, chits and more',
                route: '/portal',
                color: AppColors.primary,
                bgColor: AppColors.primaryLight,
              ),
            ),
            const SizedBox(height: 4),
          ],
          // Map hub
          _MapSection(
            pinsAsync: pinsAsync,
            onPinTap: (pin) => _showPinSheet(context, t, pin),
            onExpand: () => context.push('/tracking'),
          ),
          const SizedBox(height: 4),
          for (final m in visible) _ModuleTile(item: m),
          const SizedBox(height: 4),
          // Always visible regardless of role/module gating — this used to
          // only exist in the (now removed) side drawer, which was the only
          // sign-out path for agents since Settings hides it from them and
          // Portal is admin/superadmin-only.
          _ModuleTile(
            item: _ModuleItem(
              icon: Icons.logout_outlined,
              label: 'Log out',
              subtitle: 'Sign out of this account',
              route: '',
              color: AppColors.danger,
              bgColor: AppColors.dangerBg,
            ),
            onTap: () => _confirmLogout(context, ref),
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/more'),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out'),
        content: const Text('Log out of this account?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(authControllerProvider.notifier).logout();
    }
  }

  void _showPinSheet(BuildContext context, T t, _MapPin pin) {
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
                    child: const Text(
                      'View Details',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Map section ───────────────────────────────────────────────────────────────

class _MapSection extends StatelessWidget {
  const _MapSection({
    required this.pinsAsync,
    required this.onPinTap,
    required this.onExpand,
  });
  final AsyncValue<List<_MapPin>> pinsAsync;
  final ValueChanged<_MapPin> onPinTap;
  final VoidCallback onExpand;

  LatLng _center(List<_MapPin> pins) {
    if (pins.isEmpty) return const LatLng(20.5937, 78.9629);
    final lat =
        pins.map((p) => p.point.latitude).reduce((a, b) => a + b) / pins.length;
    final lng = pins.map((p) => p.point.longitude).reduce((a, b) => a + b) /
        pins.length;
    return LatLng(lat, lng);
  }

  double _zoom(List<_MapPin> pins) {
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
      height: 240,
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: Border.all(color: AppColors.border),
        color: AppColors.surface,
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
                size: 36,
              ),
              const SizedBox(height: 8),
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
                    userAgentPackageName: 'com.loantrack.app',
                  ),
                  MarkerLayer(
                    markers: pins
                        .map(
                          (pin) => Marker(
                            point: pin.point,
                            width: 40,
                            height: 40,
                            child: GestureDetector(
                              onTap: () => onPinTap(pin),
                              child: Icon(
                                pin.icon,
                                size: 36,
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
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
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
                      const SizedBox(width: 4),
                      Text(
                        'Agents',
                        style: AppTypography.extraTiny
                            .copyWith(color: AppColors.textSecondary),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.location_on_rounded,
                        size: 13,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 4),
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
                  right: 48,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 5,
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
                          size: 32,
                        ),
                        const SizedBox(height: 6),
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

// ── Profile header ────────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.name,
    required this.role,
    required this.tenantSlug,
  });
  final String name;
  final String role;
  final String tenantSlug;

  String _initials() {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '—';
    return parts.take(2).map((p) => p.isEmpty ? '' : p[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final roleLabel =
        role.isEmpty ? '' : '${role[0].toUpperCase()}${role.substring(1)}';
    final subtitle = [roleLabel, if (tenantSlug.isNotEmpty) tenantSlug]
        .where((s) => s.isNotEmpty)
        .join(' · ');
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () => context.push('/profile'),
      child: Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2A2520), Color(0xFF1B1815)],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(40),
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Text(
              _initials(),
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w800,
                fontSize: 19,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Icon(Icons.edit_outlined,
                        size: 14, color: Colors.white.withAlpha(140),),
                  ],
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: Colors.white.withAlpha(150),
                      fontSize: 12.5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(50),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'ONLINE',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}

// ── Module tile ───────────────────────────────────────────────────────────────

class _ModuleTile extends StatelessWidget {
  const _ModuleTile({required this.item, this.onTap});
  final _ModuleItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap ?? () => context.go(item.route),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(boxShadow: AppTokens.shadow),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: item.bgColor,
                    borderRadius:
                        BorderRadius.circular(AppTokens.radiusKpiIcon),
                  ),
                  child: Icon(item.icon, color: item.color, size: 26),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.label, style: AppTypography.sectionTitle),
                      const SizedBox(height: 3),
                      Text(
                        item.subtitle,
                        style: AppTypography.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textLight,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
