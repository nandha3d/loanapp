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
    show collectionTodayProvider, refreshCollectionViews;
import 'package:zolofund/features/collection/quick_collect_sheet.dart';
import 'package:zolofund/features/dashboard/widgets/chit_dashboard_body.dart';
import 'package:zolofund/features/dashboard/widgets/collection_trend_card.dart';
import 'package:zolofund/features/onboarding/onboarding_overlay.dart';
import 'package:zolofund/features/onboarding/location_permission_overlay.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';
import 'package:zolofund/features/dashboard/widgets/collect_cash_sheet.dart';
import 'package:zolofund/features/dashboard/widgets/verify_upi_sheet.dart';
import 'package:zolofund/shared/widgets/module_app_bar_title.dart';

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
        onRefresh: () async => isChit
            ? ref.refresh(chitDashboardSummaryProvider.future)
            : ref.refresh(dashboardSummaryProvider.future),
        child: isChit
            ? chitSummary!.when(
                loading: () => const _LoadingSkeleton(),
                error: (err, _) => _ErrorState(message: err.toString()),
                data: (s) => ChitDashboardBody(
                  summary: s,
                  fmt: fmt,
                  userName: user?.name ?? '',
                  t: t,
                ),
              )
            : summary!.when(
                loading: () => const _LoadingSkeleton(),
                error: (err, _) => _ErrorState(message: err.toString()),
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
              summary: summary, fmt: fmt, t: t, responsive: responsive),
        const SizedBox(height: 14),
        _AlertsRow(summary: summary, t: t),
        const SizedBox(height: 18),
        if (!isAgent) ...[
          _SpotlightCards(summary: summary, fmt: fmt),
          const SizedBox(height: 18),
          _ModeSplitCard(summary: summary, fmt: fmt),
          const SizedBox(height: 18),
          if (summary.pendingUpiCollections.isNotEmpty) ...[
            _PendingUpiList(summary: summary, fmt: fmt),
            const SizedBox(height: 18),
          ],
          CollectionTrendCard(responsive: responsive),
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
        _UpNextPager(fmt: fmt, t: t),
        const SizedBox(height: 18),
        _TodayActivitySection(summary: summary, fmt: fmt, t: t),
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
class _CollectionBreakdownSection extends StatefulWidget {
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
  State<_CollectionBreakdownSection> createState() =>
      _CollectionBreakdownSectionState();
}

class _CollectionBreakdownSectionState
    extends State<_CollectionBreakdownSection> {
  // 0 = Today's Collection, 1 = Overdue Collection
  int _tab = 0;
  // 'all' | 'active' | 'inactive'
  String _loanStatus = 'all';
  // 'all' | 'daily' | 'weekly' | 'monthly'
  String _frequency = 'all';

  // ── Helpers to resolve the correct metrics for the current filters ──────
  StatusSubMetrics _todayMetrics() {
    final td = widget.summary.todayBreakdown;
    final source = _frequency == 'all'
        ? td
        : (td.breakdown[_frequency] ?? const TodayFrequencyMetrics());
    // source is TodayCollectionBreakdown or TodayFrequencyMetrics — both have
    // .total / .active / .inactive of type StatusSubMetrics.
    if (source is TodayCollectionBreakdown) {
      if (_loanStatus == 'active') return source.active;
      if (_loanStatus == 'inactive') return source.inactive;
      return source.total;
    }
    final fm = source as TodayFrequencyMetrics;
    if (_loanStatus == 'active') return fm.active;
    if (_loanStatus == 'inactive') return fm.inactive;
    return fm.total;
  }

  OverdueStatusSubMetrics _overdueMetrics() {
    final od = widget.summary.overdueBreakdown;
    final source = _frequency == 'all'
        ? od
        : (od.breakdown[_frequency] ?? const OverdueFrequencyMetrics());
    if (source is OverdueCollectionBreakdown) {
      if (_loanStatus == 'active') return source.active;
      if (_loanStatus == 'inactive') return source.inactive;
      return source.total;
    }
    final fm = source as OverdueFrequencyMetrics;
    if (_loanStatus == 'active') return fm.active;
    if (_loanStatus == 'inactive') return fm.inactive;
    return fm.total;
  }

  @override
  Widget build(BuildContext context) {
    final fmt = widget.fmt;
    final td = widget.summary.todayBreakdown;
    final od = widget.summary.overdueBreakdown;

    return Column(
      children: [
        // ── Tab toggle: Today / Overdue ──────────────────────────────────
        _TabToggle(
          labels: const ["Today's Collection", 'Overdue Collection'],
          icons: const [
            Icons.calendar_today_rounded,
            Icons.warning_amber_rounded
          ],
          selected: _tab,
          onChanged: (i) => setState(() {
            _tab = i;
            _loanStatus = 'all';
            _frequency = 'all';
          }),
        ),
        const SizedBox(height: 12),

        // ── Main card ────────────────────────────────────────────────────
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: _tab == 0
                  ? const [AppColors.heroDarkFrom, AppColors.heroDarkTo]
                  : [
                      Color.lerp(const Color(0xFFB91C1C),
                          const Color(0xFF15803D), _overdueRecoveryPct())!,
                      Color.lerp(const Color(0xFF7F1D1D),
                          const Color(0xFF14532D), _overdueRecoveryPct())!,
                    ],
            ),
            boxShadow: AppTokens.shadowLg,
          ),
          child: Column(
            children: [
              // ── Active vs Inactive status pills ────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: _tab == 0
                    ? _StatusPillRow(
                        activeLabel: 'ACTIVE LOANS DUE',
                        activeAmount: fmt.format(td.active.expected),
                        activeCount: '${td.active.loanCount} loans',
                        activeCollected: fmt.format(td.active.collected),
                        inactiveLabel: 'INACTIVE LOANS DUE',
                        inactiveAmount: fmt.format(td.inactive.expected),
                        inactiveCount: '${td.inactive.loanCount} loans',
                        inactiveCollected: fmt.format(td.inactive.collected),
                        onActiveTap: () =>
                            setState(() => _loanStatus = 'active'),
                        onInactiveTap: () =>
                            setState(() => _loanStatus = 'inactive'),
                        selectedStatus: _loanStatus,
                        responsive: widget.responsive,
                      )
                    : _StatusPillRow(
                        activeLabel: 'ACTIVE LOANS OVERDUE',
                        activeAmount: fmt.format(od.active.totalOverdue),
                        activeCount: '${od.active.loanCount} loans',
                        activeCollected: fmt.format(od.active.collectedToday),
                        inactiveLabel: 'INACTIVE LOANS OVERDUE',
                        inactiveAmount: fmt.format(od.inactive.totalOverdue),
                        inactiveCount: '${od.inactive.loanCount} loans',
                        inactiveCollected:
                            fmt.format(od.inactive.collectedToday),
                        onActiveTap: () =>
                            setState(() => _loanStatus = 'active'),
                        onInactiveTap: () =>
                            setState(() => _loanStatus = 'inactive'),
                        selectedStatus: _loanStatus,
                        responsive: widget.responsive,
                      ),
              ),
              const SizedBox(height: 12),

              // ── Segmented selectors ────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    _SegmentedRow(
                      label: 'LOAN STATUS',
                      options: const ['All Loans', 'Active', 'Inactive'],
                      values: const ['all', 'active', 'inactive'],
                      selected: _loanStatus,
                      onChanged: (v) => setState(() => _loanStatus = v),
                      responsive: widget.responsive,
                    ),
                    const SizedBox(height: 8),
                    _SegmentedRow(
                      label: 'FREQUENCY',
                      options: const [
                        'All',
                        'Daily',
                        'Weekly',
                        'Monthly',
                        'Custom'
                      ],
                      values: const [
                        'all',
                        'daily',
                        'weekly',
                        'monthly',
                        'custom',
                      ],
                      selected: _frequency,
                      onChanged: (v) => setState(() => _frequency = v),
                      responsive: widget.responsive,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // ── 3 KPI metric boxes ─────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child:
                    _tab == 0 ? _buildTodayKPIs(fmt) : _buildOverdueKPIs(fmt),
              ),
              const SizedBox(height: 14),

              // ── Progress bar ───────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _buildProgressBar(),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── Breakdown by Frequency list ──────────────────────────────────
        _BreakdownByFrequency(
          isToday: _tab == 0,
          todayBreakdown: td,
          overdueBreakdown: od,
          loanStatus: _loanStatus,
          fmt: fmt,
          onFrequencyTap: (f) => setState(() => _frequency = f),
          selectedFrequency: _frequency,
        ),
      ],
    );
  }

  double _overdueRecoveryPct() {
    final m = _overdueMetrics();
    return m.totalOverdue <= 0
        ? 0.0
        : (m.collectedToday / m.totalOverdue).clamp(0.0, 1.0);
  }

  Widget _buildTodayKPIs(NumberFormat fmt) {
    final m = _todayMetrics();
    final pct =
        m.expected > 0 ? (m.collected / m.expected).clamp(0.0, 1.0) : 0.0;
    final barColor = _progressColor(pct);
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

  Widget _buildProgressBar() {
    double pct;
    if (_tab == 0) {
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
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('₹0',
                style: AppTypography.extraTiny.copyWith(color: Colors.white38)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: barColor.withAlpha(36),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: barColor.withAlpha(80), width: 1),
              ),
              child: Text(
                '$pctInt% ${_tab == 0 ? 'collected' : 'recovered'}',
                style: AppTypography.extraTiny.copyWith(
                  color: barColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              _tab == 0 ? 'Expected' : 'Total due',
              style: AppTypography.extraTiny.copyWith(color: Colors.white38),
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
      height: 42,
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
                    borderRadius: BorderRadius.circular(10),
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
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          labels[i],
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.tiny.copyWith(
                            color: selected == i
                                ? Colors.white
                                : AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
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

// ── Active vs Inactive status pills ──────────────────────────────────────────
class _StatusPillRow extends StatelessWidget {
  const _StatusPillRow({
    required this.activeLabel,
    required this.activeAmount,
    required this.activeCount,
    required this.activeCollected,
    required this.inactiveLabel,
    required this.inactiveAmount,
    required this.inactiveCount,
    required this.inactiveCollected,
    required this.onActiveTap,
    required this.onInactiveTap,
    required this.selectedStatus,
    required this.responsive,
  });
  final String activeLabel, activeAmount, activeCount, activeCollected;
  final String inactiveLabel, inactiveAmount, inactiveCount, inactiveCollected;
  final VoidCallback onActiveTap, onInactiveTap;
  final String selectedStatus;
  final bool responsive;

  @override
  Widget build(BuildContext context) {
    if (responsive && MediaQuery.sizeOf(context).width < 500) {
      return Column(
        children: [
          SizedBox(
            width: double.infinity,
            child: _StatusPill(
              label: activeLabel,
              amount: activeAmount,
              count: activeCount,
              collected: activeCollected,
              color: const Color(0xFF34D399),
              isSelected: selectedStatus == 'active',
              onTap: onActiveTap,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: _StatusPill(
              label: inactiveLabel,
              amount: inactiveAmount,
              count: inactiveCount,
              collected: inactiveCollected,
              color: const Color(0xFFFF8674),
              isSelected: selectedStatus == 'inactive',
              onTap: onInactiveTap,
            ),
          ),
        ],
      );
    }
    return Row(
      children: [
        Expanded(
          child: _StatusPill(
            label: activeLabel,
            amount: activeAmount,
            count: activeCount,
            collected: activeCollected,
            color: const Color(0xFF34D399),
            isSelected: selectedStatus == 'active',
            onTap: onActiveTap,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _StatusPill(
            label: inactiveLabel,
            amount: inactiveAmount,
            count: inactiveCount,
            collected: inactiveCollected,
            color: const Color(0xFFFF8674),
            isSelected: selectedStatus == 'inactive',
            onTap: onInactiveTap,
          ),
        ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.amount,
    required this.count,
    required this.collected,
    required this.color,
    required this.isSelected,
    required this.onTap,
  });
  final String label, amount, count, collected;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color.withAlpha(30) : Colors.white.withAlpha(8),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color:
                isSelected ? color.withAlpha(120) : Colors.white.withAlpha(20),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.extraTiny.copyWith(
                      color: Colors.white70,
                      fontWeight: FontWeight.w600,
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
                amount,
                style: AppTypography.bodyLarge.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '$count • Recv: $collected',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.extraTiny.copyWith(color: Colors.white38),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Segmented filter row ─────────────────────────────────────────────────────
class _SegmentedRow extends StatelessWidget {
  const _SegmentedRow({
    required this.label,
    required this.options,
    required this.values,
    required this.selected,
    required this.onChanged,
    required this.responsive,
  });
  final String label;
  final List<String> options;
  final List<String> values;
  final String selected;
  final ValueChanged<String> onChanged;
  final bool responsive;

  @override
  Widget build(BuildContext context) {
    if (responsive) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTypography.extraTiny.copyWith(
              color: Colors.white70,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: options.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (context, i) => Semantics(
                button: true,
                selected: selected == values[i],
                child: Material(
                  color: selected == values[i]
                      ? AppColors.primary
                      : Colors.white.withAlpha(16),
                  borderRadius: BorderRadius.circular(8),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () => onChanged(values[i]),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minWidth: 76),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Center(
                          child: Text(
                            options[i],
                            style: AppTypography.bodyLarge.copyWith(
                              color: selected == values[i]
                                  ? Colors.white
                                  : Colors.white70,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }
    return Row(
      children: [
        SizedBox(
          width: 66,
          child: Text(
            label,
            style: AppTypography.extraTiny.copyWith(
              color: Colors.white38,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ),
        Expanded(
          child: Container(
            height: 30,
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                for (var i = 0; i < options.length; i++)
                  Expanded(
                    child: GestureDetector(
                      onTap: () => onChanged(values[i]),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: selected == values[i]
                              ? AppColors.primary
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          options[i],
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.extraTiny.copyWith(
                            color: selected == values[i]
                                ? Colors.white
                                : Colors.white54,
                            fontWeight: FontWeight.w600,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
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

// ── Breakdown by Frequency list ──────────────────────────────────────────────
class _BreakdownByFrequency extends StatelessWidget {
  const _BreakdownByFrequency({
    required this.isToday,
    required this.todayBreakdown,
    required this.overdueBreakdown,
    required this.loanStatus,
    required this.fmt,
    required this.onFrequencyTap,
    required this.selectedFrequency,
  });
  final bool isToday;
  final TodayCollectionBreakdown todayBreakdown;
  final OverdueCollectionBreakdown overdueBreakdown;
  final String loanStatus;
  final NumberFormat fmt;
  final ValueChanged<String> onFrequencyTap;
  final String selectedFrequency;

  @override
  Widget build(BuildContext context) {
    const freqs = ['daily', 'weekly', 'monthly', 'custom'];
    const freqLabels = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'monthly': 'Monthly',
      'custom': 'Custom',
    };
    const freqIcons = {
      'daily': Icons.today_rounded,
      'weekly': Icons.date_range_rounded,
      'monthly': Icons.calendar_month_rounded,
      'custom': Icons.tune_rounded,
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'BREAKDOWN BY FREQUENCY',
                style: AppTypography.extraTiny.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => onFrequencyTap('all'),
                child: Text(
                  selectedFrequency == 'all' ? 'ALL' : 'Show All',
                  style: AppTypography.extraTiny.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final f in freqs) ...[
            _FrequencyRow(
              icon: freqIcons[f]!,
              label: freqLabels[f]!,
              isToday: isToday,
              todayMetrics: _getTodayFreq(f),
              overdueMetrics: _getOverdueFreq(f),
              fmt: fmt,
              isSelected: selectedFrequency == f,
              onTap: () => onFrequencyTap(f),
            ),
            if (f != freqs.last)
              Divider(height: 1, color: AppColors.border.withAlpha(80)),
          ],
        ],
      ),
    );
  }

  StatusSubMetrics _getTodayFreq(String freq) {
    final fm = todayBreakdown.breakdown[freq];
    if (fm == null) return const StatusSubMetrics();
    if (loanStatus == 'active') return fm.active;
    if (loanStatus == 'inactive') return fm.inactive;
    return fm.total;
  }

  OverdueStatusSubMetrics _getOverdueFreq(String freq) {
    final fm = overdueBreakdown.breakdown[freq];
    if (fm == null) return const OverdueStatusSubMetrics();
    if (loanStatus == 'active') return fm.active;
    if (loanStatus == 'inactive') return fm.inactive;
    return fm.total;
  }
}

class _FrequencyRow extends StatelessWidget {
  const _FrequencyRow({
    required this.icon,
    required this.label,
    required this.isToday,
    required this.todayMetrics,
    required this.overdueMetrics,
    required this.fmt,
    required this.isSelected,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool isToday;
  final StatusSubMetrics todayMetrics;
  final OverdueStatusSubMetrics overdueMetrics;
  final NumberFormat fmt;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final pct = isToday ? todayMetrics.pct : overdueMetrics.pct;
    final barColor = _progressColor((pct / 100).clamp(0.0, 1.0));

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color:
              isSelected ? AppColors.primary.withAlpha(12) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 14, color: AppColors.primary),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: AppTypography.bodySmall.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        isToday
                            ? 'Active: ${fmt.format(todayMetrics.collected)} • ${todayMetrics.loanCount} loans'
                            : 'Active: ${fmt.format(overdueMetrics.collectedToday)} • ${overdueMetrics.loanCount} loans',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.extraTiny.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                // Compact KPI values
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (isToday) ...[
                      _FreqValue('Exp', fmt.format(todayMetrics.expected)),
                      _FreqValue('Coll', fmt.format(todayMetrics.collected),
                          tone: const Color(0xFF34D399)),
                      _FreqValue('Rem', fmt.format(todayMetrics.remaining),
                          tone: const Color(0xFFFF8674)),
                    ] else ...[
                      _FreqValue(
                          'Overdue', fmt.format(overdueMetrics.totalOverdue)),
                      _FreqValue(
                          'Coll', fmt.format(overdueMetrics.collectedToday),
                          tone: const Color(0xFF34D399)),
                      _FreqValue('Rem', fmt.format(overdueMetrics.remaining),
                          tone: const Color(0xFFFF8674)),
                    ],
                  ],
                ),
                const SizedBox(width: 8),
                // Percentage badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: barColor.withAlpha(30),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${pct.round()}%',
                    style: AppTypography.extraTiny.copyWith(
                      color: barColor,
                      fontWeight: FontWeight.w700,
                      fontSize: 10,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FreqValue extends StatelessWidget {
  const _FreqValue(this.label, this.value, {this.tone});
  final String label, value;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$label ',
          style: AppTypography.extraTiny.copyWith(
            color: AppColors.textSecondary,
            fontSize: 8,
          ),
        ),
        Text(
          value,
          style: AppTypography.extraTiny.copyWith(
            color: tone ?? AppColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 10,
          ),
        ),
      ],
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
                label: 'Disbursed',
                value: fmt.format(summary.totalDisbursed),
                sub: 'Total value',
                responsive: responsive,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatTile(
                icon: Icons.assignment_turned_in_outlined,
                iconColor: AppColors.warning,
                iconBg: AppColors.warningBg,
                label: 'Recovered',
                value: fmt.format(summary.totalCollectedAllTime),
                sub: 'All-time total',
                responsive: responsive,
              ),
            ),
          ],
        ),
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
              const Spacer(),
              Flexible(
                child: Text(
                  label,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
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
          Text(sub,
              style: AppTypography.caption,
              maxLines: responsive ? 2 : null,
              overflow: responsive ? TextOverflow.ellipsis : null),
        ],
      ),
    );
  }
}

class _AlertsRow extends StatelessWidget {
  const _AlertsRow({required this.summary, required this.t});
  final DashboardSummary summary;
  final T t;

  @override
  Widget build(BuildContext context) {
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
        const SizedBox(width: 12),
        Expanded(
          child: _AlertCard(
            label: t.x('dash.pending_penalties'),
            value: '${summary.pendingPenalties}',
            icon: Icons.gavel_rounded,
            bg: AppColors.warningBg,
            fg: AppColors.warning,
            onTap: () => context.go('/penalties'),
          ),
        ),
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
                      maxLines: 1,
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
    if (responsive && MediaQuery.sizeOf(context).width < 400) {
      return Column(
        children: [
          _ActionBtn(
            icon: Icons.payments_rounded,
            label: t.x('coll.title'),
            color: AppColors.primary,
            horizontal: true,
            onTap: () => context.go('/collection'),
          ),
          const SizedBox(height: 10),
          _ActionBtn(
            icon: Icons.person_add_alt_1_rounded,
            label: t.x('dash.new_customer'),
            color: AppColors.info,
            horizontal: true,
            onTap: () => context.go('/customers/new'),
          ),
          const SizedBox(height: 10),
          _ActionBtn(
            icon: Icons.add_card_rounded,
            label: t.x('dash.new_loan'),
            color: AppColors.success,
            horizontal: true,
            onTap: () => context.go('/loans/new'),
          ),
        ],
      );
    }
    return Row(
      children: [
        Expanded(
          child: _ActionBtn(
            icon: Icons.payments_rounded,
            label: t.x('coll.title'),
            color: AppColors.primary,
            onTap: () => context.go('/collection'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionBtn(
            icon: Icons.person_add_alt_1_rounded,
            label: t.x('dash.new_customer'),
            color: AppColors.info,
            onTap: () => context.go('/customers/new'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionBtn(
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

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.horizontal = false,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final bool horizontal;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTokens.radius),
            boxShadow: AppTokens.shadow,
          ),
          child: horizontal
              ? Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withAlpha(36),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, color: color, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(label, style: AppTypography.bodyLarge)),
                  const Icon(Icons.chevron_right_rounded,
                      color: AppColors.textLight),
                ])
              : Column(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: color.withAlpha(36),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, color: color, size: 22),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      label,
                      textAlign: TextAlign.center,
                      style: AppTypography.bodyLarge.copyWith(
                        color: AppColors.textPrimary,
                        height: 1.2,
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
  const _UpNextPager({required this.fmt, required this.t});
  final NumberFormat fmt;
  final T t;

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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Text(
                t.x('dash.up_next').toUpperCase(),
                style: AppTypography.tiny.copyWith(
                  color: AppColors.textSecondary,
                  letterSpacing: 1,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => context.go('/collection'),
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
          loading: () => const Skeleton(height: 156, borderRadius: 18),
          error: (e, _) => SizedBox(
            height: 130,
            child: EmptyState(
              icon: Icons.cloud_off,
              title: t.x('err.failed_to_load'),
            ),
          ),
          data: (rows) {
            // One card per loan. A customer can have separate active loans, and
            // collection must not merge those amounts on the dashboard.
            final pendingRows = rows
                .where((r) => !r.isResolved && r.outstanding > 0)
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
            final pending = byLoan.values.toList(growable: false);
            if (pending.isEmpty) {
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
                  height: 188,
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
          },
        ),
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

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _Avatar(
                name: row.customerName,
                size: 44,
                image:
                    row.customerPhoto != null && row.customerPhoto!.isNotEmpty
                        ? authedImage(ref, row.customerPhoto!)
                        : null,
              ),
              const SizedBox(width: 12),
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
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        const Icon(
                          Icons.access_time_rounded,
                          size: 12,
                          color: AppColors.textLight,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            [
                              time,
                              if (row.loanCode.isNotEmpty) row.loanCode,
                              if (route != null && route.isNotEmpty) route,
                              if (dueCount > 1) '$dueCount ${t.x('dash.dues')}',
                            ].join(' \u00b7 '),
                            style: AppTypography.caption,
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
                  Text(
                    statusLabel,
                    style: AppTypography.extraTiny.copyWith(
                      color: overdueDue > 0
                          ? AppColors.danger
                          : AppColors.textLight,
                      letterSpacing: 0,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    fmt.format(due),
                    style: AppTypography.heroNumber.copyWith(
                      fontSize: 22,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (todayDue > 0 || overdueDue > 0) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                if (todayDue > 0)
                  _DueChip(
                    icon: Icons.today_rounded,
                    label: 'Today scheduled',
                    value: fmt.format(todayDue),
                    color: AppColors.primary,
                  ),
                if (overdueDue > 0)
                  _DueChip(
                    icon: Icons.history_rounded,
                    label: 'Still overdue',
                    value: fmt.format(overdueDue),
                    color: AppColors.danger,
                  ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Material(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => _openCollect(context, ref),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.payments_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Collect now',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Material(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => _callCustomer(ref, row.customerId),
                  child: Container(
                    width: 46,
                    height: 46,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.phone_outlined,
                      size: 18,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _openCollect(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(row: row, scopeRows: scopeRows),
    ).then((_) => refreshCollectionViews(ref));
  }

  void _callCustomer(WidgetRef ref, String customerId) {
    final ctx = ref.context;
    if (ctx.mounted) ctx.push('/customers/$customerId');
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

enum _TodayTab { all, paid, pending, newLoans, newCustomers, other }

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
}

class _TodayActivitySection extends ConsumerStatefulWidget {
  const _TodayActivitySection({
    required this.summary,
    required this.fmt,
    required this.t,
  });

  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  ConsumerState<_TodayActivitySection> createState() =>
      _TodayActivitySectionState();
}

class _TodayActivitySectionState extends ConsumerState<_TodayActivitySection> {
  _TodayTab _activeTab = _TodayTab.all;
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

  Future<void> _makeCall(String? phone) async {
    if (phone == null || phone.trim().isEmpty) return;
    final clean = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    final uri = Uri.parse('tel:$clean');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final fmt = widget.fmt;
    final bundle = widget.summary.todaysActivity;

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
        case _TodayTab.all:
          break;
        case _TodayTab.paid:
          if (item.kind != 'paid') return false;
        case _TodayTab.pending:
          if (item.kind != 'pending') return false;
        case _TodayTab.newLoans:
          if (item.kind != 'new_loan') return false;
        case _TodayTab.newCustomers:
          if (item.kind != 'new_customer') return false;
        case _TodayTab.other:
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
                child: const Icon(Icons.today_rounded,
                    color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t.x('dash.today_activity'),
                      style: AppTypography.sectionTitle,
                    ),
                    Text(
                      DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
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
                prefixIcon: const Icon(Icons.search,
                    size: 20, color: AppColors.textLight),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear,
                            size: 18, color: AppColors.textLight),
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
                  subtitle: '${bundle.paidItems.length} customers',
                  isSelected: _activeTab == _TodayTab.paid,
                  onTap: () => setState(() => _activeTab = _TodayTab.paid),
                ),
                const SizedBox(width: 10),
                _buildKpiCard(
                  icon: Icons.hourglass_top_rounded,
                  iconBg: const Color(0xFFFEF3C7),
                  iconColor: const Color(0xFFD97706),
                  title: t.x('dash.pending_today'),
                  value: fmt.format(totalPendingAmount),
                  subtitle: '${bundle.pendingItems.length} customers',
                  isSelected: _activeTab == _TodayTab.pending,
                  onTap: () => setState(() => _activeTab = _TodayTab.pending),
                ),
                const SizedBox(width: 10),
                _buildKpiCard(
                  icon: Icons.request_quote_outlined,
                  iconBg: const Color(0xFFDBEAFE),
                  iconColor: const Color(0xFF2563EB),
                  title: t.x('dash.new_loans'),
                  value: fmt.format(totalDisbursedAmount),
                  subtitle: '${bundle.newLoanItems.length} loans',
                  isSelected: _activeTab == _TodayTab.newLoans,
                  onTap: () => setState(() => _activeTab = _TodayTab.newLoans),
                ),
                const SizedBox(width: 10),
                _buildKpiCard(
                  icon: Icons.person_add_alt_1_outlined,
                  iconBg: const Color(0xFFF3E8FF),
                  iconColor: const Color(0xFF9333EA),
                  title: t.x('dash.new_customers'),
                  value: '${bundle.newCustomerItems.length}',
                  subtitle: 'registered today',
                  isSelected: _activeTab == _TodayTab.newCustomers,
                  onTap: () =>
                      setState(() => _activeTab = _TodayTab.newCustomers),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Filter Tabs Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildTabPill(_TodayTab.all,
                    '${t.x('dash.all_activity')} (${allItems.length})'),
                const SizedBox(width: 8),
                _buildTabPill(_TodayTab.paid,
                    '${t.x('dash.paid_today')} (${bundle.paidItems.length})'),
                const SizedBox(width: 8),
                _buildTabPill(_TodayTab.pending,
                    '${t.x('dash.pending_today')} (${bundle.pendingItems.length})'),
                const SizedBox(width: 8),
                _buildTabPill(_TodayTab.newLoans,
                    '${t.x('dash.new_loans')} (${bundle.newLoanItems.length})'),
                const SizedBox(width: 8),
                _buildTabPill(_TodayTab.newCustomers,
                    '${t.x('dash.new_customers')} (${bundle.newCustomerItems.length})'),
                const SizedBox(width: 8),
                _buildTabPill(_TodayTab.other,
                    '${t.x('dash.other_activity')} (${bundle.otherItems.length})'),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Items List or Empty State
          if (filtered.isEmpty)
            SizedBox(
              height: 120,
              child: EmptyState(
                icon: Icons.event_available_outlined,
                title: _searchQuery.isNotEmpty
                    ? t.x('dash.no_filtered_activity')
                    : t.x('dash.no_today_activity'),
              ),
            )
          else
            Column(
              children: [
                for (final item in filtered) ...[
                  _buildActivityItemCard(item, fmt, t),
                  const SizedBox(height: 10),
                ],
              ],
            ),
        ],
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

  Widget _buildTabPill(_TodayTab tab, String label) {
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

  Widget _buildActivityItemCard(
    _UnifiedActivityItem item,
    NumberFormat fmt,
    T t,
  ) {
    if (item.paid != null) {
      final p = item.paid!;
      return _buildCardWrapper(
        onTap: p.customerId.isNotEmpty
            ? () => context.push('/customers/${p.customerId}')
            : null,
        badgeLabel: 'PAID · ${p.paymentMode.toUpperCase()}',
        badgeBg: const Color(0xFFD1FAE5),
        badgeColor: const Color(0xFF065F46),
        time: DateFormat('h:mm a').format(p.submittedAt),
        name: p.customerName,
        code: p.customerCode,
        routeName: p.routeName,
        metaLine:
            'Loan: ${p.loanCode}${p.agentName != null ? ' · By: ${p.agentName}' : ''}',
        amountText: '+${fmt.format(p.receivedAmount)}',
        amountColor: AppColors.success,
        phone: p.customerPhone,
        actions: [
          if (p.customerPhone != null && p.customerPhone!.trim().isNotEmpty)
            _buildCallButton(p.customerPhone!, t),
          const SizedBox(width: 8),
          if (p.customerId.isNotEmpty)
            _buildViewButton(
                () => context.push('/customers/${p.customerId}'), t),
        ],
      );
    }

    if (item.pending != null) {
      final p = item.pending!;
      final isMissed = p.status == 'missed';
      final isPartial = p.status == 'partial';
      final statusLabel =
          isMissed ? 'MISSED' : (isPartial ? 'PARTIAL' : 'PENDING');
      final badgeBg =
          isMissed ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7);
      final badgeColor =
          isMissed ? const Color(0xFF991B1B) : const Color(0xFF92400E);

      return _buildCardWrapper(
        onTap: p.customerId.isNotEmpty
            ? () => context.push('/customers/${p.customerId}')
            : null,
        badgeLabel: statusLabel,
        badgeBg: badgeBg,
        badgeColor: badgeColor,
        time: DateFormat('h:mm a').format(p.dueDate),
        name: p.customerName,
        code: p.customerCode,
        routeName: p.routeName,
        metaLine:
            'Loan: ${p.loanCode}${p.perInstalment > 0 ? ' · Per inst: ${fmt.format(p.perInstalment)}' : ''}',
        amountText: fmt.format(p.remainingAmount),
        amountColor: isMissed ? AppColors.danger : AppColors.warning,
        phone: p.customerPhone,
        actions: [
          if (p.customerPhone != null && p.customerPhone!.trim().isNotEmpty)
            _buildCallButton(p.customerPhone!, t),
          const SizedBox(width: 8),
          _buildActionButton(
            label: t.x('dash.collect_now'),
            icon: Icons.payments_outlined,
            color: AppColors.primary,
            onTap: () {
              if (p.customerId.isNotEmpty) {
                context.push(
                    '/collection?customerId=${p.customerId}&loanId=${p.loanId}');
              }
            },
          ),
        ],
      );
    }

    if (item.newLoan != null) {
      final l = item.newLoan!;
      return _buildCardWrapper(
        onTap: l.customerId.isNotEmpty
            ? () => context.push('/customers/${l.customerId}')
            : null,
        badgeLabel: 'NEW LOAN',
        badgeBg: const Color(0xFFDBEAFE),
        badgeColor: const Color(0xFF1E40AF),
        time: DateFormat('h:mm a').format(l.createdAt),
        name: l.customerName,
        code: l.customerCode,
        routeName: l.routeName,
        metaLine:
            'Loan: ${l.loanCode} · ${l.frequency.toUpperCase()}${l.createdByName != null ? ' · By: ${l.createdByName}' : ''}',
        amountText: fmt.format(l.principal),
        amountColor: AppColors.primary,
        phone: l.customerPhone,
        actions: [
          if (l.customerPhone != null && l.customerPhone!.trim().isNotEmpty)
            _buildCallButton(l.customerPhone!, t),
          const SizedBox(width: 8),
          if (l.customerId.isNotEmpty)
            _buildViewButton(
                () => context.push('/customers/${l.customerId}'), t),
        ],
      );
    }

    if (item.newCustomer != null) {
      final c = item.newCustomer!;
      return _buildCardWrapper(
        onTap:
            c.id.isNotEmpty ? () => context.push('/customers/${c.id}') : null,
        badgeLabel: 'NEW CUSTOMER',
        badgeBg: const Color(0xFFF3E8FF),
        badgeColor: const Color(0xFF6B21A8),
        time: DateFormat('h:mm a').format(c.createdAt),
        name: c.name,
        code: c.customerCode,
        routeName: c.routeName,
        metaLine: c.phone ?? 'Registered today',
        amountText: '',
        amountColor: AppColors.textPrimary,
        phone: c.phone,
        actions: [
          if (c.phone != null && c.phone!.trim().isNotEmpty)
            _buildCallButton(c.phone!, t),
          const SizedBox(width: 8),
          if (c.id.isNotEmpty)
            _buildViewButton(() => context.push('/customers/${c.id}'), t),
        ],
      );
    }

    if (item.other != null) {
      final o = item.other!;
      return _buildCardWrapper(
        onTap: null,
        badgeLabel: o.type.replaceAll('_', ' ').toUpperCase(),
        badgeBg: const Color(0xFFF1F5F9),
        badgeColor: const Color(0xFF475569),
        time: DateFormat('h:mm a').format(o.timestamp),
        name: o.title,
        code: o.customerCode ?? '',
        routeName: null,
        metaLine: o.description,
        amountText: o.amount != null ? fmt.format(o.amount!) : '',
        amountColor: AppColors.textPrimary,
        phone: null,
        actions: const [],
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildCardWrapper({
    required VoidCallback? onTap,
    required String badgeLabel,
    required Color badgeBg,
    required Color badgeColor,
    required String time,
    required String name,
    required String code,
    required String? routeName,
    required String metaLine,
    required String amountText,
    required Color amountColor,
    required String? phone,
    required List<Widget> actions,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Badge and time
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: badgeBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        badgeLabel,
                        style: AppTypography.extraTiny.copyWith(
                          fontWeight: FontWeight.w800,
                          color: badgeColor,
                          fontSize: 10,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      time,
                      style: AppTypography.extraTiny.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Middle row: Avatar, Info & Amount
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Avatar(name: name, size: 38),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: AppTypography.bodyLarge
                                .copyWith(fontWeight: FontWeight.w700),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              if (code.isNotEmpty)
                                Text(
                                  code,
                                  style: AppTypography.extraTiny
                                      .copyWith(color: AppColors.textSecondary),
                                ),
                              if (code.isNotEmpty &&
                                  routeName != null &&
                                  routeName.isNotEmpty)
                                Text(
                                  ' · ',
                                  style: AppTypography.extraTiny
                                      .copyWith(color: AppColors.textLight),
                                ),
                              if (routeName != null && routeName.isNotEmpty)
                                Flexible(
                                  child: Text(
                                    routeName,
                                    style: AppTypography.extraTiny.copyWith(
                                        color: AppColors.textSecondary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            metaLine,
                            style: AppTypography.caption.copyWith(
                                color: AppColors.textLight, fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (amountText.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Text(
                        amountText,
                        style: AppTypography.bodyLarge.copyWith(
                          fontWeight: FontWeight.w800,
                          color: amountColor,
                        ),
                      ),
                    ],
                  ],
                ),

                // Bottom row: Quick action buttons
                if (actions.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  const Divider(
                      height: 1, thickness: 0.8, color: AppColors.border),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: actions,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCallButton(String phone, T t) {
    return InkWell(
      onTap: () => _makeCall(phone),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFFD1FAE5),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFA7F3D0)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.phone_in_talk, size: 13, color: Color(0xFF065F46)),
            const SizedBox(width: 4),
            Text(
              t.x('dash.call_customer'),
              style: AppTypography.extraTiny.copyWith(
                fontWeight: FontWeight.w700,
                color: const Color(0xFF065F46),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildViewButton(VoidCallback onTap, T t) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.arrow_forward_rounded,
                size: 13, color: AppColors.textSecondary),
            const SizedBox(width: 4),
            Text(
              t.x('dash.view_details'),
              style: AppTypography.extraTiny.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withAlpha(24),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withAlpha(48)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: AppTypography.extraTiny.copyWith(
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
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
  const _AgentMetricsRow(
      {required this.summary, required this.fmt, required this.t});
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
  const _DefaulterAlerts(
      {required this.summary, required this.fmt, required this.t});
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
  const _RoutePerformanceList(
      {required this.summary, required this.fmt, required this.t});
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
                    child: Icon(Icons.route,
                        color: AppColors.primaryDark, size: 20),
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
                  if (isAdmin) ...[
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: rp.agentId == null
                          ? null
                          : () {
                              showModalBottomSheet<bool>(
                                context: context,
                                isScrollControlled: true,
                                builder: (_) => CollectCashSheet(
                                  routeId: rp.id,
                                  routeName: rp.name,
                                  agentId: rp.agentId!,
                                  fmt: fmt,
                                ),
                              ).then((success) {
                                if (success == true) {
                                  ref.refresh(dashboardSummaryProvider.future);
                                }
                              });
                            },
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.success,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                      child: const Text('Collect'),
                    ),
                  ],
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
                  const Icon(Icons.trending_up_rounded,
                      color: Colors.white, size: 20),
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
                      Text(fmt.format(entry.value),
                          style: AppTypography.caption),
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
                      ref.refresh(dashboardSummaryProvider.future);
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
                        ref.refresh(dashboardSummaryProvider.future);
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
      ],
    );
  }
}
