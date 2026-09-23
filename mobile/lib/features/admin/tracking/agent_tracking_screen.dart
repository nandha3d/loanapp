import 'dart:async';
import 'dart:ui' as ui;

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/agent_location.dart';
import 'package:zolofund/features/admin/tracking/tracking_provider.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';

class AgentTrackingScreen extends ConsumerStatefulWidget {
  const AgentTrackingScreen({super.key});

  @override
  ConsumerState<AgentTrackingScreen> createState() => _AgentTrackingScreenState();
}

class _AgentTrackingScreenState extends ConsumerState<AgentTrackingScreen>
    with SingleTickerProviderStateMixin {
  final _mapController = MapController();
  Timer? _refreshTimer;
  AgentLocation? _selected;
  bool _mapFull = false;

  // Live GPS Tracking & Map Controls
  bool _liveGpsMode = true;
  bool _isSatellite = false;
  bool _showTrail = true;
  AgentCollection? _selectedCollection;
  AgentCollection? _liveAlertCollection;
  Timer? _liveAlertTimer;
  final Set<String> _seenCollectionIds = <String>{};
  late final AnimationController _pulseController;

  // Collections table date filter.
  String _collRange = 'today';
  DateTimeRange? _customRange;

  /// Resolves the active filter into a [from, to) day-boundary range.
  ({DateTime from, DateTime to}) _resolveRange() {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final endOfToday = todayStart.add(const Duration(days: 1));
    switch (_collRange) {
      case '7d':
        return (from: todayStart.subtract(const Duration(days: 6)), to: endOfToday);
      case '30d':
        return (from: todayStart.subtract(const Duration(days: 29)), to: endOfToday);
      case 'lastmonth':
        return (
          from: DateTime(now.year, now.month - 1, 1),
          to: DateTime(now.year, now.month, 1),
        );
      case 'custom':
        final r = _customRange;
        if (r != null) {
          return (
            from: DateTime(r.start.year, r.start.month, r.start.day),
            to: DateTime(r.end.year, r.end.month, r.end.day)
                .add(const Duration(days: 1)),
          );
        }
        return (from: todayStart, to: endOfToday);
      case 'today':
      default:
        return (from: todayStart, to: endOfToday);
    }
  }

  Future<void> _pickCustomRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
      initialDateRange: _customRange ??
          DateTimeRange(start: now.subtract(const Duration(days: 7)), end: now),
    );
    if (picked != null) {
      setState(() {
        _customRange = picked;
        _collRange = 'custom';
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
    _startRefreshTimer();
  }

  void _startRefreshTimer() {
    _refreshTimer?.cancel();
    final interval = _liveGpsMode ? const Duration(seconds: 5) : const Duration(seconds: 30);
    _refreshTimer = Timer.periodic(interval, (_) {
      ref.invalidate(liveAgentLocationsProvider);
      if (_selected != null) {
        final range = _resolveRange();
        final q = (agentId: _selected!.agentId, from: range.from, to: range.to);
        ref.invalidate(agentCollectionsProvider(q));
        ref.invalidate(agentHistoryProvider(q));
      }
    });
  }

  void _toggleLiveGpsMode() {
    setState(() {
      _liveGpsMode = !_liveGpsMode;
    });
    _startRefreshTimer();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _liveAlertTimer?.cancel();
    _pulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  String _lastSeen(T t, DateTime? at) {
    if (at == null) return t.x('admin.no_location');
    final m = DateTime.now().difference(at).inMinutes;
    if (m < 1) return t.x('admin.just_now');
    if (m < 60) return '$m ${t.x('admin.mins_ago')}';
    final h = (m / 60).floor();
    if (h < 24) return '${h}h ${t.x('admin.ago')}';
    return DateFormat('dd MMM, h:mm a').format(at);
  }

  String _formatCollectionTime(T t, DateTime? at) {
    if (at == null) return t.x('admin.just_now');
    final diff = DateTime.now().difference(at);
    if (diff.inMinutes < 1) return t.x('admin.just_now');
    final tf = DateFormat('h:mm a');
    final df = DateFormat('d MMM');
    final now = DateTime.now();
    final isToday = at.day == now.day && at.month == now.month && at.year == now.year;
    return '${isToday ? t.x('admin.range_today') : df.format(at)} · ${tf.format(at)}';
  }

  void _fitAll(AgentLocation a, List<AgentCollection> colls, List<AgentPing> trail) {
    final points = <LatLng>[];
    if (a.hasLocation) points.add(LatLng(a.lat!, a.lng!));
    for (final c in colls) {
      if (c.hasLocation) points.add(LatLng(c.lat!, c.lng!));
    }
    for (final p in trail) {
      points.add(LatLng(p.lat, p.lng));
    }
    if (points.isEmpty) return;
    if (points.length == 1) {
      _mapController.move(points.first, 15);
      return;
    }
    final bounds = LatLngBounds.fromPoints(points);
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.all(48),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final async = ref.watch(liveAgentLocationsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_selected == null ? t.x('admin.agent_tracking') : _selected!.agentName),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_selected != null) {
              setState(() {
                _selected = null;
                _selectedCollection = null;
                _liveAlertCollection = null;
                _mapFull = false;
              });
            } else {
              context.canPop() ? context.pop() : context.go('/dashboard');
            }
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(liveAgentLocationsProvider);
              if (_selected != null) {
                final range = _resolveRange();
                final q = (agentId: _selected!.agentId, from: range.from, to: range.to);
                ref.invalidate(agentCollectionsProvider(q));
                ref.invalidate(agentHistoryProvider(q));
              }
            },
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: EmptyState(icon: Icons.cloud_off, title: err.toString())),
        data: (agents) {
          if (agents.isEmpty) {
            return Center(child: EmptyState(icon: Icons.person_off_outlined, title: t.x('admin.no_agents_active')));
          }
          if (_selected != null) {
            final cur = agents.firstWhere(
              (a) => a.agentId == _selected!.agentId,
              orElse: () => _selected!,
            );
            return _detail(t, cur);
          }
          return _list(t, agents);
        },
      ),
      bottomNavigationBar:
          _mapFull ? null : const AppBottomNav(currentRoute: '/tracking'),
    );
  }

  // ── Agent list ──────────────────────────────────────────────────────────
  Widget _list(T t, List<AgentLocation> agents) {
    final online = agents.where((a) => a.online).length;
    final fmt = ref.watch(currencyFmtProvider);
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(liveAgentLocationsProvider),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: agents.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          if (i == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                '$online / ${agents.length} ${t.x('admin.online_suffix')}',
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary, fontWeight: FontWeight.w700),
              ),
            );
          }
          final a = agents[i - 1];
          return _AgentCard(
            agent: a,
            lastSeen: _lastSeen(t, a.capturedAt),
            fmt: fmt,
            t: t,
            onTap: () {
              setState(() {
                _selected = a;
                _selectedCollection = null;
                _liveAlertCollection = null;
                _mapFull = false;
              });
            },
          );
        },
      ),
    );
  }

  // ── Detail: half/full map + collection details ──────────────────────────
  Widget _detail(T t, AgentLocation a) {
    final fmt = ref.watch(currencyFmtProvider);
    final h = MediaQuery.of(context).size.height;
    final mapHeight = _mapFull ? h : h * 0.44;
    final range = _resolveRange();
    final query = (agentId: a.agentId, from: range.from, to: range.to);
    final trail =
        ref.watch(agentHistoryProvider(query)).value ?? const <AgentPing>[];
    final collections = ref.watch(agentCollectionsProvider(query)).value ??
        const <AgentCollection>[];
    final pinnedCollections =
        collections.where((c) => c.hasLocation).toList(growable: false);

    // Real-time live collection detection
    if (_liveGpsMode && collections.isNotEmpty) {
      if (_seenCollectionIds.isEmpty) {
        _seenCollectionIds.addAll(collections.map((c) => c.id));
      } else {
        for (final c in collections) {
          if (!_seenCollectionIds.contains(c.id)) {
            _seenCollectionIds.add(c.id);
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              setState(() {
                _liveAlertCollection = c;
                _selectedCollection = c;
              });
              if (c.hasLocation) {
                _mapController.move(LatLng(c.lat!, c.lng!), 16.5);
              }
              _liveAlertTimer?.cancel();
              _liveAlertTimer = Timer(const Duration(seconds: 10), () {
                if (mounted) setState(() => _liveAlertCollection = null);
              });
            });
            break;
          }
        }
      }
    }

    return Column(
      children: [
        SizedBox(
          height: mapHeight,
          child: Stack(
            children: [
              if (a.hasLocation)
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: LatLng(a.lat!, a.lng!),
                    initialZoom: 15,
                    onTap: (_, __) => setState(() => _selectedCollection = null),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: _isSatellite
                          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                          : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.zolofund.app',
                    ),
                    // Route the agent actually travelled (ping trail).
                    if (_showTrail && trail.length >= 2)
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: [
                              for (final p in trail) LatLng(p.lat, p.lng),
                            ],
                            strokeWidth: 3.5,
                            color: AppColors.info.withValues(alpha: 0.8),
                          ),
                        ],
                      ),
                    // Ping dots along the trail
                    if (_showTrail && trail.isNotEmpty)
                      CircleLayer(
                        circles: [
                          for (final p in trail)
                            CircleMarker(
                              point: LatLng(p.lat, p.lng),
                              radius: 3,
                              color: AppColors.info,
                              borderColor: Colors.white,
                              borderStrokeWidth: 1,
                            ),
                        ],
                      ),
                    // Live radar pulsing beacon around agent's location
                    if (a.hasLocation && _liveGpsMode)
                      AnimatedBuilder(
                        animation: _pulseController,
                        builder: (_, __) => CircleLayer(
                          circles: [
                            CircleMarker(
                              point: LatLng(a.lat!, a.lng!),
                              radius: 14 + (_pulseController.value * 28),
                              color: (a.online ? AppColors.success : AppColors.primary)
                                  .withValues(alpha: (1.0 - _pulseController.value) * 0.35),
                              borderColor: (a.online ? AppColors.success : AppColors.primary)
                                  .withValues(alpha: (1.0 - _pulseController.value) * 0.7),
                              borderStrokeWidth: 1.5,
                            ),
                          ],
                        ),
                      ),
                    MarkerLayer(
                      markers: [
                        // Customers visited — pinned with their photo
                        for (final c in pinnedCollections)
                          Marker(
                            point: LatLng(c.lat!, c.lng!),
                            width: 44,
                            height: 44,
                            child: GestureDetector(
                              onTap: () {
                                setState(() => _selectedCollection = c);
                                _mapController.move(LatLng(c.lat!, c.lng!), 16.5);
                              },
                              child: _customerPin(c, isSelected: _selectedCollection?.id == c.id),
                            ),
                          ),
                        // Agent's live position dot
                        Marker(
                          point: LatLng(a.lat!, a.lng!),
                          width: 24,
                          height: 24,
                          child: Container(
                            decoration: BoxDecoration(
                              color: a.online ? AppColors.success : AppColors.danger,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 3),
                              boxShadow: const [
                                BoxShadow(color: Colors.black45, blurRadius: 6, offset: Offset(0, 2)),
                              ],
                            ),
                          ),
                        ),
                        // Anchored popup callout directly over the selected collection pin
                        if (_selectedCollection != null && _selectedCollection!.hasLocation)
                          Marker(
                            point: LatLng(_selectedCollection!.lat!, _selectedCollection!.lng!),
                            width: 280,
                            height: 110,
                            alignment: const Alignment(0.0, -1.25),
                            child: _buildCollectionCalloutBubble(t, _selectedCollection!, fmt),
                          ),
                      ],
                    ),
                  ],
                )
              else
                Container(
                  color: AppColors.background,
                  alignment: Alignment.center,
                  child: EmptyState(icon: Icons.location_off_outlined, title: t.x('admin.no_location')),
                ),

              // Live GPS Radar Status pill overlay
              Positioned(
                left: 12,
                top: 12,
                child: AnimatedBuilder(
                  animation: _pulseController,
                  builder: (context, _) {
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.78),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: _liveGpsMode
                              ? AppColors.success.withValues(alpha: 0.4 + (_pulseController.value * 0.6))
                              : AppColors.border,
                          width: 1.5,
                        ),
                        boxShadow: const [
                          BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2)),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _liveGpsMode ? AppColors.success : AppColors.textLight,
                              boxShadow: _liveGpsMode
                                  ? [
                                      BoxShadow(
                                        color: AppColors.success,
                                        blurRadius: 4 + (_pulseController.value * 6),
                                        spreadRadius: 1 + (_pulseController.value * 2),
                                      ),
                                    ]
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _liveGpsMode ? t.x('admin.live_gps_mode') : t.x('admin.offline'),
                            style: AppTypography.extraTiny.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                          if (_liveGpsMode) ...[
                            const SizedBox(width: 4),
                            Text(
                              '• 5s',
                              style: AppTypography.extraTiny.copyWith(
                                color: AppColors.success,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
              ),

              // Real-time live collection banner alert
              if (_liveAlertCollection != null)
                Positioned(
                  top: 12,
                  left: 12,
                  right: 64,
                  child: _buildLiveAlertBanner(t, _liveAlertCollection!, fmt),
                ),

              // Map Control floating toolbar on the right
              Positioned(
                right: 12,
                top: 12,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _mapToolbarButton(
                      icon: _liveGpsMode ? Icons.sensors : Icons.sensors_off,
                      tooltip: t.x('admin.live_gps_mode'),
                      isActive: _liveGpsMode,
                      activeColor: AppColors.success,
                      onPressed: _toggleLiveGpsMode,
                    ),
                    const SizedBox(height: 6),
                    _mapToolbarButton(
                      icon: _isSatellite ? Icons.map_outlined : Icons.satellite_alt_outlined,
                      tooltip: _isSatellite ? t.x('admin.streets') : t.x('admin.satellite'),
                      onPressed: () => setState(() => _isSatellite = !_isSatellite),
                    ),
                    const SizedBox(height: 6),
                    _mapToolbarButton(
                      icon: Icons.route,
                      tooltip: 'Trail',
                      isActive: _showTrail,
                      onPressed: () => setState(() => _showTrail = !_showTrail),
                    ),
                    const SizedBox(height: 6),
                    if (a.hasLocation)
                      _mapToolbarButton(
                        icon: Icons.my_location,
                        tooltip: t.x('admin.center_agent'),
                        onPressed: () => _mapController.move(LatLng(a.lat!, a.lng!), 16),
                      ),
                    if (a.hasLocation) const SizedBox(height: 6),
                    _mapToolbarButton(
                      icon: Icons.zoom_out_map,
                      tooltip: t.x('admin.fit_all'),
                      onPressed: () => _fitAll(a, pinnedCollections, trail),
                    ),
                    const SizedBox(height: 6),
                    _mapToolbarButton(
                      icon: Icons.add,
                      tooltip: 'Zoom In',
                      onPressed: () {
                        final z = _mapController.camera.zoom;
                        _mapController.move(_mapController.camera.center, z + 1);
                      },
                    ),
                    const SizedBox(height: 4),
                    _mapToolbarButton(
                      icon: Icons.remove,
                      tooltip: 'Zoom Out',
                      onPressed: () {
                        final z = _mapController.camera.zoom;
                        _mapController.move(_mapController.camera.center, z - 1);
                      },
                    ),
                    const SizedBox(height: 6),
                    _mapToolbarButton(
                      icon: _mapFull ? Icons.fullscreen_exit : Icons.fullscreen,
                      tooltip: _mapFull ? 'Exit Fullscreen' : 'Fullscreen',
                      onPressed: () => setState(() => _mapFull = !_mapFull),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (!_mapFull)
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    _statusDot(a.online),
                    const SizedBox(width: 6),
                    Text(
                      a.online ? t.x('admin.online') : t.x('admin.offline'),
                      style: AppTypography.body.copyWith(
                        color: a.online ? AppColors.success : AppColors.textLight,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    Text(_lastSeen(t, a.capturedAt), style: AppTypography.caption),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _stat(fmt.format(a.todayCollected), t.x('admin.collected_today'), AppColors.success)),
                    const SizedBox(width: 12),
                    Expanded(child: _stat('${a.todayEntries}', t.x('admin.entries_today'), AppColors.primary)),
                  ],
                ),
                const SizedBox(height: 14),
                if (a.hasLocation)
                  _row(Icons.location_on_outlined, '${a.lat!.toStringAsFixed(5)}, ${a.lng!.toStringAsFixed(5)}'),
                if (a.agentPhone.isNotEmpty) _row(Icons.phone_outlined, a.agentPhone),
                const SizedBox(height: 18),
                _collectionsTable(t, a.agentId),
                const SizedBox(height: 18),
                _trackingLog(t, trail),
              ],
            ),
          ),
      ],
    );
  }

  /// Map Toolbar action icon button
  Widget _mapToolbarButton({
    required IconData icon,
    required String tooltip,
    required VoidCallback onPressed,
    bool isActive = false,
    Color? activeColor,
  }) {
    final effectiveActiveColor = activeColor ?? AppColors.primary;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: isActive ? effectiveActiveColor : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: isActive ? effectiveActiveColor : AppColors.border,
            width: 1,
          ),
        ),
        elevation: 3,
        shadowColor: Colors.black26,
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onPressed,
          child: SizedBox(
            width: 36,
            height: 36,
            child: Icon(
              icon,
              size: 20,
              color: isActive ? Colors.white : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }

  /// On-map Anchored Callout Bubble above a selected collection pin
  Widget _buildCollectionCalloutBubble(T t, AgentCollection c, NumberFormat fmt) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(10),
          color: AppColors.surface,
          shadowColor: Colors.black38,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.success, width: 1.5),
            ),
            child: Row(
              children: [
                _customerPin(c, isSelected: true),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.check_circle, size: 12, color: AppColors.success),
                          const SizedBox(width: 3),
                          Text(
                            t.x('admin.payment_collected'),
                            style: AppTypography.extraTiny.copyWith(
                              color: AppColors.success,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const Spacer(),
                          InkWell(
                            onTap: () => setState(() => _selectedCollection = null),
                            child: const Icon(Icons.close, size: 14, color: AppColors.textLight),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Collected ${fmt.format(c.receivedAmount)} from ${c.customerName}',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 1),
                      Row(
                        children: [
                          const Icon(Icons.access_time, size: 10, color: AppColors.textLight),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              _formatCollectionTime(t, c.submittedAt),
                              style: AppTypography.extraTiny.copyWith(color: AppColors.textSecondary),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (c.paymentMode != null && c.paymentMode!.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                c.paymentMode!,
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        CustomPaint(
          size: const Size(14, 7),
          painter: _TrianglePainter(color: AppColors.surface, borderColor: AppColors.success),
        ),
      ],
    );
  }

  /// Real-time popup banner when money is collected in Live GPS Mode
  Widget _buildLiveAlertBanner(T t, AgentCollection c, NumberFormat fmt) {
    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(12),
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF0F2F1E),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.success, width: 1.5),
          boxShadow: const [
            BoxShadow(color: Colors.black45, blurRadius: 10, offset: Offset(0, 4)),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: const BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.payments, size: 18, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Text(
                        t.x('admin.new_collection_alert'),
                        style: const TextStyle(
                          color: Color(0xFF86EFAC),
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '· ${_formatCollectionTime(t, c.submittedAt)}',
                        style: const TextStyle(color: Colors.white70, fontSize: 10),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Collected ${fmt.format(c.receivedAmount)} from ${c.customerName}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            if (c.hasLocation)
              TextButton(
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.success,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                onPressed: () {
                  setState(() => _selectedCollection = c);
                  _mapController.move(LatLng(c.lat!, c.lng!), 16.5);
                },
                child: Text(
                  t.x('admin.show_on_map'),
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            IconButton(
              icon: const Icon(Icons.close, size: 16, color: Colors.white70),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              onPressed: () => setState(() => _liveAlertCollection = null),
            ),
          ],
        ),
      ),
    );
  }

  /// Tracking log — every recorded location with its time (newest first),
  /// same points as the dots on the map. Follows the active date filter.
  Widget _trackingLog(T t, List<AgentPing> trail) {
    final rows = trail.reversed.take(200).toList(growable: false);
    final tf = DateFormat('dd MMM · h:mm:ss a');
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
            child: Row(
              children: [
                Text(
                  t.x('admin.tracking_log'),
                  style: AppTypography.bodyLarge
                      .copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                Text(
                  '${trail.length} ${t.x('admin.points')}',
                  style: AppTypography.caption
                      .copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Center(
                child: Text(
                  t.x('admin.no_tracking_points'),
                  style: AppTypography.caption,
                ),
              ),
            )
          else
            for (final p in rows)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    Icon(
                      p.isMocked
                          ? Icons.gps_off_outlined
                          : Icons.place_outlined,
                      size: 16,
                      color:
                          p.isMocked ? AppColors.danger : AppColors.info,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tf.format(p.capturedAt),
                            style: AppTypography.body
                                .copyWith(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            '${p.lat.toStringAsFixed(5)}, ${p.lng.toStringAsFixed(5)}'
                            '${p.accuracyM != null ? ' · ±${p.accuracyM!.round()}m' : ''}'
                            '${p.isMocked ? ' · FAKE GPS' : ''}',
                            style: AppTypography.extraTiny.copyWith(
                              color: p.isMocked
                                  ? AppColors.danger
                                  : AppColors.textLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (p.speedMps != null && p.speedMps! > 0)
                      Text(
                        '${(p.speedMps! * 3.6).toStringAsFixed(0)} km/h',
                        style: AppTypography.caption
                            .copyWith(color: AppColors.textSecondary),
                      ),
                  ],
                ),
              ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }

  /// Customer photo pin at the collection spot — photo ringed in green, with
  /// an icon fallback when the customer has no photo.
  Widget _customerPin(AgentCollection c, {bool isSelected = false}) {
    final photo = c.customerPhoto;
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: isSelected ? AppColors.primary : AppColors.success,
          width: isSelected ? 3.5 : 2.5,
        ),
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: isSelected
                ? AppColors.primary.withValues(alpha: 0.5)
                : Colors.black38,
            blurRadius: isSelected ? 8 : 5,
          ),
        ],
      ),
      child: ClipOval(
        child: photo == null || photo.isEmpty
            ? const Icon(Icons.person, size: 26, color: AppColors.textLight)
            : Image(
                image: authedImage(ref, photo),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.person,
                  size: 26,
                  color: AppColors.textLight,
                ),
              ),
      ),
    );
  }

  // Date-range filter chips: Today / 7 days / 30 days / Last month / Custom.
  Widget _rangeChips(T t) {
    final items = <(String, String)>[
      ('today', t.x('admin.range_today')),
      ('7d', t.x('admin.range_7d')),
      ('30d', t.x('admin.range_30d')),
      ('lastmonth', t.x('admin.range_lastmonth')),
      ('custom', t.x('admin.range_custom')),
    ];
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (key, label) = items[i];
          final selected = _collRange == key;
          final isCustom = key == 'custom';
          var text = label;
          if (isCustom && selected && _customRange != null) {
            final f = DateFormat('d MMM');
            text = '${f.format(_customRange!.start)} – ${f.format(_customRange!.end)}';
          }
          return ChoiceChip(
            label: Text(text),
            selected: selected,
            showCheckmark: false,
            backgroundColor: AppColors.background,
            selectedColor: AppColors.primaryLight,
            labelStyle: AppTypography.caption.copyWith(
              color: selected ? AppColors.primaryDark : AppColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
            side: BorderSide(
              color: selected ? AppColors.primary : AppColors.border,
            ),
            onSelected: (_) {
              if (isCustom) {
                _pickCustomRange();
              } else {
                setState(() => _collRange = key);
              }
            },
          );
        },
      ),
    );
  }

  // ── Collections table (customer · due · collected) with date filter ──────
  Widget _collectionsTable(T t, String agentId) {
    final fmt = ref.watch(currencyFmtProvider);
    final range = _resolveRange();
    final async = ref.watch(
      agentCollectionsProvider(
        (agentId: agentId, from: range.from, to: range.to),
      ),
    );

    Widget headerCell(String label, {TextAlign align = TextAlign.left}) => Text(
          label,
          textAlign: align,
          style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),
        );

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
            child: Text(
              t.x('admin.collections'),
              style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          _rangeChips(t),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            color: AppColors.background,
            child: Row(
              children: [
                Expanded(flex: 5, child: headerCell(t.x('admin.col_customer'))),
                Expanded(flex: 3, child: headerCell(t.x('admin.col_due'), align: TextAlign.right)),
                Expanded(flex: 3, child: headerCell(t.x('admin.col_collected'), align: TextAlign.right)),
              ],
            ),
          ),
          async.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(20),
              child: Center(
                child: SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.all(16),
              child: Text(e.toString(), style: AppTypography.caption),
            ),
            data: (rows) {
              if (rows.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.all(20),
                  child: Center(
                    child: Text(t.x('admin.no_collections'), style: AppTypography.caption),
                  ),
                );
              }
              final totalDue = rows.fold<double>(0, (s, r) => s + r.dueAmount);
              final totalCollected = rows.fold<double>(0, (s, r) => s + r.receivedAmount);
              return Column(
                children: [
                  for (final r in rows)
                    Material(
                      color: _selectedCollection?.id == r.id
                          ? AppColors.primary.withValues(alpha: 0.08)
                          : Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          setState(() => _selectedCollection = r);
                          if (r.hasLocation) {
                            _mapController.move(LatLng(r.lat!, r.lng!), 16.5);
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: const BoxDecoration(
                            border: Border(top: BorderSide(color: AppColors.border)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 5,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        if (r.hasLocation)
                                          Padding(
                                            padding: const EdgeInsets.only(right: 4),
                                            child: Icon(
                                              Icons.location_on,
                                              size: 14,
                                              color: _selectedCollection?.id == r.id
                                                  ? AppColors.primary
                                                  : AppColors.success,
                                            ),
                                          ),
                                        Expanded(
                                          child: Text(
                                            r.customerName,
                                            style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (r.customerCode.isNotEmpty)
                                      Text(r.customerCode, style: AppTypography.extraTiny),
                                  ],
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(
                                  fmt.format(r.dueAmount),
                                  textAlign: TextAlign.right,
                                  style: AppTypography.body,
                                ),
                              ),
                              Expanded(
                                flex: 3,
                                child: Text(
                                  fmt.format(r.receivedAmount),
                                  textAlign: TextAlign.right,
                                  style: AppTypography.body.copyWith(
                                    color: AppColors.success,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: const BoxDecoration(
                      color: AppColors.background,
                      border: Border(top: BorderSide(color: AppColors.border)),
                      borderRadius: BorderRadius.vertical(bottom: Radius.circular(AppTokens.radius)),
                    ),
                    child: Row(
                      children: [
                        Expanded(flex: 5, child: Text(t.x('admin.total'), style: AppTypography.label)),
                        Expanded(
                          flex: 3,
                          child: Text(fmt.format(totalDue),
                              textAlign: TextAlign.right, style: AppTypography.label,),
                        ),
                        Expanded(
                          flex: 3,
                          child: Text(
                            fmt.format(totalCollected),
                            textAlign: TextAlign.right,
                            style: AppTypography.label.copyWith(color: AppColors.success),
                          ),
                        ),
                      ],
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

  Widget _statusDot(bool online) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: online ? AppColors.success : AppColors.textLight, shape: BoxShape.circle),
      );

  Widget _stat(String value, String label, Color color) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(AppTokens.radius), boxShadow: AppTokens.shadow),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: AppTypography.heroNumber.copyWith(fontSize: 20, color: color)),
            Text(label, style: AppTypography.caption),
          ],
        ),
      );

  Widget _row(IconData icon, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          Icon(icon, size: 16, color: AppColors.textLight),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: AppTypography.body)),
        ],),
      );
}

class _AgentCard extends StatelessWidget {
  const _AgentCard({required this.agent, required this.lastSeen, required this.fmt, required this.t, required this.onTap});
  final AgentLocation agent;
  final String lastSeen;
  final NumberFormat fmt;
  final T t;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppTokens.radius), boxShadow: AppTokens.shadow),
          child: Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: Text(agent.agentName.isNotEmpty ? agent.agentName[0].toUpperCase() : '?',
                        style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: agent.online ? AppColors.success : AppColors.textLight,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.surface, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(agent.agentName, style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Row(children: [
                      Icon(agent.hasLocation ? Icons.location_on_outlined : Icons.location_off_outlined,
                          size: 13, color: AppColors.textLight,),
                      const SizedBox(width: 3),
                      Expanded(child: Text(lastSeen, style: AppTypography.caption, overflow: TextOverflow.ellipsis)),
                    ],),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(fmt.format(agent.todayCollected),
                      style: AppTypography.bodyLarge.copyWith(color: AppColors.success, fontWeight: FontWeight.w800),),
                  Text('${agent.todayEntries} ${t.x('admin.entries_today')}', style: AppTypography.extraTiny),
                ],
              ),
              const Icon(Icons.chevron_right, color: AppColors.textLight),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrianglePainter extends CustomPainter {
  _TrianglePainter({required this.color, required this.borderColor});
  final Color color;
  final Color borderColor;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final strokePaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final path = ui.Path()
      ..moveTo(0, 0)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, 0)
      ..close();

    canvas.drawPath(path, paint);
    canvas.drawPath(path, strokePaint);
  }

  @override
  bool shouldRepaint(covariant _TrianglePainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.borderColor != borderColor;
}

