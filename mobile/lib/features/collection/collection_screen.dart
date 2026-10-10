import 'package:zolofund/core/currency/currency_controller.dart';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/a11y/voice_assist.dart';
import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/gps/gps_pinger.dart';
import 'package:zolofund/core/gps/gps_service.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/local/collection_queue.dart';
import 'package:zolofund/data/models/collection_entry.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/repositories/dashboard_repository.dart';
import 'package:zolofund/data/services/collection_service.dart';
import 'package:zolofund/data/services/customer_service.dart';
import 'package:zolofund/features/collection/quick_collect_sheet.dart';
import 'package:zolofund/features/collection/widgets/customer_map_pin.dart';
import 'package:zolofund/features/collection/offline_banner.dart';
import 'package:zolofund/features/collection/gps_enforcement_dialog.dart';
import 'package:zolofund/shared/widgets/module_app_bar_title.dart';
import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:zolofund/features/onboarding/location_permission_overlay.dart';
import 'package:zolofund/shared/widgets/help_sheet.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';

List<CollectionRow>? _cachedCollectionToday;
String? _cachedCollectionScopeKey;
CollectionDashboard? _cachedCollectionDashboard;
const String _kCollectionCacheBox = 'collection_cache';

List<CollectionRow>? cachedCollectionTodayFor(String? scopeKey) {
  if (scopeKey == null) return null;
  if (_cachedCollectionScopeKey == scopeKey && _cachedCollectionToday != null) {
    return _cachedCollectionToday;
  }
  // Instant disk read from Hive
  if (Hive.isBoxOpen(_kCollectionCacheBox)) {
    try {
      final box = Hive.box<dynamic>(_kCollectionCacheBox);
      final rawStr = box.get('dash_$scopeKey') as String?;
      if (rawStr != null && rawStr.isNotEmpty) {
        final decoded = jsonDecode(rawStr) as Map<String, dynamic>;
        final dash = CollectionDashboard.fromJson(decoded);
        _cachedCollectionScopeKey = scopeKey;
        _cachedCollectionDashboard = dash;
        _cachedCollectionToday = dash.rows;
        return _cachedCollectionToday;
      }
    } catch (e) {
      debugPrint('[Collection] Error reading cached rows from disk: $e');
    }
  }
  return null;
}

List<CollectionRow>? get cachedCollectionToday => null;

void clearCollectionTodayCache() {
  _cachedCollectionDashboard = null;
  _cachedCollectionToday = null;
  _cachedCollectionScopeKey = null;
  if (Hive.isBoxOpen(_kCollectionCacheBox)) {
    try {
      Hive.box<dynamic>(_kCollectionCacheBox).clear();
    } catch (_) {}
  }
}

/// GET /collection/dashboard — rows plus the server's worklist totals (COL-01).
/// Invalidate this one to refresh; [collectionTodayProvider] follows it.
final collectionDashboardProvider =
    FutureProvider<CollectionDashboard>((ref) async {
  final user = ref.watch(authControllerProvider).user;
  final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
  void remember(CollectionDashboard dash, [Map<String, dynamic>? raw]) {
    _cachedCollectionDashboard = dash;
    _cachedCollectionToday = dash.rows;
    if (scopeKey != null) {
      _cachedCollectionScopeKey = scopeKey;
      if (raw != null) {
        try {
          if (Hive.isBoxOpen(_kCollectionCacheBox)) {
            Hive.box<dynamic>(_kCollectionCacheBox).put('dash_$scopeKey', jsonEncode(raw));
          }
        } catch (_) {}
      }
    }
  }

  // Preload from disk if memory is empty
  if (scopeKey != null && _cachedCollectionDashboard == null) {
    cachedCollectionTodayFor(scopeKey);
  }

  try {
    final dash = await ref.watch(collectionServiceProvider).dashboard(
      onRawData: (rawMap) => remember(_cachedCollectionDashboard ?? CollectionDashboard.fromJson(rawMap), rawMap),
    );
    remember(dash);
    return dash;
  } catch (e) {
    final cached = _cachedCollectionDashboard;
    if (scopeKey != null &&
        _cachedCollectionScopeKey == scopeKey &&
        cached != null &&
        cached.rows.isNotEmpty) {
      return cached;
    }
    // Retry once after a brief delay if initial fetch fails on startup
    try {
      await Future<void>.delayed(const Duration(milliseconds: 700));
      final dash = await ref.watch(collectionServiceProvider).dashboard(
        onRawData: (rawMap) => remember(_cachedCollectionDashboard ?? CollectionDashboard.fromJson(rawMap), rawMap),
      );
      remember(dash);
      return dash;
    } catch (_) {
      if (cached != null && cached.rows.isNotEmpty) return cached;
      rethrow;
    }
  }
});

final collectionTodayProvider = FutureProvider<List<CollectionRow>>(
  (ref) async => (await ref.watch(collectionDashboardProvider.future)).rows,
);

final _selfPayQueueProvider = FutureProvider<List<SelfPayQueueItem>>((ref) {
  // Refetch on module/branch switch — each emits a new auth state.
  ref.watch(authControllerProvider);
  return ref.watch(collectionServiceProvider).selfPayQueue();
});

/// All geotagged customer locations — used by the collection map to show
/// customers that don't have today's dues (matching the dashboard map).
final _allGeoCustomersProvider =
    FutureProvider.autoDispose<List<({String id, LatLng point})>>((ref) async {
  final customers = await ref.read(customerServiceProvider).list(
        limit: 100,
        hasActiveLoan: true,
      );
  final results = <({String id, LatLng point})>[];
  for (final c in customers) {
    if (!c.hasActiveLoan) continue;
    if (c.lat != null && c.lng != null) {
      results.add((id: c.id, point: LatLng(c.lat!, c.lng!)));
    } else {
      for (final cp in c.collectionPoints) {
        if (cp.latitude != null && cp.longitude != null) {
          results.add((id: c.id, point: LatLng(cp.latitude!, cp.longitude!)));
          break;
        }
      }
    }
  }
  return results;
});

final _filterProvider = StateProvider.autoDispose<String>((_) => 'pending');

void refreshCollectionViews(WidgetRef ref) {
  ref.invalidate(collectionDashboardProvider);
  ref.invalidate(dashboardSummaryProvider);
}

class CollectionScreen extends ConsumerStatefulWidget {
  const CollectionScreen({super.key, this.initialFrequency});

  final String? initialFrequency;

  @override
  ConsumerState<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends ConsumerState<CollectionScreen>
    with WidgetsBindingObserver {
  bool _nearest = false;
  bool _showMap = false;
  String _cadence = 'all';
  double? _agentLat;
  double? _agentLng;
  bool _locating = false;
  bool _gpsDialogShowing = false;
  // Worklist filters (client-side view filters; totals still come from the API).
  String? _routeKey; // routeId (or route name when id missing); null = all
  String _age = 'all'; // overdue age bucket: all | 1_7 | 8_30 | 30p
  String _query = '';
  final _searchCtrl = TextEditingController();

  static String _routeKeyOf(CollectionRow r) => r.routeId ?? r.routeName ?? '';

  List<_RouteOption> _routeOptions(
    List<CollectionRow> rows,
    String unassigned,
  ) {
    final m = <String, _RouteOption>{};
    for (final r in rows) {
      final key = _routeKeyOf(r);
      final cur = m[key];
      m[key] = _RouteOption(
        key,
        r.routeName ?? unassigned,
        (cur?.count ?? 0) + 1,
      );
    }
    final list = m.values.toList()
      ..sort((a, b) => a.label.toLowerCase().compareTo(b.label.toLowerCase()));
    return list;
  }

  List<CollectionRow> _scopeRows(List<CollectionRow> rows, String? routeKey) {
    if (routeKey == null && _query.isEmpty) return rows;
    return rows.where((r) {
      if (routeKey != null && _routeKeyOf(r) != routeKey) return false;
      if (_query.isEmpty) return true;
      return r.customerName.toLowerCase().contains(_query) ||
          r.customerCode.toLowerCase().contains(_query) ||
          r.customerPhone.toLowerCase().contains(_query) ||
          r.loanCode.toLowerCase().contains(_query);
    }).toList();
  }

  List<_CustomerGroup> _applyAgeFilter(
    List<_CustomerGroup> groups,
    String filter,
  ) {
    if (filter != 'overdue' || _age == 'all') return groups;
    return groups.where((g) {
      final d = g.maxDaysOverdue;
      switch (_age) {
        case '1_7':
          return d >= 1 && d <= 7;
        case '8_30':
          return d >= 8 && d <= 30;
        case '30p':
          return d > 30;
        default:
          return true;
      }
    }).toList();
  }

  // GPS-aware sort: km between two coords (haversine), same as web.
  double _distanceKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * 3.141592653589793 / 180;
    final dLon = (lon2 - lon1) * 3.141592653589793 / 180;
    final a = (math.sin(dLat / 2) * math.sin(dLat / 2)) +
        math.cos(lat1 * 3.141592653589793 / 180) *
            math.cos(lat2 * 3.141592653589793 / 180) *
            (math.sin(dLon / 2) * math.sin(dLon / 2));
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  double? _distTo(CollectionRow r) {
    if (_agentLat == null || r.lat == null || r.lng == null) return null;
    return _distanceKm(_agentLat!, _agentLng!, r.lat!, r.lng!);
  }

  String? _distanceLabel(double? km) {
    if (km == null) return null;
    if (km < 1) return '${(km * 1000).round()}m away';
    return '${km.toStringAsFixed(1)}km away';
  }

  Future<void> _toggleNearest() async {
    if (_nearest) {
      setState(() => _nearest = false);
      return;
    }
    setState(() => _locating = true);
    final pos = await ref.read(gpsServiceProvider).currentPosition();
    if (!mounted) return;
    setState(() {
      _locating = false;
      if (pos != null) {
        _agentLat = pos.latitude;
        _agentLng = pos.longitude;
        _nearest = true;
      }
    });
    if (pos == null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(T.of(ref).x('coll.location_off'))),
      );
    }
  }

  void _showSelfPayQueue(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SelfPayQueueSheet(),
    ).then((_) => refreshCollectionViews(ref));
  }

  @override
  void initState() {
    super.initState();
    if (widget.initialFrequency != null &&
        widget.initialFrequency!.isNotEmpty) {
      _cadence = widget.initialFrequency!.toLowerCase();
    }
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkGpsRequirement();
    });
  }

  @override
  void didUpdateWidget(covariant CollectionScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialFrequency != null &&
        widget.initialFrequency != oldWidget.initialFrequency) {
      setState(() => _cadence = widget.initialFrequency!.toLowerCase());
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    WidgetsBinding.instance.removeObserver(this);
    ref.read(gpsPingerProvider).stop();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkGpsRequirement();
    }
  }

  Future<void> _checkGpsRequirement() async {
    if (!mounted || _gpsDialogShowing) return;
    final user = ref.read(authControllerProvider).user;
    if (user?.role != UserRole.agent) return;

    if (user?.gpsTrackingEnabled == true) {
      final status = await ref.read(gpsServiceProvider).checkGpsStatus();
      if (!status.isFullyEnabled && mounted) {
        _gpsDialogShowing = true;
        try {
          await showGpsEnforcementDialog(
            context,
            onGpsEnabled: () {
              ref.read(gpsPingerProvider).start();
            },
          );
        } finally {
          _gpsDialogShowing = false;
        }
      } else if (status.isFullyEnabled) {
        ref.read(gpsPingerProvider).start();
      }
    } else {
      ref.read(gpsPingerProvider).start();
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(collectionDashboardProvider);
    final sync = ref.watch(collectionSyncProvider);
    final filter = ref.watch(_filterProvider);
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final user = ref.watch(authControllerProvider).user;
    final isMicrolending = user?.appType == AppType.microlending;
    final canReviewSelfPay = user?.role == UserRole.admin ||
        user?.role == UserRole.superadmin ||
        user?.role == UserRole.developer;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: ModuleAppBarTitle(
          subtitle: t.x('coll.title'),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
        actions: [
          if (isMicrolending) ...[
            IconButton(
              tooltip: _showMap ? t.x('coll.view_list') : t.x('coll.view_map'),
              onPressed: () => setState(() => _showMap = !_showMap),
              icon: Icon(_showMap ? Icons.list_rounded : Icons.map_outlined),
            ),
            PopupMenuButton<String>(
              tooltip: t.x('coll.more_actions'),
              onSelected: (action) {
                switch (action) {
                  case 'nearest':
                    _toggleNearest();
                    break;
                  case 'run':
                    context.push('/collection/runs');
                    break;
                  case 'verify':
                    _showSelfPayQueue(context);
                    break;
                  case 'help':
                    showHelpSheet(context, HelpTopics.collection);
                    break;
                }
              },
              itemBuilder: (_) => [
                if (!_showMap)
                  PopupMenuItem(
                    value: 'nearest',
                    enabled: !_locating,
                    child: _CollectionMenuItem(
                      icon: _nearest ? Icons.check_rounded : Icons.near_me,
                      label: t.x('coll.sort_nearest'),
                    ),
                  ),
                PopupMenuItem(
                  value: 'run',
                  child: _CollectionMenuItem(
                    icon: Icons.route_rounded,
                    label: t.x('coll.route_run'),
                  ),
                ),
                if (canReviewSelfPay)
                  PopupMenuItem(
                    value: 'verify',
                    child: _CollectionMenuItem(
                      icon: Icons.verified_outlined,
                      label: t.x('coll.verify_self_pay'),
                    ),
                  ),
                PopupMenuItem(
                  value: 'help',
                  child: _CollectionMenuItem(
                    icon: Icons.help_outline,
                    label: t.x('coll.help'),
                  ),
                ),
              ],
            ),
          ] else ...[
            IconButton(
              tooltip: 'Help',
              onPressed: () => showHelpSheet(context, HelpTopics.collection),
              icon: const Icon(Icons.help_outline),
            ),
            IconButton(
              tooltip: 'Route run (batch collect & deposit)',
              onPressed: () => context.push('/collection/runs'),
              icon: const Icon(Icons.route_rounded),
            ),
            if (canReviewSelfPay)
              IconButton(
                tooltip: 'Self-pay verification',
                onPressed: () => _showSelfPayQueue(context),
                icon: const Icon(Icons.verified_outlined),
              ),
            IconButton(
              tooltip: _showMap ? t.x('coll.view_list') : t.x('coll.view_map'),
              onPressed: () => setState(() => _showMap = !_showMap),
              icon: Icon(
                _showMap ? Icons.list_rounded : Icons.map_outlined,
                color: _showMap ? AppColors.primary : null,
              ),
            ),
            if (!_showMap)
              IconButton(
                tooltip: t.x('coll.sort_nearest'),
                onPressed: _locating ? null : _toggleNearest,
                icon: _locating
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        Icons.near_me,
                        color: _nearest ? AppColors.primary : null,
                      ),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: sync.online ? AppColors.success : AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    sync.pending > 0
                        ? '${sync.pending} ${t.x('sync.queued_suffix')}'
                        : (sync.online
                            ? t.x('sync.synced')
                            : t.x('sync.offline')),
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          if (isMicrolending)
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: sync.online
                              ? AppColors.success
                              : AppColors.danger,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        sync.pending > 0
                            ? '${sync.pending} ${t.x('sync.queued_suffix')}'
                            : (sync.online
                                ? t.x('sync.synced')
                                : t.x('sync.offline')),
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (ref.watch(authControllerProvider).user?.role == UserRole.agent)
            const LocationStatusBanner(),
          if (isMicrolending && async.valueOrNull != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: _CadencePills(
                current: _cadence,
                rows: async.valueOrNull!.rows,
                onTap: (value) => setState(() => _cadence = value),
                t: t,
              ),
            ),
          Expanded(
            child: async.when(
              loading: () => ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: 6,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, __) => Skeleton(height: 110, borderRadius: 16),
              ),
              error: (e, _) => EmptyState(
                icon: Icons.cloud_off,
                title: t.x('err.could_not_load'),
                subtitle: e.toString(),
              ),
              data: (dash) {
                final rows = dash.rows;
                if (rows.isEmpty) {
                  return EmptyState(
                    icon: Icons.calendar_today_outlined,
                    title: t.x('dash.no_schedule'),
                  );
                }
                final cadenceRows = isMicrolending && _cadence != 'all'
                    ? rows.where((r) => r.cadence == _cadence).toList()
                    : rows;
                // Route options come from the cadence-scoped rows so every
                // route pill shows how many rows it would list.
                final routeOptions = _routeOptions(
                  cadenceRows,
                  t.x('coll.unassigned'),
                );
                final activeRoute =
                    routeOptions.any((o) => o.key == _routeKey)
                        ? _routeKey
                        : null;
                final scopedRows = _scopeRows(cadenceRows, activeRoute);
                final allGroups =
                    _groupCollectionRows(scopedRows, byLoan: isMicrolending);
                final filteredGroups = _applyAgeFilter(
                  _applyGroupFilter(allGroups, filter),
                  filter,
                );
                // Header = server worklist totals, same as web (COL-01).
                final summary = dash.summary;

                // ── Map view ────────────────────────────────────────────────────────
                if (_showMap) {
                  return _CollectionMap(
                    rows: filteredGroups.expand((g) => g.rows).toList(),
                    agentLat: _agentLat,
                    agentLng: _agentLng,
                    fmt: fmt,
                    t: t,
                    showCadenceDate: isMicrolending,
                    onCollect: (CollectionRow row) =>
                        _openQuickCollect(context, row, rows),
                  );
                }

                // ── List view ───────────────────────────────────────────────────────
                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async {
                    refreshCollectionViews(ref);
                    ref.invalidate(collectionDashboardProvider);
                    await ref.read(collectionTodayProvider.future);
                  },
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    children: [
                      _CollectionSummaryHeader(
                        totalDue: summary.todayExpected,
                        totalCollected: summary.todayCollected,
                        pendingCount: summary.todayPendingCount,
                        overdueOutstanding: summary.overdueOutstanding,
                        overdueCount: summary.overduePendingCount,
                        fmt: fmt,
                        t: t,
                        responsive: isMicrolending,
                      ),
                      if (user?.role == UserRole.agent &&
                          dash.dailyCollected > 0) ...[
                        const SizedBox(height: 10),
                        _DailyHandoverBar(dash: dash, fmt: fmt, t: t),
                      ],
                      const SizedBox(height: 14),
                      _FilterPills(
                        current: filter,
                        rows: scopedRows,
                        onTap: (k) {
                          ref.read(_filterProvider.notifier).state = k;
                          if (k != 'overdue') _age = 'all';
                        },
                        t: t,
                      ),
                      if (filter == 'overdue') ...[
                        const SizedBox(height: 10),
                        _AgePills(
                          current: _age,
                          onTap: (a) => setState(() => _age = a),
                          t: t,
                        ),
                      ],
                      if (routeOptions.length > 1) ...[
                        const SizedBox(height: 10),
                        _RoutePills(
                          options: routeOptions,
                          current: activeRoute,
                          total: cadenceRows.length,
                          onTap: (k) => setState(() => _routeKey = k),
                          t: t,
                        ),
                      ],
                      const SizedBox(height: 10),
                      _SearchField(
                        controller: _searchCtrl,
                        hint: t.x('coll.search_hint'),
                        onChanged: (v) =>
                            setState(() => _query = v.trim().toLowerCase()),
                      ),
                      const SizedBox(height: 12),
                      if (_nearest && _agentLat != null)
                        ..._sortGroupsByDistance(filteredGroups).expand(
                          (g) => [
                            _CollectionCard(
                              group: g,
                              fmt: fmt,
                              filter: filter,
                              distanceLabel: _distanceLabel(_distTo(g.primary)),
                              responsive: isMicrolending,
                            ),
                            const SizedBox(height: 10),
                          ],
                        )
                      else
                        ..._groupGroupsByRoute(
                          filteredGroups,
                          t.x('coll.unassigned'),
                        ).entries.expand(
                              (e) => [
                                _RouteHeader(
                                  routeName: e.key,
                                  count: e.value.length,
                                  summary: dash.summaryByRoute[
                                      e.value.first.primary.routeId ?? ''],
                                  fmt: fmt,
                                ),
                                const SizedBox(height: 8),
                                for (final g in e.value) ...[
                                  _CollectionCard(
                                    group: g,
                                    fmt: fmt,
                                    filter: filter,
                                    responsive: isMicrolending,
                                  ),
                                  const SizedBox(height: 10),
                                ],
                                const SizedBox(height: 6),
                              ],
                            ),
                      if (filteredGroups.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 40),
                          child: Center(
                            child: Text(
                              t.x('coll.nothing_filter'),
                              style: AppTypography.caption,
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/collection'),
    );
  }

  List<_CustomerGroup> _applyGroupFilter(
    List<_CustomerGroup> groups,
    String filter,
  ) {
    switch (filter) {
      case 'pending':
        return groups.where((g) => g.todayDue > 0).toList();
      case 'paid':
        // A group is "paid" only when every collectible row is fully
        // resolved — a customer with one paid row and one still-overdue row
        // is NOT paid (previously matched on ANY paid row, which wrongly
        // included customers who still owe money).
        return groups.where((g) => g.allCollected).toList();
      case 'overdue':
        return groups.where((g) => g.overdueDue > 0).toList();
      case 'all':
      default:
        return groups;
    }
  }

  // Preserve the original customer grouping outside microlending. Its payment
  // sheet scopes one loan, so microlending cards must show one loan's dues.
  List<_CustomerGroup> _groupCollectionRows(
    List<CollectionRow> rows, {
    bool byLoan = false,
  }) {
    final m = <String, List<CollectionRow>>{};
    for (final r in rows) {
      m
          .putIfAbsent(
              byLoan ? r.loanId : r.customerId, () => <CollectionRow>[])
          .add(r);
    }
    return m.values.map((rs) => _CustomerGroup(rs)).toList();
  }

  List<_CustomerGroup> _sortGroupsByDistance(List<_CustomerGroup> groups) {
    final list = [...groups];
    list.sort((a, b) {
      final da = _distTo(a.primary);
      final db = _distTo(b.primary);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da.compareTo(db);
    });
    return list;
  }

  Map<String, List<_CustomerGroup>> _groupGroupsByRoute(
    List<_CustomerGroup> groups,
    String unassigned,
  ) {
    final m = <String, List<_CustomerGroup>>{};
    for (final g in groups) {
      m
          .putIfAbsent(
            g.primary.routeName ?? unassigned,
            () => <_CustomerGroup>[],
          )
          .add(g);
    }
    return m;
  }

  Future<void> _openQuickCollect(
    BuildContext context,
    CollectionRow row,
    List<CollectionRow> all,
  ) async {
    if (row.isResolved) return;
    final user = ref.read(authControllerProvider).user;
    if (user?.role == UserRole.agent && user?.gpsTrackingEnabled == true) {
      final status = await ref.read(gpsServiceProvider).checkGpsStatus();
      if (!status.isFullyEnabled) {
        await _checkGpsRequirement();
        return;
      }
    }
    if (!context.mounted) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(row: row, scopeRows: all),
    ).then((_) => refreshCollectionViews(ref));
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Collection Map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _SelfPayQueueSheet extends ConsumerWidget {
  const _SelfPayQueueSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_selfPayQueueProvider);
    final height = MediaQuery.of(context).size.height * 0.86;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 10),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                    child: Icon(
                      Icons.verified_outlined,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Self-pay verification',
                          style: AppTypography.sectionTitle,
                        ),
                        Text(
                          'Confirm borrower UPI claims after bank receipt.',
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: AppColors.border),
            Expanded(
              child: async.when(
                loading: () => ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: 4,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, __) =>
                      Skeleton(height: 104, borderRadius: 12),
                ),
                error: (e, _) => EmptyState(
                  icon: Icons.cloud_off,
                  title: 'Could not load self-pay queue',
                  subtitle: e.toString(),
                ),
                data: (items) {
                  final claimed =
                      items.where((i) => i.status == 'claimed').toList();
                  final open =
                      items.where((i) => i.status != 'claimed').toList();

                  if (items.isEmpty) {
                    return const EmptyState(
                      icon: Icons.check_circle_outline,
                      title: 'No self-pay items',
                      subtitle: 'There are no borrower UPI links to review.',
                    );
                  }

                  return RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () async =>
                        ref.invalidate(_selfPayQueueProvider),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                      children: [
                        _SelfPaySection(
                          title: 'Reported by borrower (${claimed.length})',
                          items: claimed,
                          highlighted: true,
                        ),
                        const SizedBox(height: 14),
                        _SelfPaySection(
                          title: 'Open links (${open.length})',
                          items: open,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SelfPaySection extends StatelessWidget {
  const _SelfPaySection({
    required this.title,
    required this.items,
    this.highlighted = false,
  });

  final String title;
  final List<SelfPayQueueItem> items;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Text(title, style: AppTypography.label),
          ),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Text('Nothing here.', style: AppTypography.caption),
            )
          else
            ...items.map(
              (item) => _SelfPayCard(
                item: item,
                highlighted: highlighted,
              ),
            ),
        ],
      ),
    );
  }
}

class _SelfPayCard extends ConsumerStatefulWidget {
  const _SelfPayCard({required this.item, required this.highlighted});

  final SelfPayQueueItem item;
  final bool highlighted;

  @override
  ConsumerState<_SelfPayCard> createState() => _SelfPayCardState();
}

class _SelfPayCardState extends ConsumerState<_SelfPayCard> {
  bool _busy = false;

  Future<void> _review(String action) async {
    setState(() => _busy = true);
    try {
      await ref.read(collectionServiceProvider).reviewSelfPay(
            token: widget.item.token,
            action: action,
          );
      ref.invalidate(_selfPayQueueProvider);
      refreshCollectionViews(ref);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            action == 'confirm' ? 'Self-pay confirmed' : 'Self-pay rejected',
          ),
          backgroundColor:
              action == 'confirm' ? AppColors.success : AppColors.danger,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    final item = widget.item;
    final created = DateFormat('dd MMM, h:mm a').format(item.createdAt);
    final expires = DateFormat('dd MMM').format(item.expiresAt);

    return Container(
      margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: widget.highlighted ? AppColors.warningBg : AppColors.background,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(
          color: widget.highlighted ? AppColors.warning : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.customerName,
                      style: AppTypography.bodyLarge,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      '${item.customerCode} - ${item.loanCode}',
                      style: AppTypography.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Text(
                fmt.format(item.amount),
                style: AppTypography.bodyLarge.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _MiniChip(label: item.status.toUpperCase()),
              _MiniChip(label: item.channel.toUpperCase()),
              _MiniChip(label: 'Created $created'),
              _MiniChip(label: 'Expires $expires'),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : () => _review('reject'),
                  icon: const Icon(Icons.close_rounded, size: 16),
                  label: const Text('Reject'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _busy ? null : () => _review('confirm'),
                  icon: _busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.check_rounded, size: 16),
                  label: const Text('Confirm'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniChip extends StatelessWidget {
  const _MiniChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
        border: Border.all(color: AppColors.border),
      ),
      child: Text(label, style: AppTypography.tiny),
    );
  }
}

class _CollectionMap extends ConsumerWidget {
  const _CollectionMap({
    required this.rows,
    required this.fmt,
    required this.t,
    required this.showCadenceDate,
    required this.onCollect,
    this.agentLat,
    this.agentLng,
  });

  final List<CollectionRow> rows;
  final NumberFormat fmt;
  final T t;
  final bool showCadenceDate;
  final ValueChanged<CollectionRow> onCollect;
  final double? agentLat;
  final double? agentLng;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pinned = rows.where((r) => r.lat != null && r.lng != null).toList();

    // Group rows by customer so multiple instalments don't create conflicting pins
    final grouped = <String, List<CollectionRow>>{};
    for (final r in pinned) {
      grouped.putIfAbsent(r.customerId, () => []).add(r);
    }
    final customerPins = grouped.values
        .map((rList) => CustomerMapPinData.fromRows(rList))
        .toList();

    // Augment with remaining geotagged customers (not in today's collection)
    // so the collection map matches the dashboard map.
    final seenIds = customerPins.map((p) => p.customerId).toSet();
    final allGeo = ref.watch(_allGeoCustomersProvider).valueOrNull ?? [];
    final extraPins = allGeo
        .where((g) => !seenIds.contains(g.id))
        .map((g) => g.point)
        .toList();
    final hasAgent = agentLat != null && agentLng != null;

    // Centre on agent or centroid of pins, fallback India.
    LatLng center;
    double zoom;
    if (hasAgent) {
      center = LatLng(agentLat!, agentLng!);
      zoom = 13.0;
    } else if (customerPins.isNotEmpty) {
      final avgLat = customerPins.map((p) => p.lat).reduce((a, b) => a + b) /
          customerPins.length;
      final avgLng = customerPins.map((p) => p.lng).reduce((a, b) => a + b) /
          customerPins.length;
      center = LatLng(avgLat, avgLng);
      zoom = 13.0;
    } else {
      center = const LatLng(20.5937, 78.9629);
      zoom = 4.5;
    }

    return Stack(
      children: [
        FlutterMap(
          options: MapOptions(initialCenter: center, initialZoom: zoom),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.zolofund.app',
              panBuffer: 2,
              keepBuffer: 3,
            ),
            MarkerLayer(
              markers: [
                // Agent's own position
                if (hasAgent)
                  Marker(
                    point: LatLng(agentLat!, agentLng!),
                    width: 40,
                    height: 40,
                    child: const Icon(
                      Icons.my_location_rounded,
                      size: 36,
                      color: AppColors.info,
                    ),
                  ),
                // Customer collection pins (consistent across dashboard and collection screens)
                for (final pin in customerPins)
                  Marker(
                    point: LatLng(pin.lat, pin.lng),
                    width: 58,
                    height: 66,
                    alignment: Alignment.topCenter,
                    child: GestureDetector(
                      onTap: () => showCustomerMapPinSheet(
                        context: context,
                        ref: ref,
                        pin: pin,
                        fmt: fmt,
                        t: t,
                        onCollectDone: () =>
                            ref.invalidate(collectionDashboardProvider),
                      ),
                      child: CustomerPhotoMapPin(pin: pin),
                    ),
                  ),
                // Extra geotagged customers (no dues today) — grey pins
                for (final pt in extraPins)
                  Marker(
                    point: pt,
                    width: 28,
                    height: 28,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.textLight.withAlpha(180),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: const Icon(
                        Icons.person,
                        size: 14,
                        color: Colors.white,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
        // Legend
        Positioned(
          top: 10,
          left: 10,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(230),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _dot(AppColors.success),
                const SizedBox(width: 4),
                const Text('Paid', style: TextStyle(fontSize: 11)),
                const SizedBox(width: 8),
                _dot(AppColors.warning),
                const SizedBox(width: 4),
                const Text('Due', style: TextStyle(fontSize: 11)),
                const SizedBox(width: 8),
                _dot(AppColors.danger),
                const SizedBox(width: 4),
                const Text('Overdue', style: TextStyle(fontSize: 11)),
                const SizedBox(width: 8),
                _dot(AppColors.textLight),
                const SizedBox(width: 4),
                const Text('My customers', style: TextStyle(fontSize: 11)),
              ],
            ),
          ),
        ),
        if (customerPins.isEmpty)
          Positioned.fill(
            child: Container(
              color: Colors.black12,
              alignment: Alignment.center,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.location_off_outlined,
                    size: 40,
                    color: Colors.white70,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    t.x('coll.no_locations'),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    t.x('coll.no_locations_hint'),
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _dot(Color color) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _CollectionMenuItem extends StatelessWidget {
  const _CollectionMenuItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Icon(icon, size: 20, color: AppColors.textSecondary),
          const SizedBox(width: 12),
          Flexible(child: Text(label)),
        ],
      );
}

/// Agent's end-of-day handover, same states and action as web Collection
/// Entry: open → Submit handover; pending_handover / settled → badge (COL-03).
class _DailyHandoverBar extends ConsumerStatefulWidget {
  const _DailyHandoverBar({required this.dash, required this.fmt, required this.t});
  final CollectionDashboard dash;
  final NumberFormat fmt;
  final T t;

  @override
  ConsumerState<_DailyHandoverBar> createState() => _DailyHandoverBarState();
}

class _DailyHandoverBarState extends ConsumerState<_DailyHandoverBar> {
  bool _busy = false;

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await ref.read(collectionServiceProvider).requestDailyHandover();
      ref.invalidate(collectionDashboardProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(widget.t.x('coll.handover_pending'))),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final status = widget.dash.dailyStatus;
    return Row(
      children: [
        Expanded(
          child: Text(
            '${t.x('dash.collected_today')}: ${widget.fmt.format(widget.dash.dailyCollected)}',
            style: AppTypography.label,
          ),
        ),
        if (status == 'open')
          FilledButton.icon(
            onPressed: _busy ? null : _submit,
            icon: const Icon(Icons.payments_outlined, size: 18),
            label: Text(t.x('coll.submit_handover')),
          )
        else if (status == 'pending_handover')
          Chip(
            label: Text(t.x('coll.handover_pending')),
            backgroundColor: AppColors.warningBg,
          )
        else if (status == 'settled')
          Chip(
            label: Text(t.x('coll.handover_settled')),
            backgroundColor: AppColors.successBg,
          ),
      ],
    );
  }
}

class _CollectionSummaryHeader extends StatelessWidget {
  const _CollectionSummaryHeader({
    required this.totalDue,
    required this.totalCollected,
    required this.pendingCount,
    required this.overdueOutstanding,
    required this.overdueCount,
    required this.fmt,
    required this.t,
    this.responsive = false,
  });
  final double totalDue, totalCollected;
  final double overdueOutstanding;
  final int pendingCount;
  final int overdueCount;
  final NumberFormat fmt;
  final T t;
  final bool responsive;

  @override
  Widget build(BuildContext context) {
    final pct =
        totalDue <= 0 ? 0.0 : (totalCollected / totalDue).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.heroDarkFrom, AppColors.heroDarkTo],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (responsive)
            Wrap(
              spacing: 12,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.savings_outlined,
                      color: AppColors.primary,
                      size: 18,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      t.x('coll.today_scheduled'),
                      style:
                          AppTypography.heroLabel.copyWith(color: Colors.white),
                    ),
                  ],
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(48),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$pendingCount ${t.x('coll.pending_suffix')}',
                    style: AppTypography.tiny.copyWith(color: Colors.white),
                  ),
                ),
              ],
            )
          else
            Row(
              children: [
                Icon(
                  Icons.savings_outlined,
                  color: AppColors.primary,
                  size: 18,
                ),
                const SizedBox(width: 6),
                Text(
                  'Today scheduled',
                  style: AppTypography.heroLabel.copyWith(color: Colors.white),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(48),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$pendingCount ${t.x('coll.pending_suffix')}',
                    style: AppTypography.tiny.copyWith(color: Colors.white),
                  ),
                ),
              ],
            ),
          const SizedBox(height: 10),
          if (responsive)
            SizedBox(
              width: double.infinity,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  fmt.format(totalDue),
                  style: AppTypography.heroNumber.copyWith(color: Colors.white),
                ),
              ),
            )
          else
            Text(
              fmt.format(totalDue),
              style: AppTypography.heroNumber.copyWith(color: Colors.white),
            ),
          Text(
            '${fmt.format(totalCollected)} ${t.x('coll.collected_label')}',
            style: AppTypography.heroMeta.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 14),
          Stack(
            children: [
              Container(
                height: 8,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              FractionallySizedBox(
                widthFactor: pct,
                child: Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${(pct * 100).round()}% ${t.x('coll.collected_pct')}',
            style: AppTypography.caption.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(18),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white24),
            ),
            child: responsive
                ? Wrap(
                    spacing: 10,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      const Icon(
                        Icons.history_rounded,
                        color: AppColors.danger,
                        size: 18,
                      ),
                      Text(
                        t.x('coll.still_overdue'),
                        style: AppTypography.body.copyWith(color: Colors.white),
                      ),
                      Text(
                        fmt.format(overdueOutstanding),
                        style: AppTypography.bodyLarge.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '$overdueCount ${t.x('coll.pending_suffix')}',
                        style:
                            AppTypography.tiny.copyWith(color: Colors.white70),
                      ),
                    ],
                  )
                : Row(
                    children: [
                      const Icon(
                        Icons.history_rounded,
                        color: AppColors.danger,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Still overdue',
                          style:
                              AppTypography.body.copyWith(color: Colors.white),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            fmt.format(overdueOutstanding),
                            style: AppTypography.bodyLarge.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            '$overdueCount ${t.x('coll.pending_suffix')}',
                            style: AppTypography.tiny
                                .copyWith(color: Colors.white70),
                          ),
                        ],
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Filter pills â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _CadencePills extends StatelessWidget {
  const _CadencePills({
    required this.current,
    required this.rows,
    required this.onTap,
    required this.t,
  });

  final String current;
  final List<CollectionRow> rows;
  final ValueChanged<String> onTap;
  final T t;

  @override
  Widget build(BuildContext context) {
    const cadences = [
      'daily',
      'weekly',
      'biweekly',
      'monthly',
      'single_payment',
      'custom_duration',
      'custom',
    ];
    const labels = {
      'daily': 'plan.daily',
      'weekly': 'plan.weekly',
      'biweekly': 'plan.biweekly',
      'monthly': 'plan.monthly',
      'single_payment': 'plan.single_payment',
      'custom_duration': 'plan.custom_duration',
      'custom': 'plan.custom',
    };
    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _Pill(
            label: t.x('coll.filter_all'),
            count: rows.length,
            active: current == 'all',
            onTap: () => onTap('all'),
          ),
          for (final cadence in cadences)
            _Pill(
              label: t.x(labels[cadence]!),
              count: rows.where((r) => r.cadence == cadence).length,
              active: current == cadence,
              onTap: () => onTap(cadence),
            ),
        ],
      ),
    );
  }
}

class _FilterPills extends StatelessWidget {
  const _FilterPills({
    required this.current,
    required this.rows,
    required this.onTap,
    required this.t,
  });
  final String current;
  final List<CollectionRow> rows;
  final ValueChanged<String> onTap;
  final T t;

  @override
  Widget build(BuildContext context) {
    final pendingC = rows.where((r) => r.isTodayBucket && !r.isResolved).length;
    final overdueC =
        rows.where((r) => r.isOverdueBucket && !r.isResolved).length;
    final paidC = rows.where((r) => r.isResolved).length;

    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _Pill(
            label: t.x('coll.btn_today'),
            count: pendingC,
            active: current == 'pending',
            onTap: () => onTap('pending'),
          ),
          _Pill(
            label: t.x('coll.filter_overdue'),
            count: overdueC,
            active: current == 'overdue',
            color: AppColors.danger,
            onTap: () => onTap('overdue'),
          ),
          _Pill(
            label: t.x('coll.filter_paid'),
            count: paidC,
            active: current == 'paid',
            color: AppColors.success,
            onTap: () => onTap('paid'),
          ),
          _Pill(
            label: t.x('coll.filter_all'),
            count: rows.length,
            active: current == 'all',
            onTap: () => onTap('all'),
          ),
        ],
      ),
    );
  }
}

class _RouteOption {
  const _RouteOption(this.key, this.label, this.count);
  final String key;
  final String label;
  final int count;
}

/// Route switcher: one pill per route in today's worklist plus "All routes".
class _RoutePills extends StatelessWidget {
  const _RoutePills({
    required this.options,
    required this.current,
    required this.total,
    required this.onTap,
    required this.t,
  });
  final List<_RouteOption> options;
  final String? current;
  final int total;
  final ValueChanged<String?> onTap;
  final T t;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _Pill(
            label: t.x('coll.all_routes'),
            count: total,
            active: current == null,
            onTap: () => onTap(null),
          ),
          for (final o in options)
            _Pill(
              label: o.label,
              count: o.count,
              active: current == o.key,
              onTap: () => onTap(o.key),
            ),
        ],
      ),
    );
  }
}

/// Overdue age buckets, shown only while the Overdue filter is active.
class _AgePills extends StatelessWidget {
  const _AgePills({
    required this.current,
    required this.onTap,
    required this.t,
  });
  final String current;
  final ValueChanged<String> onTap;
  final T t;

  @override
  Widget build(BuildContext context) {
    final items = <(String, String)>[
      ('all', t.x('coll.filter_all')),
      ('1_7', t.x('coll.age_1_7')),
      ('8_30', t.x('coll.age_8_30')),
      ('30p', t.x('coll.age_30p')),
    ];
    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final (value, label) in items)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(label),
                selected: current == value,
                showCheckmark: false,
                selectedColor: AppColors.danger,
                labelStyle: TextStyle(
                  color: current == value
                      ? Colors.white
                      : AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
                onSelected: (_) => onTap(value),
              ),
            ),
        ],
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.hint,
    required this.onChanged,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      style: TextStyle(color: AppColors.textPrimary, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: AppColors.textLight, fontSize: 14),
        isDense: true,
        prefixIcon: Icon(Icons.search, color: AppColors.textSecondary),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.close, size: 18),
                onPressed: () {
                  controller.clear();
                  onChanged('');
                },
              ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.border),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.count,
    required this.active,
    required this.onTap,
    this.color,
  });
  final String label;
  final int count;
  final bool active;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.primary;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: active ? c : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: active ? c : AppColors.border,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: AppTypography.bodyLarge.copyWith(
                    color: active ? Colors.white : AppColors.textPrimary,
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: active ? Colors.white24 : AppColors.background,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$count',
                    style: AppTypography.tiny.copyWith(
                      color: active ? Colors.white : AppColors.textSecondary,
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Route header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _RouteHeader extends StatelessWidget {
  const _RouteHeader({
    required this.routeName,
    required this.count,
    this.summary,
    this.fmt,
  });
  final String routeName;
  final int count;
  /// Server per-route totals (collectionSummaryByRoute).
  final CollectionSummary? summary;
  final NumberFormat? fmt;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            Icons.route_outlined,
            color: AppColors.textSecondary,
            size: 18,
          ),
          const SizedBox(width: 8),
          Text(routeName, style: AppTypography.label),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: AppTypography.tiny.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          if (summary != null && fmt != null) ...[
            const Spacer(),
            Text(
              '${fmt!.format(summary!.todayCollected)} / ${fmt!.format(summary!.todayExpected)}',
              style: AppTypography.tiny.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Customer collection group â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// One customer's instalments collapsed into a single card. Splits them into
// two buckets so the field agent has one clear card per customer with two
// explicit actions: collect today's due, or settle overdue.
class _CustomerGroup {
  _CustomerGroup(this.rows);
  final List<CollectionRow> rows;

  CollectionRow get primary => rows.first;

  List<CollectionRow> get _collectible =>
      rows.where((r) => !r.isResolved && r.outstanding > 0).toList();

  List<CollectionRow> get _todayCollectible =>
      _collectible.where((r) => r.isTodayBucket).toList();

  List<CollectionRow> get _overdueCollectible =>
      _collectible.where((r) => r.isOverdueBucket).toList();

  // COL-02: only real rows due today — no invented 'due today' for extended loans.
  double get todayDue =>
      _todayCollectible.fold(0.0, (s, r) => s + r.outstanding);

  double get overdueDue =>
      _overdueCollectible.fold(0.0, (s, r) => s + r.outstanding);
  double get totalDue => todayDue + overdueDue;
  double get collectedTotal => rows.fold(0.0, (s, r) => s + r.receivedAmount);

  int get maxDaysOverdue => _overdueCollectible.fold(
        0,
        (m, r) => r.daysOverdue > m ? r.daysOverdue : m,
      );

  /// Oldest unpaid instalment in each bucket (rows are already dueDate-asc),
  /// so collecting always settles the oldest dues first.
  CollectionRow? get nextToday => _todayCollectible.isNotEmpty
      ? _todayCollectible.first
      : (_overdueCollectible.isNotEmpty ? _overdueCollectible.first : null);
  CollectionRow? get nextOverdue =>
      _overdueCollectible.isEmpty ? null : _overdueCollectible.first;

  bool get allCollected => _collectible.isEmpty;

  /// Most recently collected instalment that has a receipt (for receipt/share).
  CollectionRow? get receiptRow {
    CollectionRow? found;
    for (final r in rows) {
      if (r.collectionEntryId != null) found = r;
    }
    return found;
  }
}

// ───────────────────────────── Collection card ────────────────────────────

class _CollectionCard extends ConsumerWidget {
  const _CollectionCard({
    required this.group,
    required this.fmt,
    required this.filter,
    this.distanceLabel,
    this.responsive = false,
  });
  final _CustomerGroup group;
  final NumberFormat fmt;
  final String filter;
  final String? distanceLabel;
  final bool responsive;

  Future<void> _collect(
    BuildContext context,
    WidgetRef ref,
    CollectionRow row,
  ) async {
    final user = ref.read(authControllerProvider).user;
    if (user?.role == UserRole.agent && user?.gpsTrackingEnabled == true) {
      final status = await ref.read(gpsServiceProvider).checkGpsStatus();
      if (!status.isFullyEnabled) {
        if (!context.mounted) return;
        await showGpsEnforcementDialog(context);
        return;
      }
    }
    ref.speak('${row.customerName}, ${fmt.format(row.outstanding)}');
    if (!context.mounted) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(row: row, scopeRows: group.rows),
    ).then((_) => refreshCollectionViews(ref));
  }

  void _showOverdueDetails(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final overdueList = group._overdueCollectible;

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
              Text(
                group.primary.customerName,
                style: AppTypography.sectionTitle.copyWith(fontSize: 18),
              ),
              const SizedBox(height: 2),
              Text(
                '${group.primary.loanCode} • ${overdueList.length} ${t.x('coll.filter_overdue').toLowerCase()} dues',
                style: AppTypography.caption,
              ),
              const SizedBox(height: 16),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: overdueList.length,
                  separatorBuilder: (_, __) =>
                      Divider(height: 1, color: AppColors.border),
                  itemBuilder: (context, idx) {
                    final row = overdueList[idx];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${t.x('coll.due_label')} ${DateFormat('dd/MM/yyyy').format(row.dueDate)}',
                                  style: AppTypography.bodyLarge,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${row.daysOverdue} days overdue',
                                  style: AppTypography.caption
                                      .copyWith(color: AppColors.danger),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                fmt.format(row.outstanding),
                                style: AppTypography.bodyLarge
                                    .copyWith(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 4),
                              GestureDetector(
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _collect(context, ref, row);
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    t.x('btn.collect'),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openLocation(BuildContext context, CollectionRow p) async {
    if (p.lat != null && p.lng != null && p.lat != 0 && p.lng != 0) {
      final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving',
      );
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    }
    final query = [
      p.customerName,
      if (p.routeName != null && p.routeName!.isNotEmpty) p.routeName,
    ].where((s) => s != null && s.isNotEmpty).join(', ');
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${Uri.encodeQueryComponent(query)}',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open map navigation')),
      );
    }
  }

  Future<void> _openWhatsApp(BuildContext context, CollectionRow p) async {
    if (p.customerPhone.isEmpty) return;
    final digits = p.customerPhone.replaceAll(RegExp(r'\D'), '');
    final phone = digits.length == 10 ? '91$digits' : digits;
    final text = Uri.encodeComponent(
      'Namaste ${p.customerName}, this is regarding your ZoloFund loan ${p.loanCode}.',
    );
    final uri = Uri.parse('https://wa.me/$phone?text=$text');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open WhatsApp')),
      );
    }
  }

  Future<void> _callCustomer(CollectionRow p) async {
    if (p.customerPhone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: p.customerPhone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final p = group.primary;
    final today = group.nextToday;
    final overdue = group.nextOverdue;
    final allCollected = group.allCollected;
    final rrow = group.receiptRow;
    final showDueDate = responsive && today != null && today.cadence != 'daily';
    final todayActionLabel =
        showDueDate ? t.x('btn.collect') : t.x('coll.btn_today');
    final todayDueDate = showDueDate
        ? '${t.x('coll.due_label')} ${DateFormat('dd/MM/yyyy').format(today.dueDate)}'
        : null;

    final double displayAmount;
    final String displayLabel;
    final Color chipColor;
    final String chipLabel;

    if (filter == 'paid') {
      displayAmount = group.collectedTotal;
      displayLabel = t.x('coll.collected_label');
      chipColor = AppColors.success;
      chipLabel = t.x('coll.collected_label');
    } else if (filter == 'pending') {
      if (today == null) {
        displayAmount = group.collectedTotal;
        displayLabel = t.x('coll.collected_label');
        chipColor = AppColors.success;
        chipLabel = t.x('coll.collected_label');
      } else {
        displayAmount = group.todayDue;
        displayLabel = t.x('coll.amount_due');
        chipColor = AppColors.primary;
        chipLabel = t.x('coll.status_due_today');
      }
    } else if (filter == 'overdue') {
      displayAmount = group.overdueDue;
      displayLabel = t.x('coll.amount_due');
      chipColor = AppColors.danger;
      chipLabel = overdue != null
          ? '${group.maxDaysOverdue}d ${t.x('coll.status_overdue_days')}'
          : t.x('coll.no_overdue');
    } else {
      if (allCollected) {
        displayAmount = group.collectedTotal;
        displayLabel = t.x('coll.collected_label');
        chipColor = AppColors.success;
        chipLabel = t.x('coll.collected_label');
      } else if (overdue != null) {
        displayAmount = group.totalDue;
        displayLabel = t.x('coll.amount_due');
        chipColor = AppColors.danger;
        chipLabel =
            '${group.maxDaysOverdue}d ${t.x('coll.status_overdue_days')}';
      } else {
        displayAmount = group.todayDue;
        displayLabel = t.x('coll.amount_due');
        chipColor = AppColors.primary;
        chipLabel = t.x('coll.status_due_today');
      }
    }

    final Color cardThemeColor = (filter == 'paid' || allCollected)
        ? AppColors.success
        : AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
          BoxShadow(
            color: cardThemeColor.withAlpha(15),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap:
              overdue != null ? () => _showOverdueDetails(context, ref) : null,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.border,
                width: 1.0,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      _Avatar(
                        name: p.customerName,
                        size: 44,
                        image: (p.customerPhoto != null &&
                                p.customerPhoto!.isNotEmpty)
                            ? authedImage(ref, p.customerPhoto!)
                            : null,
                        statusColor: chipColor,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              p.customerName,
                              style: AppTypography.nameLg.copyWith(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Text(
                                  p.loanCode,
                                  style: AppTypography.caption.copyWith(
                                    fontFamily: 'monospace',
                                    fontWeight: FontWeight.w600,
                                    fontSize: 11,
                                  ),
                                ),
                                if (distanceLabel != null) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 5,
                                      vertical: 1.5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withAlpha(20),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.near_me,
                                          size: 10,
                                          color: AppColors.primary,
                                        ),
                                        const SizedBox(width: 2),
                                        Text(
                                          distanceLabel!,
                                          style: AppTypography.tiny.copyWith(
                                            color: AppColors.primaryDark,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 10,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                      _CardActionIcon(
                        tooltip: 'Location / Navigation',
                        icon: Icons.near_me_rounded,
                        iconColor: const Color(0xFF2563EB),
                        bgColor: const Color(0xFFEFF6FF),
                        hasCoords: p.lat != null && p.lng != null,
                        onTap: () => _openLocation(context, p),
                      ),
                      if (p.customerPhone.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        _CardActionIcon(
                          tooltip: 'WhatsApp',
                          icon: Icons.chat_bubble_outline_rounded,
                          iconColor: const Color(0xFF16A34A),
                          bgColor: const Color(0xFFF0FDF4),
                          onTap: () => _openWhatsApp(context, p),
                        ),
                        const SizedBox(width: 6),
                        _CardActionIcon(
                          tooltip: 'Call customer',
                          icon: Icons.call_rounded,
                          iconColor: AppColors.success,
                          bgColor: const Color(0xFFECFDF5),
                          onTap: () => _callCustomer(p),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            fmt.format(displayAmount),
                            style: AppTypography.moneyLg.copyWith(
                              color: AppColors.textPrimary,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            displayLabel,
                            style: AppTypography.caption.copyWith(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      _StatusChip(color: chipColor, label: chipLabel),
                    ],
                  ),
                  const SizedBox(height: 10),
                  LayoutBuilder(
                    builder: (context, constraints) => responsive &&
                            constraints.maxWidth < 320
                        ? Column(
                            children: [
                              SizedBox(
                                width: double.infinity,
                                child: _ActionButton(
                                  primary: true,
                                  enabled: today != null,
                                  icon: Icons.today_rounded,
                                  label: todayActionLabel,
                                  dueDate: todayDueDate,
                                  amount: today != null
                                      ? fmt.format(group.todayDue)
                                      : null,
                                  onTap: today != null
                                      ? () => _collect(context, ref, today)
                                      : null,
                                ),
                              ),
                              const SizedBox(height: 6),
                              SizedBox(
                                width: double.infinity,
                                child: _ActionButton(
                                  primary: false,
                                  enabled: overdue != null,
                                  icon: Icons.history_rounded,
                                  label: overdue != null
                                      ? t.x('coll.btn_overdue')
                                      : t.x('coll.no_overdue'),
                                  amount: overdue != null
                                      ? fmt.format(group.overdueDue)
                                      : null,
                                  onTap: overdue != null
                                      ? () => _showOverdueDetails(context, ref)
                                      : null,
                                ),
                              ),
                            ],
                          )
                        : Row(
                            children: [
                              Expanded(
                                child: _ActionButton(
                                  primary: true,
                                  enabled: today != null,
                                  icon: Icons.today_rounded,
                                  label: todayActionLabel,
                                  dueDate: todayDueDate,
                                  amount: today != null
                                      ? fmt.format(group.todayDue)
                                      : null,
                                  onTap: today != null
                                      ? () => _collect(context, ref, today)
                                      : null,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _ActionButton(
                                  primary: false,
                                  enabled: overdue != null,
                                  icon: Icons.history_rounded,
                                  label: overdue != null
                                      ? t.x('coll.btn_overdue')
                                      : t.x('coll.no_overdue'),
                                  amount: overdue != null
                                      ? fmt.format(group.overdueDue)
                                      : null,
                                  onTap: overdue != null
                                      ? () => _showOverdueDetails(context, ref)
                                      : null,
                                ),
                              ),
                            ],
                          ),
                  ),
                  if (rrow != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.textPrimary,
                              side: BorderSide(color: AppColors.border),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              visualDensity: VisualDensity.compact,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            onPressed: () =>
                                _downloadReceipt(context, ref, rrow),
                            icon: const Icon(Icons.receipt_long, size: 16),
                            label: Text(
                              t.x('coll.receipt'),
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.textPrimary,
                              side: BorderSide(color: AppColors.border),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              visualDensity: VisualDensity.compact,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            onPressed: () => _shareReceipt(context, ref, rrow),
                            icon: const Icon(Icons.share, size: 16),
                            label: Text(
                              t.x('coll.receipt_share'),
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<Uint8List?> _fetchReceiptBytes(
    ScaffoldMessengerState messenger,
    T t,
    WidgetRef ref,
    CollectionRow row,
  ) async {
    messenger.showSnackBar(
      SnackBar(content: Text(t.x('coll.receipt_loading'))),
    );
    try {
      final bytes = await ref
          .read(collectionServiceProvider)
          .receiptPdf(row.collectionEntryId!);
      if (bytes.isEmpty) throw Exception('empty');
      return Uint8List.fromList(bytes);
    } catch (_) {
      messenger.showSnackBar(
        SnackBar(content: Text(t.x('coll.receipt_failed'))),
      );
      return null;
    }
  }

  Future<void> _downloadReceipt(
    BuildContext context,
    WidgetRef ref,
    CollectionRow row,
  ) async {
    final t = T.of(ref);
    final messenger = ScaffoldMessenger.of(context);
    final bytes = await _fetchReceiptBytes(messenger, t, ref, row);
    if (bytes == null) return;
    await Printing.layoutPdf(
      onLayout: (_) async => bytes,
      name: 'receipt-${row.loanCode}.pdf',
    );
  }

  Future<void> _shareReceipt(
    BuildContext context,
    WidgetRef ref,
    CollectionRow row,
  ) async {
    final t = T.of(ref);
    final messenger = ScaffoldMessenger.of(context);
    final bytes = await _fetchReceiptBytes(messenger, t, ref, row);
    if (bytes == null) return;
    await Printing.sharePdf(
      bytes: bytes,
      filename: 'receipt-${row.loanCode}.pdf',
    );
  }
}

// ───────────────────────────── Collection card sub-widgets ────────────────

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: color.withAlpha(28),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(60), width: 0.8),
      ),
      child: Text(
        label,
        style: AppTypography.tiny.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 10.5,
        ),
      ),
    );
  }
}

class _CardActionIcon extends StatelessWidget {
  const _CardActionIcon({
    required this.tooltip,
    required this.icon,
    required this.iconColor,
    required this.bgColor,
    required this.onTap,
    this.hasCoords = false,
  });

  final String tooltip;
  final IconData icon;
  final Color iconColor;
  final Color bgColor;
  final VoidCallback onTap;
  final bool hasCoords;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: iconColor.withAlpha(45),
                width: 1,
              ),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Icon(icon, size: 17, color: iconColor),
                if (hasCoords)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF2563EB),
                        shape: BoxShape.circle,
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

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.primary,
    required this.enabled,
    required this.icon,
    required this.label,
    required this.onTap,
    this.amount,
    this.dueDate,
  });

  final bool primary;
  final bool enabled;
  final IconData icon;
  final String label;
  final String? amount;
  final String? dueDate;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color fg;
    Border? border;
    List<BoxShadow>? shadows;

    if (!enabled) {
      bg = AppColors.background;
      fg = AppColors.textLight;
      border = Border.all(color: AppColors.border);
    } else if (primary) {
      bg = AppColors.primary;
      fg = AppColors.onPrimary;
      shadows = [
        BoxShadow(
          color: AppColors.primary.withAlpha(60),
          blurRadius: 6,
          offset: const Offset(0, 2),
        ),
      ];
    } else {
      bg = AppColors.ink;
      fg = AppColors.onInk;
      border = Border.all(color: AppColors.inkBorder);
    }

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        boxShadow: shadows,
      ),
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: border,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 15, color: fg),
                const SizedBox(width: 5),
                Flexible(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Flexible(
                            child: Text(
                              label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.label.copyWith(
                                color: fg,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (amount != null) ...[
                            const SizedBox(width: 4),
                            Text(
                              amount!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.label.copyWith(
                                color: fg,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (dueDate != null)
                        Text(
                          dueDate!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.extraTiny.copyWith(
                            color: fg.withAlpha(200),
                            fontSize: 9,
                          ),
                        ),
                    ],
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

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.name,
    this.size = 44,
    this.image,
    this.statusColor,
  });

  final String name;
  final double size;
  final ImageProvider? image;
  final Color? statusColor;

  Color _color() {
    final palette = [
      AppColors.primary,
      AppColors.info,
      AppColors.purple,
      AppColors.success,
      AppColors.warning,
    ];
    if (name.isEmpty) return AppColors.textLight;
    final h = name.codeUnits.fold<int>(0, (a, b) => (a + b) & 0xFF);
    return palette[h % palette.length];
  }

  String _initials() {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '—';
    return parts.take(2).map((p) => p.isEmpty ? '' : p[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final c = _color();
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: c.withAlpha(25),
            border: Border.all(
              color: statusColor != null
                  ? statusColor!.withAlpha(120)
                  : c.withAlpha(70),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(12),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
            image: image != null
                ? DecorationImage(
                    image: image!,
                    fit: BoxFit.cover,
                  )
                : null,
          ),
          alignment: Alignment.center,
          child: image != null
              ? null
              : Text(
                  _initials(),
                  style: AppTypography.bodyLarge.copyWith(
                    color: c,
                    fontSize: size * 0.36,
                    fontWeight: FontWeight.w800,
                  ),
                ),
        ),
        if (statusColor != null)
          Positioned(
            right: -1,
            bottom: -1,
            child: Container(
              width: 11,
              height: 11,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
      ],
    );
  }
}
