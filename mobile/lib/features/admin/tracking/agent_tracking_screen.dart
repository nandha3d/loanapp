import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/agent_location.dart';
import 'package:loantrack/features/admin/tracking/tracking_provider.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

class AgentTrackingScreen extends ConsumerStatefulWidget {
  const AgentTrackingScreen({super.key});

  @override
  ConsumerState<AgentTrackingScreen> createState() => _AgentTrackingScreenState();
}

class _AgentTrackingScreenState extends ConsumerState<AgentTrackingScreen> {
  final MapController _mapController = MapController();
  Timer? _refreshTimer;
  AgentLocation? _selectedAgent;

  @override
  void initState() {
    super.initState();
    // Refresh every 30 seconds
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      ref.invalidate(liveAgentLocationsProvider);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  void _onMarkerTapped(AgentLocation agent) {
    setState(() => _selectedAgent = agent);
    _mapController.move(LatLng(agent.lat, agent.lng), 15.0);
    _showAgentDetails(agent);
  }

  void _showAgentDetails(AgentLocation agent) {
    final t = T.of(ref);
    final minutesAgo = DateTime.now().difference(agent.capturedAt).inMinutes;
    final timeString = minutesAgo < 1
        ? t.x('admin.just_now')
        : '$minutesAgo ${t.x('admin.mins_ago')}';

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  child: Text(
                    agent.agentName.isNotEmpty ? agent.agentName[0].toUpperCase() : '?',
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(agent.agentName, style: AppTypography.bodyLarge),
                      Text(agent.agentPhone, style: AppTypography.caption),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                )
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Icon(Icons.access_time_rounded, size: 16, color: AppColors.textLight),
                const SizedBox(width: 8),
                Text('${t.x('admin.last_seen')}: $timeString', style: AppTypography.body),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textLight),
                const SizedBox(width: 8),
                Text('${agent.lat.toStringAsFixed(5)}, ${agent.lng.toStringAsFixed(5)}', style: AppTypography.caption),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    ).whenComplete(() => setState(() => _selectedAgent = null));
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final locationsAsync = ref.watch(liveAgentLocationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('admin.agent_tracking')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(liveAgentLocationsProvider),
          ),
        ],
      ),
      body: locationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) {
          debugPrint('Tracking Error: $err\n$stack');
          return Center(
            child: EmptyState(
              icon: Icons.error_outline,
              title: err.toString(),
            ),
          );
        },
        data: (List<AgentLocation> locations) {
          if (locations.isEmpty) {
            return Center(
              child: EmptyState(
                icon: Icons.person_off_outlined,
                title: t.x('admin.no_agents_active'),
              ),
            );
          }

          // Compute bounds
          final bounds = LatLngBounds.fromPoints(
            locations.map((e) => LatLng(e.lat, e.lng)).toList(),
          );
          // Add a little padding to the bounds
          final initialCenter = LatLng(
            (bounds.north + bounds.south) / 2,
            (bounds.east + bounds.west) / 2,
          );

          return FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: initialCenter,
              initialZoom: 12.0,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.loantrack.app',
              ),
              MarkerLayer(
                markers: locations.map((agent) {
                  final isSelected = _selectedAgent?.agentId == agent.agentId;
                  return Marker(
                    point: LatLng(agent.lat, agent.lng),
                    width: 50,
                    height: 50,
                    child: GestureDetector(
                      onTap: () => _onMarkerTapped(agent),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Icon(
                            Icons.location_on,
                            color: isSelected ? AppColors.warning : AppColors.primary,
                            size: 40,
                          ),
                          Positioned(
                            top: 6,
                            child: CircleAvatar(
                              radius: 10,
                              backgroundColor: Colors.white,
                              child: Text(
                                agent.agentName.isNotEmpty ? agent.agentName[0].toUpperCase() : '?',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: isSelected ? AppColors.warning : AppColors.primary,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          );
        },
      ),
    );
  }
}
