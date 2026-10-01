// ignore_for_file: require_trailing_commas

import 'dart:math' as math;
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/collection_entry.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/repositories/dashboard_repository.dart';
import 'package:zolofund/features/collection/collection_screen.dart'
    show
        collectionTodayProvider,
        refreshCollectionViews,
        cachedCollectionTodayFor;
import 'package:zolofund/features/collection/quick_collect_sheet.dart';
import 'package:zolofund/features/dashboard/widgets/chit_dashboard_body.dart';
import 'package:zolofund/features/dashboard/widgets/collection_trend_card.dart';
import 'package:zolofund/features/dashboard/widgets/daily_collection_heat_map_card.dart';
import 'package:zolofund/features/dashboard/widgets/disbursement_trend_card.dart';
import 'package:zolofund/features/dashboard/widgets/interactive_portfolio_donut_card.dart';
import 'package:zolofund/features/dashboard/widgets/overdue_aging_card.dart';
import 'package:zolofund/features/onboarding/onboarding_overlay.dart';
import 'package:zolofund/features/onboarding/location_permission_overlay.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';
import 'package:zolofund/features/dashboard/widgets/verify_upi_sheet.dart';
import 'package:zolofund/shared/widgets/module_app_bar_title.dart';
import 'package:zolofund/features/dashboard/widgets/dashboard_gps_widget.dart';

// Process-lifetime guard so rebuilds can't queue duplicate onboarding dialogs.
bool _onboardingRequested = false;

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    // Chit tenants get the chit-funds home (groups, auctions, subscriptions)
    // — the lending dashboard talks about loans/routes they don't have. Only
    // one of the two providers is watched, so only one API call fires.
    final isChit = AppType.userIsChit(user);
    final summary = isChit ? null : ref.watch(dashboardSummaryProvider);

    // First-run tour (U1) - no-ops once the seen flag is stored.
    if (!_onboardingRequested && user != null) {
      _onboardingRequested = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        ref.read(authControllerProvider.notifier).refreshProfile();
        if (!context.mounted) return;
        await maybeShowOnboarding(context, role: user.role.name);
        if (!context.mounted) return;
        await maybeRequestCorePermissions(context);
        if (!context.mounted) return;
        await maybeRequestAlwaysLocation(context, ref, role: user.role.name);
      });
    }
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final chitSummary = isChit ? ref.watch(chitDashboardSummaryProvider) : null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: ModuleAppBarTitle(
          title: isChit ? 'Chit Funds' : 'Micro Lending',
          subtitle: t.x('dash.title'),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.menu),
          // One menu, not two: this used to open a separate drawer that
          // duplicated most of what the "More" tab already lists. Point both
          // at the same screen instead of maintaining two overlapping menus.
          onPressed: () => context.push('/more'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          await ref.read(authControllerProvider.notifier).refreshProfile();
          return isChit
              ? ref.refresh(chitDashboardSummaryProvider.future)
              : ref.refresh(dashboardSummaryProvider.future);
        },
        child: isChit
            ? chitSummary!.when(
                loading: () {
                  final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
                  final cached = DashboardRepository.cachedChitSummaryFor(scopeKey);
                  if (cached != null) {
                    return ChitDashboardBody(
                      summary: cached,
                      fmt: fmt,
                      userName: user?.name ?? '',
                      t: t,
                    );
                  }
                  return const _LoadingSkeleton();
                },
                error: (err, _) {
                  final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
                  final cached = DashboardRepository.cachedChitSummaryFor(scopeKey);
                  if (cached != null) {
                    return ChitDashboardBody(
                      summary: cached,
                      fmt: fmt,
                      userName: user?.name ?? '',
                      t: t,
                    );
                  }
                  return _ErrorState(message: err.toString());
                },
                data: (s) => ChitDashboardBody(
                  summary: s,
                  fmt: fmt,
                  userName: user?.name ?? '',
                  t: t,
                ),
              )
            : summary!.when(
                loading: () {
                  final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
                  final cached = DashboardRepository.cachedSummaryFor(scopeKey);
                  if (cached != null) {
                    return _DashboardBody(
                      summary: cached,
                      fmt: fmt,
                      userName: user?.name ?? '',
                      t: t,
                      responsive: user?.appType == AppType.microlending,
                    );
                  }
                  return const _LoadingSkeleton();
                },
                error: (err, _) {
                  final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
                  final cached = DashboardRepository.cachedSummaryFor(scopeKey);
                  if (cached != null) {
                    return _DashboardBody(
                      summary: cached,
                      fmt: fmt,
                      userName: user?.name ?? '',
                      t: t,
                      responsive: user?.appType == AppType.microlending,
                    );
                  }
                  return _ErrorState(message: err.toString());
                },
                data: (s) => _DashboardBody(
                  summary: s,
                  fmt: fmt,
                  userName: user?.name ?? '',
                  t: t,
                  responsive: user?.appType == AppType.microlending,
                ),
              ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/dashboard'),
    );
  }
}

class _DashboardBody extends ConsumerWidget {
  const _DashboardBody({
    required this.summary,
    required this.fmt,
    required this.userName,
    required this.t,
    required this.responsive,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final String userName;
  final T t;
  final bool responsive;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAgent =
        ref.read(authControllerProvider).user?.role == UserRole.agent;

    return ListView(
      cacheExtent: 1500,
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        _GreetingRow(name: userName, t: t),
        const SizedBox(height: 14),
        _CollectionBreakdownSection(
          summary: summary,
          fmt: fmt,
          t: t,
          responsive: responsive,
        ),
        const SizedBox(height: 14),
        if (isAgent)
          _AgentMetricsRow(summary: summary, fmt: fmt, t: t)
        else
          _MoneyFlowRow(
            summary: summary,
            fmt: fmt,
            t: t,
            responsive: responsive,
          ),
        const SizedBox(height: 14),
        _AlertsRow(
          summary: summary,
          t: t,
          isAgent: isAgent,
          fmt: fmt,
        ),
        const SizedBox(height: 18),
        if (!isAgent) ...[
          _SpotlightCards(summary: summary, fmt: fmt),
          const SizedBox(height: 18),
          InteractivePortfolioDonutCard(summary: summary, fmt: fmt),
          const SizedBox(height: 18),
          _ModeSplitCard(summary: summary, fmt: fmt),
          const SizedBox(height: 18),
          if (summary.pendingUpiCollections.isNotEmpty) ...[
            _PendingUpiList(summary: summary, fmt: fmt),
            const SizedBox(height: 18),
          ],
          CollectionTrendCard(responsive: responsive),
          const SizedBox(height: 18),
          if (responsive && MediaQuery.sizeOf(context).width >= 620)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: DisbursementTrendCard(summary: summary)),
                const SizedBox(width: 14),
                Expanded(child: OverdueAgingCard(summary: summary, fmt: fmt)),
              ],
            )
          else ...[
            DisbursementTrendCard(summary: summary),
            const SizedBox(height: 18),
            OverdueAgingCard(summary: summary, fmt: fmt),
          ],
          const SizedBox(height: 18),
          const DailyCollectionHeatMapCard(),
          const SizedBox(height: 18),
        ] else ...[
          CollectionTrendCard(responsive: responsive),
          const SizedBox(height: 18),
          const DailyCollectionHeatMapCard(),
          const SizedBox(height: 18),
        ],
        _QuickActions(t: t, responsive: responsive),
        const SizedBox(height: 18),
        if (!isAgent) ...[
          _DefaulterAlerts(summary: summary, fmt: fmt, t: t),
          const SizedBox(height: 18),
          _RoutePerformanceList(summary: summary, fmt: fmt, t: t),
          const SizedBox(height: 18),
        ],
        _RecentActivitiesSection(summary: summary, fmt: fmt, t: t),
      ],
    );
  }
}

class _GreetingRow extends StatelessWidget {
  const _GreetingRow({required this.name, required this.t});
  final String name;
  final T t;

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final IconData icon;
    if (hour < 12) {
      icon = Icons.wb_sunny_outlined;
    } else if (hour < 17) {
      icon = Icons.wb_cloudy_outlined;
    } else {
      icon = Icons.nightlight_outlined;
    }
    final dateStr = DateFormat('EEE, d MMM').format(DateTime.now());
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Icon(icon, color: AppColors.primaryDark, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${t.x('dash.hello')}, ${name.isEmpty ? '-' : name.split(' ').first}',
                style: AppTypography.nameLg,
              ),
              Text(dateStr, style: AppTypography.caption),
            ],
          ),
        ),
      ],
    );
  }
}

/// Interactive collection breakdown section — replaces the old static
/// `_CollectionPager`. Mirrors the web dashboard `CollectionBreakdownCards.tsx`
/// with tab toggle, loan-status and frequency filters, 3 KPI boxes, progress
/// bar, and a breakdown-by-frequency list.  Fully mobile-friendly: compact
/// touch targets, FittedBox for currency, responsive wrap for small screens.
class _CollectionBreakdownSection extends ConsumerStatefulWidget {
  const _CollectionBreakdownSection({
    required this.summary,
    required this.fmt,
    required this.t,
    required this.responsive,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;
  final bool responsive;

  @override
  ConsumerState<_CollectionBreakdownSection> createState() =>
      _CollectionBreakdownSectionState();
}

class _CollectionBreakdownSectionState
    extends ConsumerState<_CollectionBreakdownSection> {
  // 0 = Today's Collection, 1 = Overdue Collection, 2 = Agent GPS Live
  int _tab = 0;
  // 'all' | 'daily' | 'weekly' | 'monthly' | 'custom'
  String _frequency = 'all';

  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(
      initialPage: _tab,
      viewportFraction: 0.94,
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  // ── Helpers to resolve the correct metrics for the current filters ──────
  StatusSubMetrics _todayMetrics() {
    final td = widget.summary.todayBreakdown;
    final source = _frequency == 'all'
        ? td
        : (td.breakdown[_frequency] ?? const TodayFrequencyMetrics());
    if (source is TodayCollectionBreakdown) {
      return source.total;
    }
    final fm = source as TodayFrequencyMetrics;
    return fm.total;
  }

  OverdueStatusSubMetrics _overdueMetrics() {
    final od = widget.summary.overdueBreakdown;
    final source = _frequency == 'all'
        ? od
        : (od.breakdown[_frequency] ?? const OverdueFrequencyMetrics());
    if (source is OverdueCollectionBreakdown) {
      return source.total;
    }
    final fm = source as OverdueFrequencyMetrics;
    return fm.total;
  }

  double _overdueRecoveryPct() {
    final m = _overdueMetrics();
    return m.totalOverdue <= 0
        ? 0.0
        : (m.collectedToday / m.totalOverdue).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final fmt = widget.fmt;
    final td = widget.summary.todayBreakdown;
    final od = widget.summary.overdueBreakdown;
    return Column(
      children: [
        // ── Tab toggle: Today / Overdue ─────────────────────────────────
        _TabToggle(
          labels: const [
            "Today's Collection",
            'Overdue Collection',
          ],
          icons: const [
            Icons.calendar_today_rounded,
            Icons.warning_amber_rounded,
          ],
          selected: _tab.clamp(0, 1),
          onChanged: (i) {
            setState(() {
              _tab = i;
              _frequency = 'all';
            });
            _pageController.animateToPage(
              i,
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeInOutCubic,
            );
          },
        ),
        const SizedBox(height: 10),

        // ── Swipable Cards Carousel (Compact height starting from frequency pills) ─
        SizedBox(
          height: 205,
          child: PageView(
            controller: _pageController,
            clipBehavior: Clip.none,
            onPageChanged: (i) {
              if (_tab != i) {
                setState(() => _tab = i);
              }
            },
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: _buildTodayCard(fmt, td),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: _buildOverdueCard(fmt, od),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),

        // ── Carousel dot indicator (2 cards) ────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(2, (index) {
            final isSel = _tab == index;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: isSel ? 20 : 6,
              height: 5,
              decoration: BoxDecoration(
                color:
                    isSel ? AppColors.primary : AppColors.border.withAlpha(140),
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
        const SizedBox(height: 14),

        // ── Up Next Section for Collection (Filtered by frequency & tab) ──
        _UpNextPager(
          fmt: fmt,
          t: widget.t,
          frequency: _frequency,
          tab: _tab,
          onResetFrequency: () => setState(() => _frequency = 'all'),
        ),
      ],
    );
  }

  Widget _buildTodayCard(NumberFormat fmt, TodayCollectionBreakdown td) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.heroDarkFrom, AppColors.heroDarkTo],
        ),
        boxShadow: AppTokens.shadowLg,
      ),
      padding: const EdgeInsets.all(13),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _FrequencyPills(
            selected: _frequency,
            onChanged: (v) => setState(() => _frequency = v),
          ),
          const SizedBox(height: 12),
          _buildTodayKPIs(fmt),
          const SizedBox(height: 12),
          _buildProgressBar(0),
        ],
      ),
    );
  }

  Widget _buildOverdueCard(NumberFormat fmt, OverdueCollectionBreakdown od) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.lerp(
              const Color(0xFFB91C1C),
              const Color(0xFF15803D),
              _overdueRecoveryPct(),
            )!,
            Color.lerp(
              const Color(0xFF7F1D1D),
              const Color(0xFF14532D),
              _overdueRecoveryPct(),
            )!,
          ],
        ),
        boxShadow: AppTokens.shadowLg,
      ),
      padding: const EdgeInsets.all(13),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _FrequencyPills(
            selected: _frequency,
            onChanged: (v) => setState(() => _frequency = v),
          ),
          const SizedBox(height: 12),
          _buildOverdueKPIs(fmt),
          const SizedBox(height: 12),
          _buildProgressBar(1),
        ],
      ),
    );
  }

  Widget _buildTodayKPIs(NumberFormat fmt) {
    final m = _todayMetrics();
    return Row(
      children: [
        Expanded(
          child: _KpiBox(
            icon: Icons.event_note_rounded,
            label: 'EXPECTED',
            value: fmt.format(m.expected),
            sub: '${m.loanCount} loans',
            tone: Colors.white,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _KpiBox(
            icon: Icons.check_circle_outline_rounded,
            label: 'COLLECTED',
            value: fmt.format(m.collected),
            sub: '${m.pct.round()}% collected',
            tone: const Color(0xFF34D399),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _KpiBox(
            icon: Icons.hourglass_bottom_rounded,
            label: 'REMAINING',
            value: fmt.format(m.remaining),
            sub: '',
            tone: const Color(0xFFFF8674),
          ),
        ),
      ],
    );
  }

  Widget _buildOverdueKPIs(NumberFormat fmt) {
    final m = _overdueMetrics();
    return Row(
      children: [
        Expanded(
          child: _KpiBox(
            icon: Icons.warning_amber_rounded,
            label: 'TOTAL OVERDUE',
            value: fmt.format(m.totalOverdue),
            sub: '${m.loanCount} loans',
            tone: Colors.white,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _KpiBox(
            icon: Icons.check_circle_outline_rounded,
            label: 'COLLECTED TODAY',
            value: fmt.format(m.collectedToday),
            sub: '${m.pct.round()}% recovered',
            tone: const Color(0xFF34D399),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _KpiBox(
            icon: Icons.hourglass_bottom_rounded,
            label: 'REMAINING',
            value: fmt.format(m.remaining),
            sub: '${m.customerCount} customers',
            tone: const Color(0xFFFF8674),
          ),
        ),
      ],
    );
  }

  Widget _buildProgressBar(int tabIndex) {
    double pct;
    if (tabIndex == 0) {
      final m = _todayMetrics();
      pct = m.expected > 0 ? (m.collected / m.expected).clamp(0.0, 1.0) : 0.0;
    } else {
      final m = _overdueMetrics();
      pct = m.totalOverdue > 0
          ? (m.collectedToday / m.totalOverdue).clamp(0.0, 1.0)
          : 0.0;
    }
    final barColor = _progressColor(pct);
    final pctInt = (pct * 100).round();
    return Column(
      children: [
        _CollectionBar(pct: pct, color: barColor),
        const SizedBox(height: 5),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '₹0',
              style: AppTypography.extraTiny
                  .copyWith(color: Colors.white38, fontSize: 8.5),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1.5),
              decoration: BoxDecoration(
                color: barColor.withAlpha(36),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: barColor.withAlpha(80), width: 1),
              ),
              child: Text(
                '$pctInt% ${tabIndex == 0 ? 'collected' : 'recovered'}',
                style: AppTypography.extraTiny.copyWith(
                  color: barColor,
                  fontWeight: FontWeight.w700,
                  fontSize: 8.5,
                ),
              ),
            ),
            Text(
              tabIndex == 0 ? 'Expected' : 'Total due',
              style: AppTypography.extraTiny
                  .copyWith(color: Colors.white38, fontSize: 8.5),
            ),
          ],
        ),
      ],
    );
  }
}

/// Continuous red → amber → green accent for collection progress.
Color _progressColor(double pct) {
  const red = Color(0xFFFF8674);
  const amber = Color(0xFFFBBF24);
  const green = Color(0xFF34D399);
  final p = pct.clamp(0.0, 1.0);
  return p < 0.5
      ? Color.lerp(red, amber, p * 2)!
      : Color.lerp(amber, green, (p - 0.5) * 2)!;
}

// ── Tab toggle ───────────────────────────────────────────────────────────────
class _TabToggle extends StatelessWidget {
  const _TabToggle({
    required this.labels,
    required this.icons,
    required this.selected,
    required this.onChanged,
  });
  final List<String> labels;
  final List<IconData> icons;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color:
                        selected == i ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        icons[i],
                        size: 14,
                        color: selected == i
                            ? Colors.white
                            : AppColors.textSecondary,
                      ),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          labels[i],
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.tiny.copyWith(
                            color: selected == i
                                ? Colors.white
                                : AppColors.textSecondary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Frequency Filter Pills (Prominent, large touch targets) ───────────────────
class _FrequencyPills extends StatelessWidget {
  const _FrequencyPills({
    required this.selected,
    required this.onChanged,
  });

  final String selected;
  final ValueChanged<String> onChanged;

  static const _options = ['All', 'Daily', 'Weekly', 'Monthly', 'Custom'];
  static const _values = ['all', 'daily', 'weekly', 'monthly', 'custom'];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(14),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withAlpha(20), width: 1),
      ),
      child: Row(
        children: [
          for (var i = 0; i < _options.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(_values[i]),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  decoration: BoxDecoration(
                    color: selected == _values[i]
                        ? AppColors.primary
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                    boxShadow: selected == _values[i]
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withAlpha(140),
                              blurRadius: 6,
                              offset: const Offset(0, 1.5),
                            ),
                          ]
                        : null,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    _options[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: selected == _values[i]
                          ? Colors.white
                          : Colors.white70,
                      fontWeight: selected == _values[i]
                          ? FontWeight.w700
                          : FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── KPI metric box ───────────────────────────────────────────────────────────
class _KpiBox extends StatelessWidget {
  const _KpiBox({
    required this.icon,
    required this.label,
    required this.value,
    required this.sub,
    required this.tone,
  });
  final IconData icon;
  final String label, value, sub;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withAlpha(15), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 10, color: tone.withAlpha(180)),
              const SizedBox(width: 3),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.extraTiny.copyWith(
                    color: Colors.white38,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.3,
                    fontSize: 8,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: AppTypography.bodyLarge.copyWith(
                color: tone,
                fontWeight: FontWeight.w800,
                fontSize: 15,
              ),
            ),
          ),
          if (sub.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              sub,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.extraTiny.copyWith(
                color: Colors.white38,
                fontSize: 9,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Collection progress bar ──────────────────────────────────────────────────
class _CollectionBar extends StatelessWidget {
  const _CollectionBar({required this.pct, required this.color});
  final double pct;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: pct),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (_, value, __) {
        return Stack(
          children: [
            // Track
            Container(
              height: 10,
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(18),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            // Fill
            FractionallySizedBox(
              widthFactor: value.clamp(0.0, 1.0),
              child: Container(
                height: 10,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(99),
                  gradient: LinearGradient(
                    colors: [color.withAlpha(180), color],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: color.withAlpha(100),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
            // Milestone ticks at 25%, 50%, 75%
            for (final tick in [0.25, 0.5, 0.75])
              FractionallySizedBox(
                widthFactor: tick,
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    width: 1.5,
                    height: 10,
                    color: Colors.white.withAlpha(40),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _MoneyFlowRow extends StatelessWidget {
  const _MoneyFlowRow({
    required this.summary,
    required this.fmt,
    required this.t,
    required this.responsive,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;
  final bool responsive;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _StatTile(
                icon: Icons.account_balance_wallet_rounded,
                iconColor: AppColors.success,
                iconBg: AppColors.successBg,
                label: t.x('dash.active_loans'),
                value: '${summary.activeLoans}',
                sub:
                    '${summary.totalCustomers} ${t.x('dash.customers_suffix')}',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatTile(
                icon: Icons.groups_2_outlined,
                iconColor: AppColors.info,
                iconBg: AppColors.infoBg,
                label: t.x('dash.agents'),
                value: '${summary.activeAgents}',
                sub: t.x('dash.on_field'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _StatTile(
                icon: Icons.trending_up,
                iconColor: AppColors.primary,
                iconBg: AppColors.primaryLight,
                label: t.x('dash.total_disbursed'),
                value: fmt.format(summary.totalDisbursed),
                sub: t.x('dash.total_value'),
                responsive: responsive,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatTile(
                icon: Icons.assignment_turned_in_outlined,
                iconColor: AppColors.warning,
                iconBg: AppColors.warningBg,
                label: t.x('dash.total_recovered'),
                value: fmt.format(summary.totalCollectedAllTime),
                sub: t.x('dash.all_time_total'),
                responsive: responsive,
              ),
            ),
          ],
        ),
        if (summary.currentCapital != null) ...[
          const SizedBox(height: 12),
          _StatTile(
            icon: Icons.savings_outlined,
            iconColor: summary.currentCapital! >= 0
                ? AppColors.success
                : AppColors.danger,
            iconBg: summary.currentCapital! >= 0
                ? AppColors.successBg
                : AppColors.dangerBg,
            label: t.x('analytics.capitalBalance'),
            value: fmt.format(summary.currentCapital),
            sub: t.x('dash.cash_book'),
            responsive: responsive,
          ),
        ],
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.label,
    required this.value,
    required this.sub,
    this.responsive = false,
  });
  final IconData icon;
  final Color iconColor, iconBg;
  final String label, value, sub;
  final bool responsive;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 17),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (responsive)
            SizedBox(
              width: double.infinity,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  style: AppTypography.heroNumber.copyWith(
                    fontSize: 22,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            )
          else
            Text(
              value,
              style: AppTypography.heroNumber.copyWith(
                fontSize: 22,
                color: AppColors.textPrimary,
              ),
            ),
          Text(
            sub,
            style: AppTypography.caption,
            maxLines: responsive ? 2 : null,
            overflow: responsive ? TextOverflow.ellipsis : null,
          ),
        ],
      ),
    );
  }
}

class _AlertsRow extends StatelessWidget {
  const _AlertsRow({
    required this.summary,
    required this.t,
    this.isAgent = false,
    this.fmt,
  });
  final DashboardSummary summary;
  final T t;
  final bool isAgent;
  final NumberFormat? fmt;

  @override
  Widget build(BuildContext context) {
    final penaltyFormatted = fmt != null
        ? fmt!.format(summary.pendingPenaltyTotal)
        : '₹${summary.pendingPenaltyTotal.round()}';

    return Row(
      children: [
        Expanded(
          child: _AlertCard(
            label: t.x('dash.overdue_loans'),
            value: '${summary.overdueLoans}',
            icon: Icons.warning_amber_rounded,
            bg: AppColors.dangerBg,
            fg: AppColors.danger,
            onTap: () => context.go('/loans'),
          ),
        ),
        if (!isAgent) ...[
          const SizedBox(width: 12),
          Expanded(
            child: _AlertCard(
              label: t.x('dash.pending_penalties'),
              value: penaltyFormatted,
              icon: Icons.gavel_rounded,
              bg: AppColors.warningBg,
              fg: AppColors.warning,
              onTap: () => context.go('/penalties'),
            ),
          ),
        ],
      ],
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.bg,
    required this.fg,
    required this.onTap,
  });
  final String label, value;
  final IconData icon;
  final Color bg, fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: fg.withAlpha(36),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: fg, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      value,
                      style: AppTypography.heroNumber.copyWith(
                        fontSize: 22,
                        color: fg,
                      ),
                    ),
                    Text(
                      label,
                      style: AppTypography.caption.copyWith(color: fg),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.t, required this.responsive});
  final T t;
  final bool responsive;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _CompactActionChip(
            icon: Icons.payments_rounded,
            label: t.x('coll.title'),
            color: AppColors.primary,
            onTap: () => context.go('/collection'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _CompactActionChip(
            icon: Icons.person_add_alt_1_rounded,
            label: t.x('dash.new_customer'),
            color: AppColors.info,
            onTap: () => context.go('/customers/new'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _CompactActionChip(
            icon: Icons.add_card_rounded,
            label: t.x('dash.new_loan'),
            color: AppColors.success,
            onTap: () => context.go(responsive ? '/loans/new' : '/loans'),
          ),
        ),
      ],
    );
  }
}

class _CompactActionChip extends StatelessWidget {
  const _CompactActionChip({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withAlpha(20),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  style: AppTypography.caption.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UpNextPager extends ConsumerStatefulWidget {
  const _UpNextPager({
    required this.fmt,
    required this.t,
    this.frequency = 'all',
    this.tab = 0,
    this.onResetFrequency,
  });
  final NumberFormat fmt;
  final T t;
  final String frequency;
  final int tab;
  final VoidCallback? onResetFrequency;

  @override
  ConsumerState<_UpNextPager> createState() => _UpNextPagerState();
}

class _UpNextPagerState extends ConsumerState<_UpNextPager> {
  final _ctrl = PageController(viewportFraction: 0.94);
  int _idx = 0;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final async = ref.watch(collectionTodayProvider);
    final user = ref.watch(authControllerProvider).user;
    final isGpsSubscribed = user?.gpsTrackingEnabled == true;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Text(
                widget.frequency == 'all'
                    ? t.x('dash.up_next').toUpperCase()
                    : '${t.x('dash.up_next').toUpperCase()} \u2022 ${widget.frequency.toUpperCase()}',
                style: AppTypography.tiny.copyWith(
                  color: widget.frequency == 'all'
                      ? AppColors.textSecondary
                      : AppColors.primary,
                  letterSpacing: 1,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 8),
              GpsHeaderBadge(
                isSubscribed: isGpsSubscribed,
                onTapSubscribe: () => showGpsAddonSubscribeSheet(context, ref),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () {
                  final freqParam = widget.frequency != 'all'
                      ? '?frequency=${widget.frequency}'
                      : '';
                  context.go('/collection$freqParam');
                },
                child: Text(
                  '${t.x('common.see_all')} \u2192',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textLight,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        async.when(
          loading: () {
            final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
            final cached = cachedCollectionTodayFor(scopeKey);
            if (cached != null && cached.isNotEmpty) {
              return _buildRowsContent(cached, t);
            }
            return const Skeleton(height: 156, borderRadius: 18);
          },
          error: (e, st) {
            debugPrint('[UpNextPager] collectionTodayProvider error: $e\n$st');
            final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
            final cached = cachedCollectionTodayFor(scopeKey);
            if (cached != null && cached.isNotEmpty) {
              return _buildRowsContent(cached, t);
            }
            return Container(
              height: 110,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withAlpha(90)),
                boxShadow: AppTokens.shadow,
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(20),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.refresh_rounded,
                        color: AppColors.primary, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Queue loading',
                          style: AppTypography.bodySmall
                              .copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Tap reload to view today\'s visits',
                          style: AppTypography.caption
                              .copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () => ref.invalidate(collectionTodayProvider),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      elevation: 0,
                    ),
                    child: const Text('Reload',
                        style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            );
          },
          data: (rows) => _buildRowsContent(rows, t),
        ),
        const SizedBox(height: 14),
        DashboardGpsWidget(
          isSubscribed: isGpsSubscribed,
          onTapSubscribe: () => showGpsAddonSubscribeSheet(context, ref),
        ),
      ],
    );
  }

  Widget _buildRowsContent(List<CollectionRow> rows, T t) {
    // Filter by frequency if specified
    final freqFiltered = widget.frequency == 'all'
        ? rows
        : rows
            .where((r) =>
                r.cadence.toLowerCase() == widget.frequency.toLowerCase())
            .toList(growable: false);

    // One card per loan. Filter by tab: 0 = Today's scheduled queue, 1 = Overdue queue
    final pendingRows = freqFiltered
        .where((r) {
          if (r.isResolved || r.outstanding <= 0) return false;
          if (widget.tab == 1) return r.isOverdueBucket;
          return true;
        })
        .toList(growable: false);
    final byLoan = <String, _UpNextEntry>{};
    for (final r in pendingRows) {
      final todayDue = r.todayOutstanding;
      final overdueDue = r.overdueOutstanding;
      final due = todayDue + overdueDue;
      if (due <= 0) continue;
      final loanKey = r.loanId.isNotEmpty ? r.loanId : r.instalmentId;
      final existing = byLoan[loanKey];
      if (existing == null) {
        byLoan[loanKey] = _UpNextEntry(
          row: r,
          rows: [r],
          todayTotal: todayDue,
          overdueTotal: overdueDue,
          count: 1,
        );
      } else {
        existing.rows.add(r);
        existing.todayTotal += todayDue;
        existing.overdueTotal += overdueDue;
        existing.count += 1;
        // Keep the earliest-due instalment as the collect target.
        if (r.dueDate.isBefore(existing.row.dueDate)) {
          existing.row = r;
        }
      }
    }
    for (final entry in byLoan.values) {
      final loanRows =
          rows.where((r) => r.loanId == entry.row.loanId).toList();
      final bool hasPaidToday = loanRows.any((r) => r.isResolved);
      // When tenure reached, keep extending days only if nothing was collected today yet:
      // today's due continues as the normal installment carved out of overdue.
      if (!hasPaidToday &&
          entry.todayTotal == 0 &&
          entry.overdueTotal > 0) {
        final daily = math.min(entry.row.dueAmount, entry.overdueTotal);
        entry.todayTotal = daily;
        entry.overdueTotal = math.max(0, entry.overdueTotal - daily);
      }
    }
    final pending = byLoan.values.toList(growable: false);
    if (pending.isEmpty) {
      if (widget.frequency != 'all') {
        return Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            boxShadow: AppTokens.shadow,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.filter_alt_outlined,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'No ${widget.frequency} collections',
                      style: AppTypography.bodyLarge
                          .copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'No pending items match ${widget.frequency} frequency.',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
              ),
              if (widget.onResetFrequency != null)
                TextButton(
                  onPressed: widget.onResetFrequency,
                  child: Text(
                    'Show all',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
        );
      }
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          boxShadow: AppTokens.shadow,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.successBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.check_circle_outline,
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.x('dash.all_done_title'),
                    style: AppTypography.bodyLarge,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    t.x('dash.all_done_sub'),
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }
    return Column(
      children: [
        SizedBox(
          height: 220,
          child: PageView.builder(
            controller: _ctrl,
            itemCount: pending.length,
            onPageChanged: (i) => setState(() => _idx = i),
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: _UpNextCard(
                row: pending[i].row,
                scopeRows: pending[i].rows,
                fmt: widget.fmt,
                todayDue: pending[i].todayTotal,
                overdueDue: pending[i].overdueTotal,
                dueCount: pending[i].count,
              ),
            ),
          ),
        ),
        if (pending.length > 1) ...[
          const SizedBox(height: 10),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 4,
              ),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                '${_idx + 1}/${pending.length}',
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Aggregation of one loan's dues for the Up Next section.
class _UpNextEntry {
  _UpNextEntry({
    required this.row,
    required this.rows,
    required this.todayTotal,
    required this.overdueTotal,
    required this.count,
  });
  CollectionRow row;
  final List<CollectionRow> rows;
  double todayTotal;
  double overdueTotal;
  int count;
}

class _UpNextCard extends ConsumerWidget {
  const _UpNextCard({
    required this.row,
    required this.scopeRows,
    required this.fmt,
    required this.todayDue,
    required this.overdueDue,
    this.dueCount = 1,
  });
  final CollectionRow row;
  final List<CollectionRow> scopeRows;
  final NumberFormat fmt;
  final double todayDue;
  final double overdueDue;

  /// How many separate due rows this loan has today.
  final int dueCount;

  Future<void> _openLocation(BuildContext context) async {
    if (row.lat != null && row.lng != null && row.lat != 0 && row.lng != 0) {
      final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=${row.lat},${row.lng}&travelmode=driving',
      );
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    }
    final query = [
      row.customerName,
      if (row.routeName != null && row.routeName!.isNotEmpty) row.routeName,
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

  Future<void> _openWhatsApp(BuildContext context) async {
    if (row.customerPhone.isEmpty) return;
    final digits = row.customerPhone.replaceAll(RegExp(r'\D'), '');
    final phone = digits.length == 10 ? '91$digits' : digits;
    final text = Uri.encodeComponent(
      'Namaste ${row.customerName}, this is regarding your ZoloFund loan ${row.loanCode}.',
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

  Future<void> _callPhone() async {
    if (row.customerPhone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: row.customerPhone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _openCollect(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(row: row, scopeRows: scopeRows),
    ).then((_) => refreshCollectionViews(ref));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final time = TimeOfDay.fromDateTime(row.dueDate).format(context);
    final route = row.routeName;
    final due = todayDue + overdueDue;
    final statusLabel = overdueDue > 0 && todayDue > 0
        ? 'MIXED DUES'
        : overdueDue > 0
            ? t.x('coll.filter_overdue').toUpperCase()
            : 'TODAY SCHEDULED';
    final Color statusAccent =
        overdueDue > 0 ? AppColors.danger : AppColors.primary;

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
            color: statusAccent.withAlpha(20),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: statusAccent.withAlpha(50),
              width: 1.2,
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white,
                statusAccent.withAlpha(10),
              ],
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 5,
                    color: statusAccent,
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              _Avatar(
                                name: row.customerName,
                                size: 44,
                                image: row.customerPhoto != null &&
                                        row.customerPhoto!.isNotEmpty
                                    ? authedImage(ref, row.customerPhoto!)
                                    : null,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      row.customerName,
                                      style: AppTypography.bodyLarge.copyWith(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.access_time_rounded,
                                          size: 11,
                                          color: AppColors.textLight,
                                        ),
                                        const SizedBox(width: 3),
                                        Flexible(
                                          child: Text(
                                            [
                                              time,
                                              if (row.loanCode.isNotEmpty)
                                                row.loanCode,
                                              if (route != null &&
                                                  route.isNotEmpty)
                                                route,
                                              if (dueCount > 1)
                                                '$dueCount ${t.x('dash.dues')}',
                                            ].join(' · '),
                                            style:
                                                AppTypography.caption.copyWith(
                                              fontSize: 11,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: statusAccent.withAlpha(24),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      statusLabel,
                                      style: AppTypography.extraTiny.copyWith(
                                        color: statusAccent,
                                        letterSpacing: 0,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 9.5,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    fmt.format(due),
                                    style: AppTypography.moneyLg.copyWith(
                                      fontSize: 19,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          if (todayDue > 0 || overdueDue > 0) ...[
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                if (todayDue > 0)
                                  _DueChip(
                                    icon: Icons.today_rounded,
                                    label: 'Today',
                                    value: fmt.format(todayDue),
                                    color: AppColors.primary,
                                  ),
                                if (overdueDue > 0)
                                  _DueChip(
                                    icon: Icons.history_rounded,
                                    label: 'Overdue',
                                    value: fmt.format(overdueDue),
                                    color: AppColors.danger,
                                  ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: Material(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(10),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(10),
                                    onTap: () => _openCollect(context, ref),
                                    child: Container(
                                      height: 38,
                                      alignment: Alignment.center,
                                      child: const Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Icons.payments_rounded,
                                            color: Colors.white,
                                            size: 16,
                                          ),
                                          SizedBox(width: 6),
                                          Text(
                                            'Collect now',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Tooltip(
                                message: 'Location / Navigation',
                                child: Material(
                                  color: const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(10),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(10),
                                    onTap: () => _openLocation(context),
                                    child: Container(
                                      width: 38,
                                      height: 38,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        border: Border.all(
                                          color: const Color(0xFF2563EB)
                                              .withAlpha(45),
                                        ),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: const Icon(
                                        Icons.near_me_rounded,
                                        size: 17,
                                        color: Color(0xFF2563EB),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              if (row.customerPhone.isNotEmpty) ...[
                                const SizedBox(width: 6),
                                Tooltip(
                                  message: 'WhatsApp',
                                  child: Material(
                                    color: const Color(0xFFF0FDF4),
                                    borderRadius: BorderRadius.circular(10),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(10),
                                      onTap: () => _openWhatsApp(context),
                                      child: Container(
                                        width: 38,
                                        height: 38,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          border: Border.all(
                                            color: const Color(0xFF16A34A)
                                                .withAlpha(45),
                                          ),
                                          borderRadius:
                                              BorderRadius.circular(10),
                                        ),
                                        child: const Icon(
                                          Icons.chat_bubble_outline_rounded,
                                          size: 17,
                                          color: Color(0xFF16A34A),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Tooltip(
                                  message: 'Call customer',
                                  child: Material(
                                    color: const Color(0xFFECFDF5),
                                    borderRadius: BorderRadius.circular(10),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(10),
                                      onTap: _callPhone,
                                      child: Container(
                                        width: 38,
                                        height: 38,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          border: Border.all(
                                            color: AppColors.success
                                                .withAlpha(45),
                                          ),
                                          borderRadius:
                                              BorderRadius.circular(10),
                                        ),
                                        child: const Icon(
                                          Icons.call_rounded,
                                          size: 17,
                                          color: AppColors.success,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DueChip extends StatelessWidget {
  const _DueChip({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(24),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withAlpha(48)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          Text(
            '$label $value',
            style: AppTypography.extraTiny.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

enum _ActivityCategoryTab { all, paid, pending, newLoans, newCustomers, other }

enum _ActivityDateFilter { today, yesterday, last7Days, last30Days, custom }

class _UnifiedActivityItem {
  _UnifiedActivityItem.paid(TodayPaidItem item)
      : kind = 'paid',
        paid = item,
        sortTime = item.submittedAt,
        pending = null,
        newLoan = null,
        newCustomer = null,
        other = null;

  _UnifiedActivityItem.pending(TodayPendingItem item)
      : kind = 'pending',
        pending = item,
        sortTime = item.dueDate,
        paid = null,
        newLoan = null,
        newCustomer = null,
        other = null;

  _UnifiedActivityItem.newLoan(TodayNewLoanItem item)
      : kind = 'new_loan',
        newLoan = item,
        sortTime = item.createdAt,
        paid = null,
        pending = null,
        newCustomer = null,
        other = null;

  _UnifiedActivityItem.newCustomer(TodayNewCustomerItem item)
      : kind = 'new_customer',
        newCustomer = item,
        sortTime = item.createdAt,
        paid = null,
        pending = null,
        newLoan = null,
        other = null;

  _UnifiedActivityItem.other(TodayOtherActivityItem item)
      : kind = 'other',
        other = item,
        sortTime = item.timestamp,
        paid = null,
        pending = null,
        newLoan = null,
        newCustomer = null;

  final String kind;
  final DateTime sortTime;
  final TodayPaidItem? paid;
  final TodayPendingItem? pending;
  final TodayNewLoanItem? newLoan;
  final TodayNewCustomerItem? newCustomer;
  final TodayOtherActivityItem? other;

  String get customerId {
    if (paid != null) return paid!.customerId;
    if (pending != null) return pending!.customerId;
    if (newLoan != null) return newLoan!.customerId;
    if (newCustomer != null) return newCustomer!.id;
    return '';
  }

  String get phone {
    if (paid != null) return paid!.customerPhone ?? '';
    if (pending != null) return pending!.customerPhone ?? '';
    if (newLoan != null) return newLoan!.customerPhone ?? '';
    if (newCustomer != null) return newCustomer!.phone ?? '';
    return '';
  }
}

class _RecentActivitiesSection extends ConsumerStatefulWidget {
  const _RecentActivitiesSection({
    required this.summary,
    required this.fmt,
    required this.t,
  });

  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  ConsumerState<_RecentActivitiesSection> createState() =>
      _RecentActivitiesSectionState();
}

class _RecentActivitiesSectionState
    extends ConsumerState<_RecentActivitiesSection> {
  _ActivityCategoryTab _activeTab = _ActivityCategoryTab.all;
  _ActivityDateFilter _dateFilter = _ActivityDateFilter.today;
  DateTimeRange? _customDateRange;
  TodaysActivityBundle? _customBundle;
  bool _isLoading = false;
  String? _loadError;

  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() {
      final q = _searchCtrl.text.trim().toLowerCase();
      if (q != _searchQuery) {
        setState(() => _searchQuery = q);
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _onDateFilterSelected(_ActivityDateFilter filter) async {
    if (filter == _ActivityDateFilter.custom) {
      final now = DateTime.now();
      final picked = await showDateRangePicker(
        context: context,
        firstDate: now.subtract(const Duration(days: 365)),
        lastDate: now,
        initialDateRange: _customDateRange ??
            DateTimeRange(
              start: now.subtract(const Duration(days: 7)),
              end: now,
            ),
        builder: (context, child) {
          return Theme(
            data: Theme.of(context).copyWith(
              colorScheme: ColorScheme.light(
                primary: AppColors.primary,
                onPrimary: Colors.white,
              ),
            ),
            child: child!,
          );
        },
      );
      if (picked == null) return;
      setState(() {
        _dateFilter = filter;
        _customDateRange = picked;
      });
      await _fetchActivities(picked.start, picked.end);
      return;
    }

    setState(() => _dateFilter = filter);

    if (filter == _ActivityDateFilter.today) {
      setState(() {
        _customBundle = null;
        _isLoading = false;
        _loadError = null;
      });
      return;
    }

    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    DateTime start;
    DateTime end = DateTime(now.year, now.month, now.day, 23, 59, 59);

    if (filter == _ActivityDateFilter.yesterday) {
      start = todayStart.subtract(const Duration(days: 1));
      end = DateTime(start.year, start.month, start.day, 23, 59, 59);
    } else if (filter == _ActivityDateFilter.last7Days) {
      start = todayStart.subtract(const Duration(days: 7));
    } else {
      // last30Days
      start = todayStart.subtract(const Duration(days: 30));
    }

    await _fetchActivities(start, end);
  }

  Future<void> _fetchActivities(DateTime from, DateTime to) async {
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
    try {
      final repo = ref.read(dashboardRepositoryProvider);
      final res = await repo.getActivities(from: from, to: to);
      if (mounted) {
        setState(() {
          _customBundle = res;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _loadError = e.toString();
        });
      }
    }
  }

  String _getDateSubtitle() {
    final now = DateTime.now();
    switch (_dateFilter) {
      case _ActivityDateFilter.today:
        return 'Today · ${DateFormat('EEEE, d MMMM yyyy').format(now)}';
      case _ActivityDateFilter.yesterday:
        final y = now.subtract(const Duration(days: 1));
        return 'Yesterday · ${DateFormat('EEEE, d MMMM yyyy').format(y)}';
      case _ActivityDateFilter.last7Days:
        final from = now.subtract(const Duration(days: 7));
        return 'Last 7 Days · ${DateFormat('d MMM').format(from)} – ${DateFormat('d MMM yyyy').format(now)}';
      case _ActivityDateFilter.last30Days:
        final from = now.subtract(const Duration(days: 30));
        return 'Last 30 Days · ${DateFormat('d MMM').format(from)} – ${DateFormat('d MMM yyyy').format(now)}';
      case _ActivityDateFilter.custom:
        if (_customDateRange != null) {
          return 'Custom · ${DateFormat('d MMM yyyy').format(_customDateRange!.start)} – ${DateFormat('d MMM yyyy').format(_customDateRange!.end)}';
        }
        return 'Custom Range';
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final fmt = widget.fmt;
    final bundle = _customBundle ?? widget.summary.todaysActivity;

    final totalPaidAmount =
        bundle.paidItems.fold<double>(0, (s, a) => s + a.receivedAmount);
    final totalPendingAmount =
        bundle.pendingItems.fold<double>(0, (s, a) => s + a.remainingAmount);
    final totalDisbursedAmount =
        bundle.newLoanItems.fold<double>(0, (s, a) => s + a.principal);

    final allItems = <_UnifiedActivityItem>[];
    for (final p in bundle.paidItems) {
      allItems.add(_UnifiedActivityItem.paid(p));
    }
    for (final p in bundle.pendingItems) {
      allItems.add(_UnifiedActivityItem.pending(p));
    }
    for (final l in bundle.newLoanItems) {
      allItems.add(_UnifiedActivityItem.newLoan(l));
    }
    for (final c in bundle.newCustomerItems) {
      allItems.add(_UnifiedActivityItem.newCustomer(c));
    }
    for (final o in bundle.otherItems) {
      allItems.add(_UnifiedActivityItem.other(o));
    }

    allItems.sort((a, b) => b.sortTime.compareTo(a.sortTime));

    final q = _searchQuery;
    final filtered = allItems.where((item) {
      switch (_activeTab) {
        case _ActivityCategoryTab.all:
          break;
        case _ActivityCategoryTab.paid:
          if (item.kind != 'paid') return false;
        case _ActivityCategoryTab.pending:
          if (item.kind != 'pending') return false;
        case _ActivityCategoryTab.newLoans:
          if (item.kind != 'new_loan') return false;
        case _ActivityCategoryTab.newCustomers:
          if (item.kind != 'new_customer') return false;
        case _ActivityCategoryTab.other:
          if (item.kind != 'other') return false;
      }

      if (q.isEmpty) return true;

      if (item.paid != null) {
        final p = item.paid!;
        return p.customerName.toLowerCase().contains(q) ||
            p.customerCode.toLowerCase().contains(q) ||
            p.loanCode.toLowerCase().contains(q) ||
            (p.agentName?.toLowerCase().contains(q) ?? false) ||
            (p.routeName?.toLowerCase().contains(q) ?? false) ||
            (p.customerPhone?.contains(q) ?? false);
      }
      if (item.pending != null) {
        final p = item.pending!;
        return p.customerName.toLowerCase().contains(q) ||
            p.customerCode.toLowerCase().contains(q) ||
            p.loanCode.toLowerCase().contains(q) ||
            (p.customerPhone?.contains(q) ?? false) ||
            (p.routeName?.toLowerCase().contains(q) ?? false);
      }
      if (item.newLoan != null) {
        final l = item.newLoan!;
        return l.customerName.toLowerCase().contains(q) ||
            l.customerCode.toLowerCase().contains(q) ||
            l.loanCode.toLowerCase().contains(q) ||
            (l.customerPhone?.contains(q) ?? false) ||
            (l.createdByName?.toLowerCase().contains(q) ?? false) ||
            (l.routeName?.toLowerCase().contains(q) ?? false);
      }
      if (item.newCustomer != null) {
        final c = item.newCustomer!;
        return c.name.toLowerCase().contains(q) ||
            c.customerCode.toLowerCase().contains(q) ||
            (c.phone?.contains(q) ?? false) ||
            (c.routeName?.toLowerCase().contains(q) ?? false);
      }
      if (item.other != null) {
        final o = item.other!;
        return o.title.toLowerCase().contains(q) ||
            o.description.toLowerCase().contains(q) ||
            (o.customerCode?.toLowerCase().contains(q) ?? false) ||
            (o.loanCode?.toLowerCase().contains(q) ?? false);
      }
      return true;
    }).toList();

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF3B82F6).withAlpha(60),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.history_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t.x('dash.recent_activities'),
                      style: AppTypography.sectionTitle,
                    ),
                    Text(
                      _getDateSubtitle(),
                      style: AppTypography.caption
                          .copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              if (allItems.isNotEmpty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(24),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${allItems.length}',
                    style: AppTypography.extraTiny.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // Date Filter Bar (Today, Yesterday, Last 7 Days, Last 30 Days, Custom)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildDateChip(
                  _ActivityDateFilter.today,
                  t.x('dash.filter_today'),
                  Icons.today_rounded,
                ),
                const SizedBox(width: 8),
                _buildDateChip(
                  _ActivityDateFilter.yesterday,
                  t.x('dash.filter_yesterday'),
                  Icons.history_rounded,
                ),
                const SizedBox(width: 8),
                _buildDateChip(
                  _ActivityDateFilter.last7Days,
                  t.x('dash.filter_last_7_days'),
                  Icons.date_range_outlined,
                ),
                const SizedBox(width: 8),
                _buildDateChip(
                  _ActivityDateFilter.last30Days,
                  t.x('dash.filter_last_30_days'),
                  Icons.calendar_month_outlined,
                ),
                const SizedBox(width: 8),
                _buildDateChip(
                  _ActivityDateFilter.custom,
                  _customDateRange != null
                      ? '${DateFormat('d MMM').format(_customDateRange!.start)} - ${DateFormat('d MMM').format(_customDateRange!.end)}'
                      : t.x('dash.filter_custom_range'),
                  Icons.tune_rounded,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Search Bar
          Container(
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: TextField(
              controller: _searchCtrl,
              style: AppTypography.body,
              decoration: InputDecoration(
                hintText: t.x('dash.search_activity'),
                hintStyle:
                    AppTypography.caption.copyWith(color: AppColors.textLight),
                prefixIcon: const Icon(
                  Icons.search,
                  size: 20,
                  color: AppColors.textLight,
                ),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(
                          Icons.clear,
                          size: 18,
                          color: AppColors.textLight,
                        ),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                isDense: true,
              ),
            ),
          ),
          const SizedBox(height: 14),

          // KPI Summary Strip (Horizontal scrollable)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildKpiCard(
                  icon: Icons.check_circle_outline,
                  iconBg: const Color(0xFFD1FAE5),
                  iconColor: const Color(0xFF059669),
                  title: t.x('dash.paid_today'),
                  value: fmt.format(totalPaidAmount),
                  subtitle: '${bundle.paidItems.length} records',
                  isSelected: _activeTab == _ActivityCategoryTab.paid,
                  onTap: () =>
                      setState(() => _activeTab = _ActivityCategoryTab.paid),
                ),
                const SizedBox(width: 10),
                _buildKpiCard(
                  icon: Icons.hourglass_top_rounded,
                  iconBg: const Color(0xFFFEF3C7),
                  iconColor: const Color(0xFFD97706),
                  title: t.x('dash.pending_today'),
                  value: fmt.format(totalPendingAmount),
                  subtitle: '${bundle.pendingItems.length} records',
                  isSelected: _activeTab == _ActivityCategoryTab.pending,
                  onTap: () =>
                      setState(() => _activeTab = _ActivityCategoryTab.pending),
                ),
                const SizedBox(width: 10),
                _buildKpiCard(
                  icon: Icons.request_quote_outlined,
                  iconBg: const Color(0xFFDBEAFE),
                  iconColor: const Color(0xFF2563EB),
                  title: t.x('dash.new_loans'),
                  value: fmt.format(totalDisbursedAmount),
                  subtitle: '${bundle.newLoanItems.length} loans',
                  isSelected: _activeTab == _ActivityCategoryTab.newLoans,
                  onTap: () => setState(
                      () => _activeTab = _ActivityCategoryTab.newLoans,),
                ),
                const SizedBox(width: 10),
                _buildKpiCard(
                  icon: Icons.person_add_alt_1_outlined,
                  iconBg: const Color(0xFFF3E8FF),
                  iconColor: const Color(0xFF9333EA),
                  title: t.x('dash.new_customers'),
                  value: '${bundle.newCustomerItems.length}',
                  subtitle: 'registered',
                  isSelected: _activeTab == _ActivityCategoryTab.newCustomers,
                  onTap: () => setState(
                      () => _activeTab = _ActivityCategoryTab.newCustomers,),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Category Filter Tabs Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildTabPill(
                  _ActivityCategoryTab.all,
                  '${t.x('dash.all_activity')} (${allItems.length})',
                ),
                const SizedBox(width: 8),
                _buildTabPill(
                  _ActivityCategoryTab.paid,
                  '${t.x('dash.paid_today')} (${bundle.paidItems.length})',
                ),
                const SizedBox(width: 8),
                _buildTabPill(
                  _ActivityCategoryTab.pending,
                  '${t.x('dash.pending_today')} (${bundle.pendingItems.length})',
                ),
                const SizedBox(width: 8),
                _buildTabPill(
                  _ActivityCategoryTab.newLoans,
                  '${t.x('dash.new_loans')} (${bundle.newLoanItems.length})',
                ),
                const SizedBox(width: 8),
                _buildTabPill(
                  _ActivityCategoryTab.newCustomers,
                  '${t.x('dash.new_customers')} (${bundle.newCustomerItems.length})',
                ),
                const SizedBox(width: 8),
                _buildTabPill(
                  _ActivityCategoryTab.other,
                  '${t.x('dash.other_activity')} (${bundle.otherItems.length})',
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Items List, Loading State, Error State, or Empty State
          if (_isLoading)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: CircularProgressIndicator(
                  color: AppColors.primary,
                  strokeWidth: 2.5,
                ),
              ),
            )
          else if (_loadError != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Column(
                  children: [
                    const Icon(
                      Icons.cloud_off_rounded,
                      color: AppColors.danger,
                      size: 32,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Failed to load activities',
                      style: AppTypography.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: () => _onDateFilterSelected(_dateFilter),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          else if (filtered.isEmpty)
            SizedBox(
              height: 120,
              child: EmptyState(
                icon: Icons.event_available_outlined,
                title: _searchQuery.isNotEmpty
                    ? t.x('dash.no_filtered_activity')
                    : t.x('dash.no_activity'),
              ),
            )
          else
            Column(
              children: [
                for (final item in filtered) ...[
                  _buildSimpleActivityTile(item, fmt, t),
                ],
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildDateChip(
    _ActivityDateFilter filter,
    String label,
    IconData icon,
  ) {
    final isSelected = _dateFilter == filter;
    return InkWell(
      onTap: () => _onDateFilterSelected(filter),
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.background,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected ? Colors.white : AppColors.textSecondary,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: AppTypography.extraTiny.copyWith(
                color: isSelected ? Colors.white : AppColors.textPrimary,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String value,
    required String subtitle,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 145,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? iconBg.withAlpha(50) : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? iconColor : AppColors.border,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Icon(icon, size: 16, color: iconColor),
                ),
                const Spacer(),
                Text(
                  title,
                  style: AppTypography.extraTiny.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: AppTypography.bodyLarge.copyWith(
                fontWeight: FontWeight.w800,
                color: isSelected ? iconColor : AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style:
                  AppTypography.extraTiny.copyWith(color: AppColors.textLight),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabPill(_ActivityCategoryTab tab, String label) {
    final isSelected = _activeTab == tab;
    return InkWell(
      onTap: () => setState(() => _activeTab = tab),
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.background,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: AppTypography.caption.copyWith(
            color: isSelected ? Colors.white : AppColors.textSecondary,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildSimpleActivityTile(
    _UnifiedActivityItem item,
    NumberFormat fmt,
    T t,
  ) {
    final IconData icon;
    final Color iconBg;
    final Color iconColor;
    final String badgeLabel;
    final Color badgeBg;
    final Color badgeColor;
    final String title;
    final String subtitle;
    final String amountText;
    final Color amountColor;

    if (item.paid != null) {
      final p = item.paid!;
      icon = Icons.arrow_downward_rounded;
      iconBg = const Color(0xFFD1FAE5);
      iconColor = const Color(0xFF059669);
      badgeLabel = 'PAID · ${p.paymentMode.toUpperCase()}';
      badgeBg = const Color(0xFFD1FAE5);
      badgeColor = const Color(0xFF065F46);
      title = p.customerName;
      final timeStr = _formatItemTime(p.submittedAt);
      subtitle =
          '${p.customerCode.isNotEmpty ? '${p.customerCode} · ' : ''}${p.routeName != null ? '${p.routeName} · ' : ''}$timeStr';
      amountText = '+${fmt.format(p.receivedAmount)}';
      amountColor = const Color(0xFF059669);
    } else if (item.pending != null) {
      final p = item.pending!;
      final isMissed = p.status == 'missed';
      final isPartial = p.status == 'partial';
      icon = Icons.hourglass_top_rounded;
      iconBg = isMissed ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7);
      iconColor = isMissed ? const Color(0xFFDC2626) : const Color(0xFFD97706);
      badgeLabel = isMissed ? 'MISSED' : (isPartial ? 'PARTIAL' : 'DUE');
      badgeBg = iconBg;
      badgeColor = isMissed ? const Color(0xFF991B1B) : const Color(0xFF92400E);
      title = p.customerName;
      final timeStr = _formatItemTime(p.dueDate);
      subtitle =
          '${p.customerCode.isNotEmpty ? '${p.customerCode} · ' : ''}${p.routeName != null ? '${p.routeName} · ' : ''}$timeStr';
      amountText = fmt.format(p.remainingAmount);
      amountColor = isMissed ? AppColors.danger : const Color(0xFFD97706);
    } else if (item.newLoan != null) {
      final l = item.newLoan!;
      icon = Icons.receipt_long_rounded;
      iconBg = const Color(0xFFDBEAFE);
      iconColor = const Color(0xFF2563EB);
      badgeLabel = 'NEW LOAN';
      badgeBg = const Color(0xFFDBEAFE);
      badgeColor = const Color(0xFF1E40AF);
      title = l.customerName;
      final timeStr = _formatItemTime(l.createdAt);
      subtitle = '${l.loanCode} · ${l.frequency.toUpperCase()} · $timeStr';
      amountText = fmt.format(l.principal);
      amountColor = AppColors.primary;
    } else if (item.newCustomer != null) {
      final c = item.newCustomer!;
      icon = Icons.person_add_rounded;
      iconBg = const Color(0xFFF3E8FF);
      iconColor = const Color(0xFF9333EA);
      badgeLabel = 'NEW CUSTOMER';
      badgeBg = const Color(0xFFF3E8FF);
      badgeColor = const Color(0xFF6B21A8);
      title = c.name;
      final timeStr = _formatItemTime(c.createdAt);
      subtitle =
          '${c.customerCode.isNotEmpty ? '${c.customerCode} · ' : ''}${c.routeName != null ? '${c.routeName} · ' : ''}$timeStr';
      amountText = '';
      amountColor = AppColors.textPrimary;
    } else {
      final o = item.other!;
      icon = Icons.notifications_active_outlined;
      iconBg = const Color(0xFFF1F5F9);
      iconColor = const Color(0xFF475569);
      badgeLabel = o.type.replaceAll('_', ' ').toUpperCase();
      badgeBg = const Color(0xFFF1F5F9);
      badgeColor = const Color(0xFF475569);
      title = o.title;
      final timeStr = _formatItemTime(o.timestamp);
      subtitle = '${o.description} · $timeStr';
      amountText = o.amount != null ? fmt.format(o.amount!) : '';
      amountColor = AppColors.textPrimary;
    }

    final custId = item.customerId;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withAlpha(90)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: custId.isNotEmpty
              ? () => context.push('/customers/$custId')
              : null,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                // Icon Avatar
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 20, color: iconColor),
                ),
                const SizedBox(width: 10),

                // Center Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              title,
                              style: AppTypography.bodySmall.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: badgeBg,
                              borderRadius: BorderRadius.circular(5),
                            ),
                            child: Text(
                              badgeLabel,
                              style: AppTypography.extraTiny.copyWith(
                                fontWeight: FontWeight.w800,
                                color: badgeColor,
                                fontSize: 9,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                // Right Amount & Chevron
                if (amountText.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Text(
                    amountText,
                    style: AppTypography.body.copyWith(
                      fontWeight: FontWeight.w800,
                      color: amountColor,
                    ),
                  ),
                ],
                const SizedBox(width: 4),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.textLight,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatItemTime(DateTime time) {
    final now = DateTime.now();
    final isSameDay =
        time.year == now.year && time.month == now.month && time.day == now.day;
    if (isSameDay) {
      return DateFormat('h:mm a').format(time);
    }
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = time.year == yesterday.year &&
        time.month == yesterday.month &&
        time.day == yesterday.day;
    if (isYesterday) {
      return 'Yesterday, ${DateFormat('h:mm a').format(time)}';
    }
    return DateFormat('d MMM, h:mm a').format(time);
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
  }) : trailing = null;
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title, style: AppTypography.sectionTitle),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.size = 40, this.image});
  final String name;
  final double size;
  final ImageProvider? image;

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
    if (parts.isEmpty || parts.first.isEmpty) return '-';
    return parts.take(2).map((p) => p.isEmpty ? '' : p[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final c = _color();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: c.withAlpha(40),
        borderRadius: BorderRadius.circular(size / 2),
        image: image != null
            ? DecorationImage(image: image!, fit: BoxFit.cover)
            : null,
      ),
      alignment: Alignment.center,
      child: image != null
          ? null
          : Text(
              _initials(),
              style: TextStyle(
                color: c,
                fontWeight: FontWeight.w800,
                fontSize: size * 0.36,
              ),
            ),
    );
  }
}

class _AgentMetricsRow extends StatelessWidget {
  const _AgentMetricsRow({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatTile(
            icon: Icons.account_circle,
            iconColor: AppColors.info,
            iconBg: AppColors.infoBg,
            label: t.x('dash.customers'),
            value: '${summary.totalCustomers}',
            sub: t.x('dash.my_customers'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatTile(
            icon: Icons.check_circle,
            iconColor: AppColors.success,
            iconBg: AppColors.successBg,
            label: t.x('an.hit_rate'),
            value: '${summary.hitRate}%',
            sub: '${fmt.format(summary.todayPending)} ${t.x('dash.remaining')}',
          ),
        ),
      ],
    );
  }
}

class _DefaulterAlerts extends ConsumerWidget {
  const _DefaulterAlerts({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (summary.defaulterAlerts.isEmpty) return const SizedBox.shrink();

    return _Section(
      title: t.x('dash.at_risk_loans'),
      child: Column(
        children: [
          for (final alert in summary.defaulterAlerts)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  _Avatar(
                    name: alert.customerName,
                    size: 36,
                    image: alert.customerPhoto != null &&
                            alert.customerPhoto!.isNotEmpty
                        ? authedImage(ref, alert.customerPhoto!)
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          alert.customerName,
                          style: AppTypography.bodyLarge,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          alert.customerCode,
                          style: AppTypography.caption,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        fmt.format(alert.overdueAmount),
                        style: AppTypography.label
                            .copyWith(color: AppColors.danger),
                      ),
                      Text(
                        t.x('dash.overdue_loans'),
                        style: AppTypography.extraTiny,
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

class _RoutePerformanceList extends ConsumerWidget {
  const _RoutePerformanceList({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (summary.routePerformance.isEmpty) return const SizedBox.shrink();
    final user = ref.watch(authControllerProvider).user;
    final isAdmin = user != null &&
        (user.role == UserRole.admin ||
            user.role == UserRole.superadmin ||
            user.role == UserRole.developer);

    return _Section(
      title: t.x('dash.route_performance'),
      child: Column(
        children: [
          for (final rp in summary.routePerformance)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.route,
                      color: AppColors.primaryDark,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rp.name,
                          style: AppTypography.bodyLarge,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${rp.customers} ${t.x('dash.customers_suffix')}',
                          style: AppTypography.caption,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        fmt.format(rp.overdue),
                        style: AppTypography.label
                            .copyWith(color: AppColors.danger),
                      ),
                      Text(
                        t.x('status.overdue'),
                        style: AppTypography.extraTiny,
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

class _SpotlightCards extends StatelessWidget {
  const _SpotlightCards({required this.summary, required this.fmt});
  final DashboardSummary summary;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    if (summary.bestPayer == null && summary.highestBorrower == null) {
      return const SizedBox.shrink();
    }
    return Row(
      children: [
        if (summary.bestPayer != null)
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF10B981), Color(0xFF059669)],
                ),
                borderRadius: BorderRadius.circular(AppTokens.radius),
                boxShadow: AppTokens.shadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.star, color: Colors.white, size: 20),
                  const SizedBox(height: 8),
                  Text(
                    summary.bestPayer!,
                    style: AppTypography.bodyLarge.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Best Payer',
                    style:
                        AppTypography.caption.copyWith(color: Colors.white70),
                  ),
                ],
              ),
            ),
          ),
        if (summary.bestPayer != null && summary.highestBorrower != null)
          const SizedBox(width: 12),
        if (summary.highestBorrower != null)
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
                ),
                borderRadius: BorderRadius.circular(AppTokens.radius),
                boxShadow: AppTokens.shadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.trending_up_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    summary.highestBorrower!,
                    style: AppTypography.bodyLarge.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Highest Borrower',
                    style:
                        AppTypography.caption.copyWith(color: Colors.white70),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _ModeSplitCard extends StatelessWidget {
  const _ModeSplitCard({required this.summary, required this.fmt});
  final DashboardSummary summary;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    if (summary.todayByMode.isEmpty) return const SizedBox.shrink();

    final maxVal = summary.todayByMode.values.fold<double>(
      1.0,
      (max, v) => v > max ? v : max,
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Collection Split by Mode', style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          for (final entry in summary.todayByMode.entries) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        entry.key.toUpperCase(),
                        style: AppTypography.body
                            .copyWith(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        fmt.format(entry.value),
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Stack(
                    children: [
                      Container(
                        height: 8,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      FractionallySizedBox(
                        widthFactor: (entry.value / maxVal).clamp(0.02, 1.0),
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
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PendingUpiList extends ConsumerWidget {
  const _PendingUpiList({required this.summary, required this.fmt});
  final DashboardSummary summary;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = summary.pendingUpiCollections;
    if (pending.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Pending UPI Verifications (${pending.length})',
                style: AppTypography.sectionTitle,
              ),
              TextButton(
                onPressed: () {
                  showModalBottomSheet<bool>(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => VerifyUpiSheet(pending: pending, fmt: fmt),
                  ).then((success) {
                    if (success == true) {
                      ref.invalidate(dashboardSummaryProvider);
                    }
                  });
                },
                child: const Text('Verify All'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: pending.length.clamp(0, 5),
            itemBuilder: (_, i) {
              final p = pending[i];
              return ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(
                  '${p.customerName} — ${fmt.format(p.amount)}',
                  style:
                      AppTypography.body.copyWith(fontWeight: FontWeight.bold),
                ),
                subtitle: Text('${p.loanCode} · ${p.agentName}'),
                trailing: TextButton(
                  onPressed: () {
                    showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => VerifyUpiSheet(pending: [p], fmt: fmt),
                    ).then((success) {
                      if (success == true) {
                        ref.invalidate(dashboardSummaryProvider);
                      }
                    });
                  },
                  child: const Text('Verify'),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        Skeleton(height: 50, borderRadius: AppTokens.radius),
        SizedBox(height: 14),
        Skeleton(height: 140, borderRadius: 20),
        SizedBox(height: 14),
        Skeleton(height: 90, borderRadius: AppTokens.radius),
        SizedBox(height: 14),
        Skeleton(height: 90, borderRadius: AppTokens.radius),
        SizedBox(height: 14),
        Skeleton(height: 110, borderRadius: AppTokens.radius),
        SizedBox(height: 14),
        Skeleton(height: 200, borderRadius: AppTokens.radius),
      ],
    );
  }
}

class _ErrorState extends ConsumerWidget {
  const _ErrorState({required this.message});
  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return ListView(
      children: [
        const SizedBox(height: 80),
        const Icon(Icons.cloud_off, size: 56, color: AppColors.textLight),
        const SizedBox(height: 12),
        Text(
          t.x('err.could_not_load_dashboard'),
          textAlign: TextAlign.center,
          style: AppTypography.sectionTitle,
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              ElevatedButton.icon(
                onPressed: () {
                  ref.invalidate(dashboardSummaryProvider);
                },
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Reload'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
              ),
              if (message.contains('401') ||
                  message.toLowerCase().contains('unauthorized'))
                OutlinedButton.icon(
                  onPressed: () {
                    ref.read(authControllerProvider.notifier).logout();
                  },
                  icon: const Icon(Icons.login, size: 18),
                  label: const Text('Sign In Again'),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
