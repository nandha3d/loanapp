import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart' hide Path;
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/gps/gps_service.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/collection_entry.dart';
import 'package:zolofund/data/services/customer_service.dart';
import 'package:zolofund/features/collection/collection_screen.dart';
import 'package:zolofund/features/collection/quick_collect_sheet.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';

/// Aggregated customer map pin model for field agents.
class CustomerMapPin {
  const CustomerMapPin({
    required this.customerId,
    required this.customerName,
    required this.customerCode,
    required this.point,
    required this.status,
    required this.dueAmount,
    required this.collectedAmount,
    required this.outstanding,
    required this.isPaid,
    required this.isOverdue,
    this.customerPhoto,
    this.phone,
    this.routeName,
    this.loanId,
    this.instalmentId,
    this.primaryRow,
    this.allRows = const [],
  });

  final String customerId;
  final String customerName;
  final String customerCode;
  final LatLng point;
  final String status; // 'paid' | 'due' | 'overdue'
  final double dueAmount;
  final double collectedAmount;
  final double outstanding;
  final bool isPaid;
  final bool isOverdue;
  final String? customerPhoto;
  final String? phone;
  final String? routeName;
  final String? loanId;
  final String? instalmentId;
  final CollectionRow? primaryRow;
  final List<CollectionRow> allRows;

  Color get statusColor {
    if (isPaid) return const Color(0xFF10B981);
    if (isOverdue) return const Color(0xFFEF4444);
    return const Color(0xFFF59E0B);
  }
}

/// Provider that aggregates all customers with valid GPS coordinates for the agent.
final agentCustomerPinsProvider =
    FutureProvider.autoDispose<List<CustomerMapPin>>((ref) async {
  final pins = <CustomerMapPin>[];
  final seenCustomerIds = <String>{};

  // 1. Fetch today's collection rows (primary source: real-time dues, collections, photos & GPS)
  try {
    final rows = await ref.watch(collectionTodayProvider.future);
    final grouped = <String, List<CollectionRow>>{};
    for (final r in rows) {
      if (r.lat != null && r.lng != null) {
        grouped.putIfAbsent(r.customerId, () => []).add(r);
      }
    }

    for (final entry in grouped.entries) {
      final customerRows = entry.value;
      final primary = customerRows.first;
      final totalDue =
          customerRows.fold<double>(0, (sum, r) => sum + r.dueAmount);
      final totalCollected =
          customerRows.fold<double>(0, (sum, r) => sum + r.receivedAmount);
      final totalOutstanding =
          customerRows.fold<double>(0, (sum, r) => sum + r.outstanding);
      final isPaid = customerRows.every((r) => r.isResolved);
      final isOverdue =
          customerRows.any((r) => r.isOverdueBucket && !r.isResolved);

      final statusStr = isPaid
          ? 'paid'
          : isOverdue
              ? 'overdue'
              : 'due';

      seenCustomerIds.add(primary.customerId);

      pins.add(
        CustomerMapPin(
          customerId: primary.customerId,
          customerName: primary.customerName,
          customerCode: primary.customerCode,
          point: LatLng(primary.lat!, primary.lng!),
          status: statusStr,
          dueAmount: totalDue,
          collectedAmount: totalCollected,
          outstanding: totalOutstanding,
          isPaid: isPaid,
          isOverdue: isOverdue,
          customerPhoto: primary.customerPhoto,
          phone: primary.customerPhone,
          routeName: primary.routeName,
          loanId: primary.loanId,
          instalmentId: primary.instalmentId,
          primaryRow: primary,
          allRows: customerRows,
        ),
      );
    }
  } catch (_) {}

  // 2. Fetch remaining geotagged customers belonging to the agent who borrowed and currently have an active loan
  try {
    final customers = await ref.read(customerServiceProvider).list(
      limit: 100,
      hasActiveLoan: true,
    );
    for (final c in customers) {
      if (seenCustomerIds.contains(c.id)) continue;
      // Strictly filter: only include customers who borrowed and currently have an active loan. Never show closed loan customers.
      if (!c.hasActiveLoan) continue;

      LatLng? pt;
      if (c.lat != null && c.lng != null) {
        pt = LatLng(c.lat!, c.lng!);
      } else {
        for (final cp in c.collectionPoints) {
          if (cp.latitude != null && cp.longitude != null) {
            pt = LatLng(cp.latitude!, cp.longitude!);
            break;
          }
        }
      }

      if (pt == null) continue;
      seenCustomerIds.add(c.id);

      pins.add(
        CustomerMapPin(
          customerId: c.id,
          customerName: c.name,
          customerCode: c.customerCode,
          point: pt,
          status: 'none',
          dueAmount: 0,
          collectedAmount: 0,
          outstanding: c.activeLoanPrincipal,
          isPaid: false,
          isOverdue: false,
          customerPhoto: c.photoUrl,
          phone: c.phone,
          routeName: c.routeName,
        ),
      );
    }
  } catch (_) {}

  return pins;
});

/// Dedicated, fully customer-oriented interactive map screen for field agents.
class AgentCustomerMapScreen extends ConsumerStatefulWidget {
  const AgentCustomerMapScreen({super.key});

  @override
  ConsumerState<AgentCustomerMapScreen> createState() =>
      _AgentCustomerMapScreenState();
}

class _AgentCustomerMapScreenState extends ConsumerState<AgentCustomerMapScreen>
    with SingleTickerProviderStateMixin {
  final MapController _mapController = MapController();
  late final AnimationController _pulseController;

  CustomerMapPin? _selectedCustomer;
  LatLng? _agentLocation;
  bool _locatingAgent = false;
  String _filter = 'all'; // 'all' | 'due' | 'overdue' | 'paid'
  String _searchQuery = '';
  bool _searchOpen = false;
  final TextEditingController _searchCtrl = TextEditingController();

  bool _initialFitted = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
    _fetchAgentLocation();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchAgentLocation() async {
    if (_locatingAgent) return;
    setState(() => _locatingAgent = true);
    try {
      final pos = await ref.read(gpsServiceProvider).currentOrLastKnown();
      if (mounted && pos != null) {
        setState(() {
          _agentLocation = LatLng(pos.latitude, pos.longitude);
          _locatingAgent = false;
        });
      } else if (mounted) {
        setState(() => _locatingAgent = false);
      }
    } catch (_) {
      if (mounted) setState(() => _locatingAgent = false);
    }
  }

  void _fitAllPins(List<CustomerMapPin> pins) {
    final points = <LatLng>[];
    if (_agentLocation != null) points.add(_agentLocation!);
    for (final p in pins) {
      points.add(p.point);
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
        padding: const EdgeInsets.fromLTRB(40, 60, 40, 160),
      ),
    );
  }

  void _selectCustomer(CustomerMapPin pin) {
    setState(() => _selectedCustomer = pin);

    // Fit camera to both agent and customer if agent location is available
    if (_agentLocation != null) {
      final bounds = LatLngBounds.fromPoints([_agentLocation!, pin.point]);
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.fromLTRB(50, 70, 50, 240),
        ),
      );
    } else {
      _mapController.move(pin.point, 15.5);
    }
  }

  void _clearSelectedCustomer() {
    setState(() => _selectedCustomer = null);
  }

  double? _calculateDistance(LatLng target) {
    if (_agentLocation == null) return null;
    return Geolocator.distanceBetween(
      _agentLocation!.latitude,
      _agentLocation!.longitude,
      target.latitude,
      target.longitude,
    );
  }

  String _formatDistance(double? meters) {
    if (meters == null) return '';
    if (meters < 1000) {
      return '${meters.round()} m';
    }
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }

  String _formatTravelTime(double? meters) {
    if (meters == null) return '';
    // Assume average 25 km/h urban speed
    final minutes = math.max(1, (meters / (25 * 1000 / 60)).round());
    return '~$minutes min';
  }

  Future<void> _launchDirections(CustomerMapPin pin) async {
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${pin.point.latitude},${pin.point.longitude}&travelmode=driving',
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _callPhone(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _openQuickCollect(CustomerMapPin pin) {
    if (pin.primaryRow != null) {
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => QuickCollectSheet(
          row: pin.primaryRow!,
          scopeRows: pin.allRows,
        ),
      ).then((_) {
        ref.invalidate(collectionTodayProvider);
        ref.invalidate(agentCustomerPinsProvider);
      });
    } else {
      context.push('/customers/${pin.customerId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final pinsAsync = ref.watch(agentCustomerPinsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: _searchOpen
            ? TextField(
                controller: _searchCtrl,
                autofocus: true,
                style: const TextStyle(color: Colors.white, fontSize: 16),
                decoration: InputDecoration(
                  hintText: t.x('map.search_customer'),
                  hintStyle: TextStyle(color: Colors.white.withAlpha(160)),
                  border: InputBorder.none,
                ),
                onChanged: (val) => setState(() => _searchQuery = val.trim()),
              )
            : Text(t.x('map.customer_map')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_searchOpen) {
              setState(() {
                _searchOpen = false;
                _searchQuery = '';
                _searchCtrl.clear();
              });
            } else {
              context.canPop() ? context.pop() : context.go('/dashboard');
            }
          },
        ),
        actions: [
          IconButton(
            icon: Icon(_searchOpen ? Icons.close : Icons.search_rounded),
            onPressed: () {
              setState(() {
                _searchOpen = !_searchOpen;
                if (!_searchOpen) {
                  _searchQuery = '';
                  _searchCtrl.clear();
                }
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () {
              ref.invalidate(collectionTodayProvider);
              ref.invalidate(agentCustomerPinsProvider);
              _fetchAgentLocation();
            },
          ),
        ],
      ),
      body: pinsAsync.when(
        loading: () => const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(strokeWidth: 2.5),
              SizedBox(height: 12),
              Text(
                'Loading customer locations...',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ],
          ),
        ),
        error: (err, _) => Center(
          child: EmptyState(
            icon: Icons.cloud_off,
            title: t.x('err.could_not_load'),
            subtitle: err.toString(),
          ),
        ),
        data: (allPins) {
          if (allPins.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 68,
                      height: 68,
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.location_off_rounded,
                        size: 34,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      t.x('map.no_customers_found'),
                      style: AppTypography.sectionTitle,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'No customers with recorded GPS addresses or collection points found for your routes.',
                      style: AppTypography.bodySmall
                          .copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: () => context.go('/collection'),
                      icon: const Icon(Icons.list_alt_rounded, size: 18),
                      label: const Text('Go to Collection List'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          // Apply filters and search query
          final filteredPins = allPins.where((p) {
            if (_filter == 'due' && (p.isPaid || !p.status.contains('due'))) {
              return false;
            }
            if (_filter == 'paid' && !p.isPaid) return false;
            if (_filter == 'overdue' && !p.isOverdue) return false;

            if (_searchQuery.isNotEmpty) {
              final q = _searchQuery.toLowerCase();
              final matchesName = p.customerName.toLowerCase().contains(q);
              final matchesCode = p.customerCode.toLowerCase().contains(q);
              final matchesRoute =
                  p.routeName?.toLowerCase().contains(q) ?? false;
              if (!matchesName && !matchesCode && !matchesRoute) return false;
            }
            return true;
          }).toList();

          // Auto-fit on first load
          if (!_initialFitted && filteredPins.isNotEmpty) {
            _initialFitted = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _fitAllPins(filteredPins);
            });
          }

          // Compute KPI totals
          final totalDue = allPins.fold<double>(0, (s, p) => s + p.dueAmount);
          final totalCollected =
              allPins.fold<double>(0, (s, p) => s + p.collectedAmount);
          final paidCount = allPins.where((p) => p.isPaid).length;
          final dueCount =
              allPins.where((p) => !p.isPaid && p.dueAmount > 0).length;
          final overdueCount = allPins.where((p) => p.isOverdue).length;

          // Polyline route if customer is selected
          final routePoints = <LatLng>[];
          if (_selectedCustomer != null && _agentLocation != null) {
            routePoints.add(_agentLocation!);
            routePoints.add(_selectedCustomer!.point);
          }

          return Stack(
            children: [
              // ── FlutterMap ────────────────────────────────────────────────
              FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: _agentLocation ??
                      (filteredPins.isNotEmpty
                          ? filteredPins.first.point
                          : const LatLng(20.5937, 78.9629)),
                  initialZoom: 13.5,
                  onTap: (_, __) {
                    if (_selectedCustomer != null) {
                      _clearSelectedCustomer();
                    }
                  },
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.zolofund.app',
                  ),

                  // Route Polyline
                  if (routePoints.length >= 2)
                    PolylineLayer(
                      polylines: [
                        // Soft glow underlay
                        Polyline(
                          points: routePoints,
                          color: const Color(0xFF2563EB).withAlpha(80),
                          strokeWidth: 8,
                          strokeCap: StrokeCap.round,
                          strokeJoin: StrokeJoin.round,
                        ),
                        // Main direct route line
                        Polyline(
                          points: routePoints,
                          color: const Color(0xFF2563EB),
                          strokeWidth: 4,
                          strokeCap: StrokeCap.round,
                          strokeJoin: StrokeJoin.round,
                        ),
                      ],
                    ),

                  // Markers
                  MarkerLayer(
                    markers: [
                      // Agent's live location marker
                      if (_agentLocation != null)
                        Marker(
                          point: _agentLocation!,
                          width: 44,
                          height: 44,
                          alignment: Alignment.center,
                          child: AnimatedBuilder(
                            animation: _pulseController,
                            builder: (ctx, child) {
                              final wave = _pulseController.value;
                              return Stack(
                                alignment: Alignment.center,
                                children: [
                                  Container(
                                    width: 44 * wave,
                                    height: 44 * wave,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: const Color(0xFF2563EB)
                                          .withValues(alpha: 1 - wave),
                                    ),
                                  ),
                                  Container(
                                    width: 22,
                                    height: 22,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: const Color(0xFF2563EB),
                                      border: Border.all(
                                        color: Colors.white,
                                        width: 2.5,
                                      ),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Colors.black38,
                                          blurRadius: 4,
                                          offset: Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: const Center(
                                      child: Icon(
                                        Icons.navigation_rounded,
                                        size: 12,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),

                      // Customer Photo Pins
                      for (final pin in filteredPins)
                        Marker(
                          point: pin.point,
                          width: _selectedCustomer?.customerId == pin.customerId
                              ? 68
                              : 58,
                          height:
                              _selectedCustomer?.customerId == pin.customerId
                                  ? 78
                                  : 68,
                          alignment: Alignment.topCenter,
                          child: GestureDetector(
                            onTap: () => _selectCustomer(pin),
                            child: _CustomerMapPinWidget(
                              pin: pin,
                              fmt: fmt,
                              isSelected: _selectedCustomer?.customerId ==
                                  pin.customerId,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),

              // ── Top Bar: KPI Summary & Filter Chips ──────────────────────
              Positioned(
                top: 10,
                left: 12,
                right: 12,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Dynamic KPI summary strip
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(240),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: AppTokens.shadow,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  t.x('map.active_customers'),
                                  style: AppTypography.extraTiny.copyWith(
                                    color: AppColors.textLight,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 9,
                                  ),
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  '${filteredPins.length} ${t.x('admin.points')}',
                                  style: AppTypography.bodySmall.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 1,
                            height: 26,
                            color: AppColors.border,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  t.x('map.total_due'),
                                  style: AppTypography.extraTiny.copyWith(
                                    color: AppColors.textLight,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 9,
                                  ),
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  fmt.format(totalDue),
                                  style: AppTypography.bodySmall.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFFEF4444),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 1,
                            height: 26,
                            color: AppColors.border,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  t.x('map.total_collected'),
                                  style: AppTypography.extraTiny.copyWith(
                                    color: AppColors.textLight,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 9,
                                  ),
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  fmt.format(totalCollected),
                                  style: AppTypography.bodySmall.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF10B981),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Filter Chips Row
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _FilterPill(
                            label: '${t.x('map.all_filter')} (${allPins.length})',
                            selected: _filter == 'all',
                            onTap: () => setState(() => _filter = 'all'),
                          ),
                          const SizedBox(width: 6),
                          _FilterPill(
                            label: '${t.x('map.due_filter')} ($dueCount)',
                            selected: _filter == 'due',
                            activeColor: const Color(0xFFF59E0B),
                            onTap: () => setState(() => _filter = 'due'),
                          ),
                          const SizedBox(width: 6),
                          _FilterPill(
                            label: '${t.x('map.overdue_filter')} ($overdueCount)',
                            selected: _filter == 'overdue',
                            activeColor: const Color(0xFFEF4444),
                            onTap: () => setState(() => _filter = 'overdue'),
                          ),
                          const SizedBox(width: 6),
                          _FilterPill(
                            label: '${t.x('map.paid_filter')} ($paidCount)',
                            selected: _filter == 'paid',
                            activeColor: const Color(0xFF10B981),
                            onTap: () => setState(() => _filter = 'paid'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // ── Floating Action Buttons (Right side) ──────────────────────
              Positioned(
                bottom: _selectedCustomer != null ? 240 : 16,
                right: 14,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Clear Route button (if customer is selected)
                    if (_selectedCustomer != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: FloatingActionButton.small(
                          heroTag: 'clear_route_btn',
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFFEF4444),
                          elevation: 3,
                          onPressed: _clearSelectedCustomer,
                          tooltip: t.x('map.clear_route'),
                          child: const Icon(Icons.close_rounded, size: 20),
                        ),
                      ),

                    // Fit All Pins button
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: FloatingActionButton.small(
                        heroTag: 'fit_all_pins_btn',
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.textPrimary,
                        elevation: 3,
                        onPressed: () => _fitAllPins(filteredPins),
                        tooltip: 'Fit All Customers',
                        child:
                            const Icon(Icons.crop_free_rounded, size: 20),
                      ),
                    ),

                    // My Location button
                    FloatingActionButton(
                      heroTag: 'my_location_btn',
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 4,
                      onPressed: () async {
                        await _fetchAgentLocation();
                        if (_agentLocation != null) {
                          _mapController.move(_agentLocation!, 16);
                        }
                      },
                      tooltip: t.x('map.my_location'),
                      child: _locatingAgent
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.my_location_rounded, size: 22),
                    ),
                  ],
                ),
              ),

              // ── Bottom Selected Customer Card ─────────────────────────────
              if (_selectedCustomer != null)
                Positioned(
                  bottom: 12,
                  left: 12,
                  right: 12,
                  child: _SelectedCustomerCard(
                    pin: _selectedCustomer!,
                    distance: _calculateDistance(_selectedCustomer!.point),
                    distanceStr: _formatDistance(
                      _calculateDistance(_selectedCustomer!.point),
                    ),
                    travelTimeStr: _formatTravelTime(
                      _calculateDistance(_selectedCustomer!.point),
                    ),
                    fmt: fmt,
                    t: t,
                    onDirections: () => _launchDirections(_selectedCustomer!),
                    onCall: () => _callPhone(_selectedCustomer!.phone),
                    onCollect: () => _openQuickCollect(_selectedCustomer!),
                    onClose: _clearSelectedCustomer,
                  ),
                ),
            ],
          );
        },
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/tracking'),
    );
  }
}

// ── Customer Map Marker Widget ────────────────────────────────────────────────
class _CustomerMapPinWidget extends ConsumerWidget {
  const _CustomerMapPinWidget({
    required this.pin,
    required this.fmt,
    required this.isSelected,
  });

  final CustomerMapPin pin;
  final NumberFormat fmt;
  final bool isSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasPhoto =
        pin.customerPhoto != null && pin.customerPhoto!.trim().isNotEmpty;
    final statusColor = pin.statusColor;

    final amountText = pin.isPaid
        ? 'PAID'
        : pin.dueAmount > 0
            ? fmt.format(pin.dueAmount)
            : '₹0';

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Avatar circle with border
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: isSelected ? 44 : 38,
          height: isSelected ? 44 : 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            border: Border.all(
              color: statusColor,
              width: isSelected ? 3.5 : 2.5,
            ),
            boxShadow: [
              BoxShadow(
                color: isSelected
                    ? statusColor.withAlpha(120)
                    : Colors.black.withAlpha(50),
                blurRadius: isSelected ? 8 : 4,
                spreadRadius: isSelected ? 2 : 0,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ClipOval(
            child: hasPhoto
                ? Image(
                    image: authedImage(
                      ref,
                      pin.customerPhoto!,
                    ),
                    fit: BoxFit.cover,
                  )
                : Container(
                    color: statusColor.withAlpha(30),
                    alignment: Alignment.center,
                    child: Text(
                      pin.customerName.isNotEmpty
                          ? pin.customerName[0].toUpperCase()
                          : '?',
                      style: TextStyle(
                        color: statusColor,
                        fontWeight: FontWeight.w800,
                        fontSize: isSelected ? 18 : 15,
                      ),
                    ),
                  ),
          ),
        ),

        // Downward pointer tail
        CustomPaint(
          size: const Size(10, 5),
          painter: _PointerPainter(color: statusColor),
        ),

        const SizedBox(height: 2),

        // Compact Amount Pill Tag
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: statusColor.withAlpha(140),
              width: 1,
            ),
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 3,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: Text(
            amountText,
            style: TextStyle(
              color: statusColor,
              fontWeight: FontWeight.w800,
              fontSize: 9.5,
              letterSpacing: 0.2,
            ),
          ),
        ),
      ],
    );
  }
}

class _PointerPainter extends CustomPainter {
  const _PointerPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_PointerPainter oldDelegate) => oldDelegate.color != color;
}

// ── Filter Pill ───────────────────────────────────────────────────────────────
class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
    this.activeColor,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? activeColor;

  @override
  Widget build(BuildContext context) {
    final col = activeColor ?? AppColors.primary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? col : Colors.white.withAlpha(235),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? col : AppColors.border,
            width: 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: col.withAlpha(80),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : AppTokens.shadow,
        ),
        child: Text(
          label,
          style: AppTypography.extraTiny.copyWith(
            color: selected ? Colors.white : AppColors.textPrimary,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            fontSize: 10.5,
          ),
        ),
      ),
    );
  }
}

// ── Selected Customer Bottom Card ─────────────────────────────────────────────
class _SelectedCustomerCard extends ConsumerWidget {
  const _SelectedCustomerCard({
    required this.pin,
    required this.distance,
    required this.distanceStr,
    required this.travelTimeStr,
    required this.fmt,
    required this.t,
    required this.onDirections,
    required this.onCall,
    required this.onCollect,
    required this.onClose,
  });

  final CustomerMapPin pin;
  final double? distance;
  final String distanceStr;
  final String travelTimeStr;
  final NumberFormat fmt;
  final T t;
  final VoidCallback onDirections;
  final VoidCallback onCall;
  final VoidCallback onCollect;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasPhoto =
        pin.customerPhoto != null && pin.customerPhoto!.trim().isNotEmpty;
    final statusColor = pin.statusColor;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppTokens.shadowLg,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Avatar, Name, Code, Close button
          Row(
            children: [
              // Avatar
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.background,
                  border: Border.all(color: statusColor, width: 2.5),
                ),
                child: ClipOval(
                  child: hasPhoto
                      ? Image(
                          image: authedImage(ref, pin.customerPhoto!),
                          fit: BoxFit.cover,
                        )
                      : Container(
                          color: statusColor.withAlpha(30),
                          alignment: Alignment.center,
                          child: Text(
                            pin.customerName.isNotEmpty
                                ? pin.customerName[0].toUpperCase()
                                : '?',
                            style: TextStyle(
                              color: statusColor,
                              fontWeight: FontWeight.w800,
                              fontSize: 20,
                            ),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 12),

              // Customer details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pin.customerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.sectionTitle.copyWith(fontSize: 16),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text(
                          pin.customerCode,
                          style: AppTypography.extraTiny.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (pin.routeName != null &&
                            pin.routeName!.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Container(
                            width: 3,
                            height: 3,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.textLight,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              pin.routeName!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.extraTiny.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Close button
              IconButton(
                icon: const Icon(
                  Icons.close_rounded,
                  size: 20,
                  color: AppColors.textLight,
                ),
                onPressed: onClose,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Distance and status pill row
          Row(
            children: [
              // Status Badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      pin.isPaid
                          ? t.x('map.paid_filter').toUpperCase()
                          : pin.isOverdue
                              ? t.x('map.overdue_filter').toUpperCase()
                              : t.x('map.due_filter').toUpperCase(),
                      style: AppTypography.extraTiny.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w800,
                        fontSize: 9.5,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // Distance & Travel Time Chip
              if (distanceStr.isNotEmpty) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withAlpha(20),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.near_me_rounded,
                        size: 11,
                        color: Color(0xFF2563EB),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '$distanceStr · $travelTimeStr',
                        style: AppTypography.extraTiny.copyWith(
                          color: const Color(0xFF2563EB),
                          fontWeight: FontWeight.w800,
                          fontSize: 9.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),

          const SizedBox(height: 12),

          // Dues & Collection Balance Strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.x('map.due_label').toUpperCase(),
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.textLight,
                          fontWeight: FontWeight.w700,
                          fontSize: 9,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fmt.format(pin.dueAmount),
                        style: AppTypography.bodyLarge.copyWith(
                          fontWeight: FontWeight.w800,
                          color: pin.isPaid
                              ? AppColors.textSecondary
                              : const Color(0xFFEF4444),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(width: 1, height: 28, color: AppColors.border),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.x('map.collected_label').toUpperCase(),
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.textLight,
                          fontWeight: FontWeight.w700,
                          fontSize: 9,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fmt.format(pin.collectedAmount),
                        style: AppTypography.bodyLarge.copyWith(
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF10B981),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Action Buttons: Directions, Call, Collect
          Row(
            children: [
              // Directions button (Google Maps Navigation)
              Expanded(
                flex: 3,
                child: FilledButton.icon(
                  onPressed: onDirections,
                  icon: const Icon(Icons.navigation_rounded, size: 16),
                  label: Text(t.x('map.start_navigation')),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                ),
              ),

              if (pin.phone != null && pin.phone!.isNotEmpty) ...[
                const SizedBox(width: 8),
                IconButton(
                  onPressed: onCall,
                  icon: const Icon(Icons.phone_rounded),
                  color: AppColors.primary,
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.primaryLight,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                    padding: const EdgeInsets.all(11),
                  ),
                ),
              ],

              const SizedBox(width: 8),

              // Collect Now button
              IconButton(
                onPressed: onCollect,
                icon: const Icon(Icons.payments_rounded),
                color: Colors.white,
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.success,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                  padding: const EdgeInsets.all(11),
                ),
                tooltip: 'Collect Payment',
              ),
            ],
          ),
        ],
      ),
    );
  }
}
