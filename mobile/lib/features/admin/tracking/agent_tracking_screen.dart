import 'package:loantrack/core/currency/currency_controller.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/agent_location.dart';
import 'package:loantrack/features/admin/tracking/tracking_provider.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

class AgentTrackingScreen extends ConsumerStatefulWidget {
  const AgentTrackingScreen({super.key});

  @override
  ConsumerState<AgentTrackingScreen> createState() => _AgentTrackingScreenState();
}

class _AgentTrackingScreenState extends ConsumerState<AgentTrackingScreen> {
  final _mapController = MapController();
  Timer? _refreshTimer;
  AgentLocation? _selected;
  bool _mapFull = false;

  // Collections table date filter.
  String _collRange = 'today';
  DateTimeRange? _customRange;

  /// Resolves the active filter into a [from, to) day-boundary range.
  /// Boundaries are normalised to midnight so the provider key stays stable
  /// across rebuilds (avoids refetch loops).
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

  String _lastSeen(T t, DateTime? at) {
    if (at == null) return t.x('admin.no_location');
    final m = DateTime.now().difference(at).inMinutes;
    if (m < 1) return t.x('admin.just_now');
    if (m < 60) return '$m ${t.x('admin.mins_ago')}';
    final h = (m / 60).floor();
    if (h < 24) return '${h}h ${t.x('admin.ago')}';
    return DateFormat('dd MMM, h:mm a').format(at);
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
            onPressed: () => ref.invalidate(liveAgentLocationsProvider),
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
            // Re-bind to the freshest copy of the selected agent.
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
          return _AgentCard(agent: a, lastSeen: _lastSeen(t, a.capturedAt), fmt: fmt, t: t, onTap: () {
            setState(() {
              _selected = a;
              _mapFull = false;
            });
          },);
        },
      ),
    );
  }

  // ── Detail: half/full map + collection details ──────────────────────────
  Widget _detail(T t, AgentLocation a) {
    final fmt = ref.watch(currencyFmtProvider);
    final h = MediaQuery.of(context).size.height;
    final mapHeight = _mapFull ? h : h * 0.42;

    return Column(
      children: [
        SizedBox(
          height: mapHeight,
          child: Stack(
            children: [
              if (a.hasLocation)
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(initialCenter: LatLng(a.lat!, a.lng!), initialZoom: 15),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.loantrack.app',
                    ),
                    MarkerLayer(markers: [
                      Marker(
                        point: LatLng(a.lat!, a.lng!),
                        width: 44,
                        height: 44,
                        child: Icon(Icons.location_on, size: 44, color: a.online ? AppColors.success : AppColors.danger),
                      ),
                    ],),
                  ],
                )
              else
                Container(
                  color: AppColors.background,
                  alignment: Alignment.center,
                  child: EmptyState(icon: Icons.location_off_outlined, title: t.x('admin.no_location')),
                ),
              // Full-view toggle
              if (a.hasLocation)
                Positioned(
                  right: 12,
                  bottom: 12,
                  child: FloatingActionButton.small(
                    heroTag: 'mapfull',
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primary,
                    onPressed: () => setState(() => _mapFull = !_mapFull),
                    child: Icon(_mapFull ? Icons.fullscreen_exit : Icons.fullscreen),
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
                    Text(a.online ? t.x('admin.online') : t.x('admin.offline'),
                        style: AppTypography.body.copyWith(
                          color: a.online ? AppColors.success : AppColors.textLight,
                          fontWeight: FontWeight.w700,
                        ),),
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
              ],
            ),
          ),
      ],
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
                    Container(
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
                                Text(
                                  r.customerName,
                                  style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (r.customerCode.isNotEmpty)
                                  Text(r.customerCode, style: AppTypography.extraTiny),
                              ],
                            ),
                          ),
                          Expanded(
                            flex: 3,
                            child: Text(fmt.format(r.dueAmount),
                                textAlign: TextAlign.right, style: AppTypography.body,),
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
                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),),
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
