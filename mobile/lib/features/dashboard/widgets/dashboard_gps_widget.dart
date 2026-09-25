import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/agent_location.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/customer_service.dart';
import 'package:zolofund/features/admin/tracking/tracking_provider.dart';
import 'package:zolofund/features/billing/widgets/addon_purchase_sheet.dart';

// ── Map pin data ──────────────────────────────────────────────────────────────

enum PinType { agent, customer }

class MapPin {
  const MapPin({
    required this.point,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.icon,
    required this.type,
    this.phone,
    this.navRoute,
    this.agentLocation,
  });

  final LatLng point;
  final String label;
  final String subtitle;
  final Color color;
  final IconData icon;
  final PinType type;
  final String? phone;
  final String? navRoute;
  final AgentLocation? agentLocation;
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
          subtitle: a.online ? 'Online on field' : 'Offline',
          color: a.online ? const Color(0xFF10B981) : AppColors.textLight,
          icon: Icons.person_pin_circle_rounded,
          type: PinType.agent,
          phone: a.agentPhone,
          navRoute: '/tracking',
          agentLocation: a,
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
            type: PinType.customer,
            phone: c.phone,
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

// ── Dashboard GPS Section ─────────────────────────────────────────────────────

class DashboardGpsWidget extends ConsumerStatefulWidget {
  const DashboardGpsWidget({
    super.key,
    required this.isSubscribed,
    required this.onTapSubscribe,
  });

  final bool isSubscribed;
  final VoidCallback onTapSubscribe;

  @override
  ConsumerState<DashboardGpsWidget> createState() => _DashboardGpsWidgetState();
}

class _DashboardGpsWidgetState extends ConsumerState<DashboardGpsWidget> {
  // 'all' | 'agents' | 'customers'
  String _pinFilter = 'all';
  final MapController _mapController = MapController();

  @override
  Widget build(BuildContext context) {
    if (!widget.isSubscribed) {
      return _LockedGpsCard(onTapSubscribe: widget.onTapSubscribe);
    }

    final pinsAsync = ref.watch(mapPinsProvider);
    final agentsAsync = ref.watch(liveAgentLocationsProvider);
    final fmt = ref.watch(currencyFmtProvider);
    final t = T.of(ref);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: AppTokens.shadow,
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header: Title + Live Radar Badge + View Full Map ─────────
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withAlpha(24),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: const Color(0xFF10B981).withAlpha(60),
                  ),
                ),
                child: const Center(
                  child: Icon(
                    Icons.radar_rounded,
                    color: Color(0xFF10B981),
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'LIVE AGENT RADAR',
                          style: AppTypography.caption.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withAlpha(25),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF10B981),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'LIVE',
                                style: AppTypography.extraTiny.copyWith(
                                  color: const Color(0xFF10B981),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 8.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Real-time fleet tracking & verified field visits',
                      style: AppTypography.extraTiny.copyWith(
                        color: AppColors.textSecondary,
                        fontSize: 10.5,
                      ),
                    ),
                  ],
                ),
              ),
              InkWell(
                onTap: () => context.push('/tracking'),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Full Map',
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Icon(
                        Icons.open_in_new_rounded,
                        size: 11,
                        color: AppColors.primary,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Real-time Fleet Performance KPI Strip ────────────────────
          agentsAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (agents) {
              final onlineCount = agents.where((a) => a.online).length;
              final totalCollected =
                  agents.fold<double>(0, (s, a) => s + a.todayCollected);
              final totalStops =
                  agents.fold<int>(0, (s, a) => s + a.todayEntries);

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: _GpsKpiTile(
                        icon: Icons.people_alt_outlined,
                        iconColor: const Color(0xFF10B981),
                        label: 'AGENTS ON FIELD',
                        value: '$onlineCount / ${agents.length}',
                        sub: '$onlineCount active now',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _GpsKpiTile(
                        icon: Icons.payments_outlined,
                        iconColor: const Color(0xFF3B82F6),
                        label: 'FIELD COLLECTED',
                        value: fmt.format(totalCollected),
                        sub: '$totalStops stamped',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _GpsKpiTile(
                        icon: Icons.pin_drop_outlined,
                        iconColor: const Color(0xFF8B5CF6),
                        label: 'VERIFIED STOPS',
                        value: '$totalStops visits',
                        sub: 'GPS geotagged',
                      ),
                    ),
                  ],
                ),
              );
            },
          ),

          // ── Map Filter Chips (All, Agents, Customers) ────────────────
          pinsAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (pins) {
              final agentCount = pins.where((p) => p.type == PinType.agent).length;
              final custCount = pins.where((p) => p.type == PinType.customer).length;

              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    _FilterChip(
                      label: 'All (${pins.length})',
                      isSelected: _pinFilter == 'all',
                      onTap: () => setState(() => _pinFilter = 'all'),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Agents ($agentCount)',
                      isSelected: _pinFilter == 'agents',
                      activeColor: const Color(0xFF10B981),
                      onTap: () => setState(() => _pinFilter = 'agents'),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Customers ($custCount)',
                      isSelected: _pinFilter == 'customers',
                      activeColor: AppColors.primary,
                      onTap: () => setState(() => _pinFilter = 'customers'),
                    ),
                  ],
                ),
              );
            },
          ),

          // ── Interactive Map Section ──────────────────────────────────
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              height: 210,
              child: pinsAsync.when(
                loading: () => Container(
                  color: AppColors.background,
                  child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
                error: (_, __) => Container(
                  color: AppColors.background,
                  alignment: Alignment.center,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.map_outlined, color: AppColors.textLight, size: 28),
                      const SizedBox(height: 6),
                      Text('Map unavailable', style: AppTypography.caption),
                    ],
                  ),
                ),
                data: (allPins) {
                  final filteredPins = allPins.where((p) {
                    if (_pinFilter == 'agents') return p.type == PinType.agent;
                    if (_pinFilter == 'customers') return p.type == PinType.customer;
                    return true;
                  }).toList();

                  final center = _calcCenter(filteredPins);
                  final zoom = _calcZoom(filteredPins);

                  return Stack(
                    children: [
                      FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: center,
                          initialZoom: zoom,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.zolofund.app',
                          ),
                          MarkerLayer(
                            markers: filteredPins.map((pin) {
                              final isAgent = pin.type == PinType.agent;
                              return Marker(
                                point: pin.point,
                                width: isAgent ? 38 : 32,
                                height: isAgent ? 38 : 32,
                                child: GestureDetector(
                                  onTap: () => _showPinSheet(context, t, pin, fmt),
                                  child: isAgent
                                      ? _AgentMapMarker(pin: pin)
                                      : _CustomerMapMarker(pin: pin),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),

                      // Re-center floating button
                      Positioned(
                        bottom: 8,
                        right: 8,
                        child: FloatingActionButton.small(
                          heroTag: 'gps_recenter_btn',
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.textPrimary,
                          elevation: 2,
                          onPressed: () {
                            if (filteredPins.isNotEmpty) {
                              _mapController.move(
                                _calcCenter(filteredPins),
                                _calcZoom(filteredPins),
                              );
                            }
                          },
                          child: const Icon(Icons.my_location_rounded, size: 18),
                        ),
                      ),

                      // Full map expand floating button
                      Positioned(
                        top: 8,
                        right: 8,
                        child: GestureDetector(
                          onTap: () => context.push('/tracking'),
                          child: Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: AppTokens.shadow,
                            ),
                            child: const Icon(
                              Icons.fullscreen_rounded,
                              size: 18,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ),

                      // Empty overlay if filtered list is empty
                      if (filteredPins.isEmpty)
                        Positioned.fill(
                          child: Container(
                            color: Colors.black26,
                            alignment: Alignment.center,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.location_off_outlined,
                                  color: Colors.white,
                                  size: 26,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'No locations matching filter',
                                  style: AppTypography.caption.copyWith(color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Live Agents List Strip (Horizontal Scroll) ───────────────
          agentsAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (agents) {
              if (agents.isEmpty) {
                return Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 16, color: AppColors.textLight),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'No agents broadcasting GPS yet. Activity will appear live when visits start.',
                          style: AppTypography.extraTiny.copyWith(color: AppColors.textSecondary),
                        ),
                      ),
                    ],
                  ),
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'FIELD AGENTS STATUS',
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => context.push('/tracking'),
                        child: Text(
                          'Track routes \u2192',
                          style: AppTypography.extraTiny.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 80,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: agents.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (ctx, i) {
                        final a = agents[i];
                        return _AgentMiniCard(
                          agent: a,
                          fmt: fmt,
                          onTap: () {
                            if (a.hasLocation) {
                              _mapController.move(LatLng(a.lat!, a.lng!), 15);
                            } else {
                              context.push('/tracking');
                            }
                          },
                        );
                      },
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  LatLng _calcCenter(List<MapPin> pins) {
    if (pins.isEmpty) return const LatLng(20.5937, 78.9629);
    final lat =
        pins.map((p) => p.point.latitude).reduce((a, b) => a + b) / pins.length;
    final lng = pins.map((p) => p.point.longitude).reduce((a, b) => a + b) /
        pins.length;
    return LatLng(lat, lng);
  }

  double _calcZoom(List<MapPin> pins) {
    if (pins.isEmpty) return 4.5;
    if (pins.length == 1) return 14.5;
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
    if (spread < 0.05) return 13.5;
    if (spread < 0.5) return 11.5;
    if (spread < 5) return 8.5;
    return 5.5;
  }
}

// ── Agent Mini Card ───────────────────────────────────────────────────────────

class _AgentMiniCard extends StatelessWidget {
  const _AgentMiniCard({
    required this.agent,
    required this.fmt,
    required this.onTap,
  });

  final AgentLocation agent;
  final NumberFormat fmt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 175,
        padding: const EdgeInsets.all(9),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: agent.online
                ? const Color(0xFF10B981).withAlpha(80)
                : AppColors.border,
          ),
        ),
        child: Row(
          children: [
            Stack(
              children: [
                CircleAvatar(
                  radius: 17,
                  backgroundColor: AppColors.primaryLight,
                  child: Text(
                    agent.agentName.isNotEmpty
                        ? agent.agentName[0].toUpperCase()
                        : 'A',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: agent.online ? const Color(0xFF10B981) : Colors.grey,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    agent.agentName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    fmt.format(agent.todayCollected),
                    style: AppTypography.extraTiny.copyWith(
                      color: const Color(0xFF10B981),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    agent.online ? 'Active on field' : 'Offline',
                    style: AppTypography.extraTiny.copyWith(
                      color: agent.online
                          ? const Color(0xFF10B981)
                          : AppColors.textLight,
                      fontSize: 9,
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

// ── Agent and Customer Map Markers ────────────────────────────────────────────

class _AgentMapMarker extends StatelessWidget {
  const _AgentMapMarker({required this.pin});
  final MapPin pin;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF10B981),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: const [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: Text(
          pin.label.isNotEmpty ? pin.label[0].toUpperCase() : 'A',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _CustomerMapMarker extends StatelessWidget {
  const _CustomerMapMarker({required this.pin});
  final MapPin pin;

  @override
  Widget build(BuildContext context) {
    return Icon(
      Icons.location_on_rounded,
      size: 32,
      color: AppColors.primary,
      shadows: const [
        Shadow(
          color: Colors.black26,
          blurRadius: 4,
          offset: Offset(0, 2),
        ),
      ],
    );
  }
}

// ── Filter Chip ───────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
    this.activeColor,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final Color? activeColor;

  @override
  Widget build(BuildContext context) {
    final col = activeColor ?? AppColors.primary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? col : AppColors.background,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? col : AppColors.border,
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: AppTypography.extraTiny.copyWith(
            color: isSelected ? Colors.white : AppColors.textSecondary,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

// ── KPI Metric Tile ───────────────────────────────────────────────────────────

class _GpsKpiTile extends StatelessWidget {
  const _GpsKpiTile({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.sub,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String sub;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: iconColor),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.extraTiny.copyWith(
                    color: AppColors.textLight,
                    fontWeight: FontWeight.w700,
                    fontSize: 8,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(height: 1),
          Text(
            sub,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.extraTiny.copyWith(
              color: AppColors.textSecondary,
              fontSize: 8.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Pin Bottom Sheet ──────────────────────────────────────────────────────────

void _showPinSheet(BuildContext context, T t, MapPin pin, NumberFormat fmt) {
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
            const SizedBox(height: 16),
            Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: pin.type == PinType.agent
                      ? const Color(0xFF10B981).withAlpha(30)
                      : AppColors.primaryLight,
                  child: Icon(
                    pin.icon,
                    color: pin.type == PinType.agent
                        ? const Color(0xFF10B981)
                        : AppColors.primary,
                    size: 24,
                  ),
                ),
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
            if (pin.agentLocation != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'TODAY COLLECTED',
                            style: AppTypography.extraTiny.copyWith(
                              color: AppColors.textLight,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            fmt.format(pin.agentLocation!.todayCollected),
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF10B981),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ENTRIES STAMPED',
                            style: AppTypography.extraTiny.copyWith(
                              color: AppColors.textLight,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${pin.agentLocation!.todayEntries} visits',
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 18),
            Row(
              children: [
                if (pin.phone != null && pin.phone!.isNotEmpty) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.phone_rounded, size: 16),
                      label: const Text('Call'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                        ),
                      ),
                      onPressed: () async {
                        final uri = Uri.parse('tel:${pin.phone}');
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                if (pin.navRoute != null)
                  Expanded(
                    flex: 2,
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
                      child: Text(
                        pin.type == PinType.agent
                            ? 'Track Live Route'
                            : t.x('btn.view_details'),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
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
                    showAddonPurchaseSheet(
                      context,
                      ref,
                      addonKey: 'gps_tracking',
                      onActivated: () =>
                          ref.read(authControllerProvider.notifier).refreshProfile(),
                    );
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
