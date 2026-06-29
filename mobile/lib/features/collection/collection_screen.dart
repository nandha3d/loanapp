import 'package:loantrack/core/currency/currency_controller.dart';
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

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/gps/gps_pinger.dart';
import 'package:loantrack/core/gps/gps_service.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/local/collection_queue.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/services/collection_service.dart';
import 'package:loantrack/features/collection/quick_collect_sheet.dart';
import 'package:loantrack/features/collection/offline_banner.dart';
import 'package:loantrack/shared/widgets/help_sheet.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final collectionTodayProvider =
    FutureProvider.autoDispose<List<CollectionRow>>((ref) {
  return ref.watch(collectionServiceProvider).today();
});

final _filterProvider = StateProvider.autoDispose<String>((_) => 'pending');

class CollectionScreen extends ConsumerStatefulWidget {
  const CollectionScreen({super.key});

  @override
  ConsumerState<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends ConsumerState<CollectionScreen> {
  bool _nearest = false;
  bool _showMap = false;
  double? _agentLat;
  double? _agentLng;
  bool _locating = false;

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

  @override
  void initState() {
    super.initState();
    // GPS-05: live-track the agent while the collection screen is open (the
    // stream stops on dispose â€” battery-friendly). These pings feed the admin
    // tracking map (/gps/live). Permission is requested inside the pinger.
    final user = ref.read(authControllerProvider).user;
    if (user?.role == UserRole.agent) {
      ref.read(gpsPingerProvider).start();
    }
  }

  @override
  void dispose() {
    ref.read(gpsPingerProvider).stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(collectionTodayProvider);
    final sync = ref.watch(collectionSyncProvider);
    final filter = ref.watch(_filterProvider);
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('coll.title')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
        actions: [
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
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: async.when(
        loading: () => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: 6,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, __) => const Skeleton(height: 110, borderRadius: 16),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: t.x('err.could_not_load'),
          subtitle: e.toString(),
        ),
        data: (rows) {
          if (rows.isEmpty) {
            return EmptyState(
              icon: Icons.calendar_today_outlined,
              title: t.x('dash.no_schedule'),
            );
          }
          final allGroups = _groupByCustomer(rows);
          final filteredGroups = _applyGroupFilter(allGroups, filter);
          final todaysRows = rows.where((r) => r.daysOverdue <= 0).toList();
          final totalDue = todaysRows.fold<double>(0, (s, r) => s + r.dueAmount);
          final totalCollected =
              todaysRows.fold<double>(0, (s, r) => s + r.receivedAmount);
          final pendingCount = todaysRows.where((r) => r.status != 'paid').length;

          // ── Map view ────────────────────────────────────────────────────────
          if (_showMap) {
            return _CollectionMap(
              rows: filteredGroups.expand((g) => g.rows).toList(),
              agentLat: _agentLat,
              agentLng: _agentLng,
              fmt: fmt,
              t: t,
              onCollect: (CollectionRow row) =>
                  _openQuickCollect(context, row, rows),
            );
          }

          // ── List view ───────────────────────────────────────────────────────
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.refresh(collectionTodayProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                _ProgressHero(
                  totalDue: totalDue,
                  totalCollected: totalCollected,
                  pendingCount: pendingCount,
                  fmt: fmt,
                  t: t,
                ),
                const SizedBox(height: 14),
                _FilterPills(
                  current: filter,
                  rows: rows,
                  onTap: (k) => ref.read(_filterProvider.notifier).state = k,
                  t: t,
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
                          _RouteHeader(routeName: e.key, count: e.value.length),
                          const SizedBox(height: 8),
                          for (final g in e.value) ...[
                            _CollectionCard(group: g, fmt: fmt, filter: filter),
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

  List<_CustomerGroup> _applyGroupFilter(List<_CustomerGroup> groups, String filter) {
    switch (filter) {
      case 'pending':
        return groups.where((g) => g.rows.any((r) => r.daysOverdue <= 0)).toList();
      case 'paid':
        return groups.where((g) => g.rows.any((r) => r.status == 'paid')).toList();
      case 'overdue':
        return groups
            .where((g) => g.rows.any((r) => r.daysOverdue > 0 && r.status != 'paid'))
            .toList();
      default:
        return groups;
    }
  }

  // One card per customer: collapse a customer's instalments (today's due +
  // any overdue) into a single group. Preserves API order (dueDate asc).
  List<_CustomerGroup> _groupByCustomer(List<CollectionRow> rows) {
    final m = <String, List<CollectionRow>>{};
    for (final r in rows) {
      m.putIfAbsent(r.customerId, () => <CollectionRow>[]).add(r);
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
              g.primary.routeName ?? unassigned, () => <_CustomerGroup>[],)
          .add(g);
    }
    return m;
  }

  void _openQuickCollect(
    BuildContext context,
    CollectionRow row,
    List<CollectionRow> all,
  ) {
    if (row.status == 'paid') return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(row: row),
    ).then((_) => ref.invalidate(collectionTodayProvider));
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Collection Map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _CollectionMap extends StatelessWidget {
  const _CollectionMap({
    required this.rows,
    required this.fmt,
    required this.t,
    required this.onCollect,
    this.agentLat,
    this.agentLng,
  });

  final List<CollectionRow> rows;
  final NumberFormat fmt;
  final T t;
  final ValueChanged<CollectionRow> onCollect;
  final double? agentLat;
  final double? agentLng;

  Color _pinColor(CollectionRow r) {
    if (r.status == 'paid') return AppColors.success;
    if (r.daysOverdue > 0) return AppColors.danger;
    return AppColors.warning;
  }

  @override
  Widget build(BuildContext context) {
    final pinned = rows.where((r) => r.lat != null && r.lng != null).toList();
    final hasAgent = agentLat != null && agentLng != null;

    // Centre on agent or centroid of pins, fallback India.
    LatLng center;
    double zoom;
    if (hasAgent) {
      center = LatLng(agentLat!, agentLng!);
      zoom = 13.0;
    } else if (pinned.isNotEmpty) {
      final avgLat =
          pinned.map((r) => r.lat!).reduce((a, b) => a + b) / pinned.length;
      final avgLng =
          pinned.map((r) => r.lng!).reduce((a, b) => a + b) / pinned.length;
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
              userAgentPackageName: 'com.loantrack.app',
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
                // Customer collection pins
                for (final r in pinned)
                  Marker(
                    point: LatLng(r.lat!, r.lng!),
                    width: 44,
                    height: 44,
                    child: GestureDetector(
                      onTap: () => _showPinSheet(context, r),
                      child: Icon(
                        Icons.location_on_rounded,
                        size: 40,
                        color: _pinColor(r),
                        shadows: const [
                          Shadow(
                            color: Colors.black38,
                            blurRadius: 4,
                            offset: Offset(0, 2),
                          ),
                        ],
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
              ],
            ),
          ),
        ),
        if (pinned.isEmpty)
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

  void _showPinSheet(BuildContext context, CollectionRow row) {
    final isPaid = row.status == 'paid';
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
                  Icon(
                    Icons.location_on_rounded,
                    color: _pinColor(row),
                    size: 28,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row.customerName,
                          style: AppTypography.sectionTitle,
                        ),
                        Text(
                          fmt.format(row.outstanding),
                          style: AppTypography.body.copyWith(
                            color:
                                isPaid ? AppColors.success : AppColors.danger,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (!isPaid)
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
                      onCollect(row);
                    },
                    child: const Text(
                      'Collect Payment',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
              if (isPaid)
                Center(
                  child: Text(
                    t.x('coll.status_paid'),
                    style:
                        AppTypography.body.copyWith(color: AppColors.success),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _ProgressHero extends StatelessWidget {
  const _ProgressHero({
    required this.totalDue,
    required this.totalCollected,
    required this.pendingCount,
    required this.fmt,
    required this.t,
  });
  final double totalDue, totalCollected;
  final int pendingCount;
  final NumberFormat fmt;
  final T t;

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
          Row(
            children: [
              Icon(
                Icons.savings_outlined,
                color: AppColors.primary,
                size: 18,
              ),
              const SizedBox(width: 6),
              Text(
                t.x('coll.today'),
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
          Text(
            fmt.format(totalCollected),
            style: AppTypography.heroNumber.copyWith(color: Colors.white),
          ),
          Text(
            '${t.x('coll.of_due')} ${fmt.format(totalDue)} ${t.x('coll.due_suffix')}',
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
        ],
      ),
    );
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Filter pills â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    final pendingC = rows.where((r) => r.daysOverdue <= 0).length;
    final overdueC =
        rows.where((r) => r.daysOverdue > 0 && r.status != 'paid').length;
    final paidC = rows.where((r) => r.status == 'paid').length;

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
  const _RouteHeader({required this.routeName, required this.count});
  final String routeName;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          const Icon(
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
      rows.where((r) => r.status != 'paid' && r.outstanding > 0).toList();

  /// Due today or earlier-but-not-yet-overdue (daysOverdue <= 0).
  List<CollectionRow> get _todayCollectible =>
      _collectible.where((r) => r.daysOverdue <= 0).toList();

  /// Past due and unpaid (daysOverdue > 0).
  List<CollectionRow> get _overdueCollectible =>
      _collectible.where((r) => r.daysOverdue > 0).toList();

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
  CollectionRow? get nextToday =>
      _todayCollectible.isEmpty ? null : _todayCollectible.first;
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
  });
  final _CustomerGroup group;
  final NumberFormat fmt;
  final String filter;
  final String? distanceLabel;

  void _collect(BuildContext context, WidgetRef ref, CollectionRow row) {
    ref.speak('${row.customerName}, ${fmt.format(row.outstanding)}');
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(row: row),
    ).then((_) => ref.invalidate(collectionTodayProvider));
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
                  separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.border),
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
                                  DateFormat('dd MMM yyyy').format(row.dueDate),
                                  style: AppTypography.bodyLarge,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${row.daysOverdue} days overdue',
                                  style: AppTypography.caption.copyWith(color: AppColors.danger),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                fmt.format(row.outstanding),
                                style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 4),
                              GestureDetector(
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _collect(context, ref, row);
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'Collect',
                                    style: TextStyle(
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final p = group.primary;
    final today = group.nextToday;
    final overdue = group.nextOverdue;
    final allCollected = group.allCollected;
    final rrow = group.receiptRow;

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
        chipLabel = '${group.maxDaysOverdue}d ${t.x('coll.status_overdue_days')}';
      } else {
        displayAmount = group.todayDue;
        displayLabel = t.x('coll.amount_due');
        chipColor = AppColors.primary;
        chipLabel = t.x('coll.status_due_today');
      }
    }

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: overdue != null ? () => _showOverdueDetails(context, ref) : null,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: AppTokens.shadow,
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Avatar(name: p.customerName),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.customerName,
                          style: AppTypography.nameLg,
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
                              ),
                            ),
                            if (distanceLabel != null) ...[
                              const SizedBox(width: 8),
                              Icon(
                                Icons.near_me,
                                size: 12,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 2),
                              Text(
                                distanceLabel!,
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.call_rounded,
                      color: AppColors.success,
                    ),
                    onPressed: () async {
                      final uri = Uri(scheme: 'tel', path: p.customerCode);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri);
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fmt.format(displayAmount),
                          style: AppTypography.moneyLg.copyWith(
                            color: AppColors.textPrimary,
                            fontSize: 24,
                          ),
                        ),
                        Text(
                          displayLabel,
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  _StatusChip(color: chipColor, label: chipLabel),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _ActionButton(
                      primary: true,
                      enabled: today != null,
                      icon: Icons.today_rounded,
                      label: t.x('coll.btn_today'),
                      amount: today != null ? fmt.format(group.todayDue) : null,
                      onTap: today != null
                          ? () => _collect(context, ref, today)
                          : null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ActionButton(
                      primary: false,
                      enabled: overdue != null,
                      icon: Icons.history_rounded,
                      label: overdue != null
                          ? t.x('coll.btn_overdue')
                          : t.x('coll.no_overdue'),
                      amount:
                          overdue != null ? fmt.format(group.overdueDue) : null,
                      onTap: overdue != null
                          ? () => _showOverdueDetails(context, ref)
                          : null,
                    ),
                  ),
                ],
              ),
              if (rrow != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textPrimary,
                          side: const BorderSide(color: AppColors.border),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: () => _downloadReceipt(context, ref, rrow),
                        icon: const Icon(Icons.receipt_long, size: 18),
                        label: Text(t.x('coll.receipt')),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textPrimary,
                          side: const BorderSide(color: AppColors.border),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: () => _shareReceipt(context, ref, rrow),
                        icon: const Icon(Icons.share, size: 18),
                        label: Text(t.x('coll.receipt_share')),
                      ),
                    ),
                  ],
                ),
              ],
            ],
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withAlpha(38),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label, style: AppTypography.tiny.copyWith(color: color)),
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
  });
  final bool primary;
  final bool enabled;
  final IconData icon;
  final String label;
  final String? amount;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color fg;
    Border? border;
    if (!enabled) {
      bg = AppColors.background;
      fg = AppColors.textLight;
      border = Border.all(color: AppColors.border);
    } else if (primary) {
      bg = AppColors.primary;
      fg = AppColors.onPrimary;
    } else {
      bg = AppColors.ink;
      fg = AppColors.onInk;
    }

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          height: 60,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: border,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 16, color: fg),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.label.copyWith(color: fg),
                    ),
                  ),
                ],
              ),
              if (amount != null)
                Text(
                  amount!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodyLarge
                      .copyWith(color: fg, fontWeight: FontWeight.w800),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name});
  final String name;

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
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: c.withAlpha(40),
        shape: BoxShape.circle,
        border: Border.all(color: c.withAlpha(80)),
      ),
      alignment: Alignment.center,
      child: Text(
        _initials(),
        style: AppTypography.bodyLarge.copyWith(color: c, fontSize: 16),
      ),
    );
  }
}
