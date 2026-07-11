import 'package:loantrack/core/network/authed_image.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/models/dashboard_summary.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/repositories/dashboard_repository.dart';
import 'package:loantrack/features/collection/collection_screen.dart'
    show collectionTodayProvider, refreshCollectionViews;
import 'package:loantrack/features/collection/quick_collect_sheet.dart';
import 'package:loantrack/features/dashboard/widgets/chit_dashboard_body.dart';
import 'package:loantrack/features/dashboard/widgets/collection_trend_card.dart';
import 'package:loantrack/features/onboarding/onboarding_overlay.dart';
import 'package:loantrack/features/onboarding/location_permission_overlay.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';
import 'package:loantrack/features/dashboard/widgets/collect_cash_sheet.dart';
import 'package:loantrack/features/dashboard/widgets/verify_upi_sheet.dart';

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
    final chitSummary =
        isChit ? ref.watch(chitDashboardSummaryProvider) : null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('dash.title')),
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
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final String userName;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAgent =
        ref.read(authControllerProvider).user?.role == UserRole.agent;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        _GreetingRow(name: userName, t: t),
        const SizedBox(height: 14),
        _CollectionPager(summary: summary, fmt: fmt, t: t),
        const SizedBox(height: 14),
        if (isAgent)
          _AgentMetricsRow(summary: summary, fmt: fmt, t: t)
        else
          _MoneyFlowRow(summary: summary, fmt: fmt, t: t),
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
          const CollectionTrendCard(),
          const SizedBox(height: 18),
        ],
        _QuickActions(t: t),
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
        const SizedBox(height: 18),
        _ActivitySection(summary: summary, t: t),
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

/// Swipeable pager holding the two collection cards: Today's Collection and
/// Overdue Collection (mirrors the web dashboard). Swipe horizontally; dots
/// below indicate the active card.
class _CollectionPager extends StatefulWidget {
  const _CollectionPager({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  State<_CollectionPager> createState() => _CollectionPagerState();
}

/// Continuous red → amber → green accent for collection progress: 0% fully
/// red, 50% amber (mid), 100% fully green — replaces the old 3-step bands.
Color _progressColor(double pct) {
  const red = Color(0xFFFF8674);
  const amber = Color(0xFFFBBF24);
  const green = Color(0xFF34D399);
  final p = pct.clamp(0.0, 1.0);
  return p < 0.5
      ? Color.lerp(red, amber, p * 2)!
      : Color.lerp(amber, green, (p - 0.5) * 2)!;
}

class _CollectionPagerState extends State<_CollectionPager> {
  final _ctrl = PageController();
  int _idx = 0;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cards = [
      _HeroBalance(summary: widget.summary, fmt: widget.fmt, t: widget.t),
      _OverdueBalance(summary: widget.summary, fmt: widget.fmt, t: widget.t),
    ];
    // Tight fit to the hero card's actual content height — the old 380 left
    // a dead band under the card inside the PageView. Text is the only thing
    // that grows, so scale the height with the effective text scale (which
    // the app clamps to 0.8–1.6) instead of hard-coding headroom for it.
    final textScale = MediaQuery.textScalerOf(context).scale(1.0);
    final pagerHeight = 342 * (1 + (textScale - 1) * 0.75);
    return Column(
      children: [
        SizedBox(
          height: pagerHeight,
          child: PageView(
            controller: _ctrl,
            onPageChanged: (i) => setState(() => _idx = i),
            children: [
              for (final card in cards)
                Align(alignment: Alignment.topCenter, child: card),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < cards.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: _idx == i ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _idx == i ? AppColors.primary : AppColors.border,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _HeroBalance extends ConsumerWidget {
  const _HeroBalance({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Actual cash submitted today, regardless of whether it cleared today's
    // scheduled dues or older overdue rows.
    final collected = summary.cashCollectedToday;
    final expected = summary.todayExpected;
    final remaining = (expected - collected).clamp(0.0, double.infinity);
    final pct = expected <= 0 ? 0.0 : (collected / expected).clamp(0.0, 1.0);
    final paid =
        summary.todayInstalments.where((i) => i.status == 'paid').length;
    final pending = summary.todayInstalments
        .where((i) => i.status == 'upcoming' || i.status == 'partial')
        .length;
    final overdue = summary.todayInstalments
        .where((i) => i.status == 'missed' || i.status == 'overdue')
        .length;
    final pctInt = (pct * 100).round();

    final barColor = _progressColor(pct);

    return GestureDetector(
      onTap: () => ref.speak(
        '${t.x('dash.today_collected')} ${_speakAmount(collected)}',
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1F2937), Color(0xFF111827)],
          ),
          boxShadow: AppTokens.shadowLg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(48),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.bolt_rounded,
                          color: AppColors.primary, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        t.x('dash.live'),
                        style: AppTypography.tiny
                            .copyWith(color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  'Today scheduled',
                  style:
                      AppTypography.heroLabel.copyWith(color: Colors.white70),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Amount + percentage badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      fmt.format(collected),
                      style: AppTypography.heroNumber
                          .copyWith(color: Colors.white),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: barColor.withAlpha(36),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: barColor.withAlpha(80), width: 1),
                  ),
                  child: Text(
                    '$pctInt%',
                    style: AppTypography.tiny.copyWith(
                      color: barColor,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Progress bar
            _CollectionBar(pct: pct, color: barColor),
            const SizedBox(height: 14),
            // ── Prominent money breakdown: Collected / Collectable / Remaining ──
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(10),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _MoneyStatLarge(
                      label: 'Collected today',
                      value: fmt.format(collected),
                      tone: const Color(0xFF34D399),
                    ),
                  ),
                  Container(
                      width: 1, height: 36, color: Colors.white.withAlpha(20)),
                  Expanded(
                    child: _MoneyStatLarge(
                      label: 'Today scheduled',
                      value: fmt.format(expected),
                      tone: Colors.white,
                    ),
                  ),
                  Container(
                      width: 1, height: 36, color: Colors.white.withAlpha(20)),
                  Expanded(
                    child: _MoneyStatLarge(
                      label: 'Today outstanding',
                      value: fmt.format(remaining),
                      tone: const Color(0xFFFF8674),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Container(height: 1, color: Colors.white.withAlpha(20)),
            const SizedBox(height: 10),
            // ── Secondary count stats: Paid / Pending / Overdue ──
            Row(
              children: [
                Expanded(
                    child: _HeroStat(n: paid, label: t.x('coll.filter_paid'))),
                Container(
                    width: 1, height: 28, color: Colors.white.withAlpha(20)),
                Expanded(
                    child: _HeroStat(
                        n: pending, label: t.x('coll.filter_pending'))),
                Container(
                    width: 1, height: 28, color: Colors.white.withAlpha(20)),
                Expanded(
                  child: _HeroStat(
                    n: overdue,
                    label: t.x('coll.filter_overdue'),
                    tone: const Color(0xFFFF8674),
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

/// Second pager card — Overdue Collection. Daily snapshot: Total overdue (start
/// of today), Collected today (past-due recovery), Remaining. Re-bases each day.
class _OverdueBalance extends ConsumerWidget {
  const _OverdueBalance({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final total = summary.overdueTotalTillToday;
    final collected = summary.overdueCollectedToday;
    final remaining = summary.overdueOutstanding;
    final pct = total <= 0 ? 0.0 : (collected / total).clamp(0.0, 1.0);
    final pctInt = (pct * 100).round();

    final barColor = _progressColor(pct);
    // Whole-card colour tracks recovery: fully red when nothing of the
    // overdue backlog is collected, blending to fully green when cleared.
    final cardTop = Color.lerp(
      const Color(0xFFB91C1C),
      const Color(0xFF15803D),
      pct,
    )!;
    final cardBottom = Color.lerp(
      const Color(0xFF7F1D1D),
      const Color(0xFF14532D),
      pct,
    )!;

    return GestureDetector(
      onTap: () => ref.speak(
        'Recovered overdue today ${_speakAmount(collected)}',
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [cardTop, cardBottom],
          ),
          boxShadow: AppTokens.shadowLg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(36),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.history_rounded,
                          color: Colors.white, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        'Recovered overdue today',
                        style: AppTypography.tiny.copyWith(color: Colors.white),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  'Still overdue',
                  style:
                      AppTypography.heroLabel.copyWith(color: Colors.white70),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Daily overdue recovery',
              style: AppTypography.extraTiny.copyWith(color: Colors.white54),
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      fmt.format(total),
                      style: AppTypography.heroNumber
                          .copyWith(color: Colors.white),
                    ),
                  ),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: barColor.withAlpha(36),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: barColor.withAlpha(80), width: 1),
                  ),
                  child: Text(
                    '$pctInt%',
                    style: AppTypography.tiny.copyWith(
                      color: barColor,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _CollectionBar(pct: pct, color: barColor),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.check_circle_outline,
                    size: 12, color: Colors.white38),
                const SizedBox(width: 4),
                Text(
                  '${fmt.format(collected)} recovered overdue today',
                  style: AppTypography.tiny.copyWith(color: Colors.white54),
                ),
                const Spacer(),
                const Icon(Icons.flag_outlined,
                    size: 12, color: Colors.white38),
                const SizedBox(width: 4),
                Text(
                  fmt.format(total),
                  style: AppTypography.tiny.copyWith(color: Colors.white54),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(height: 1, color: Colors.white.withAlpha(20)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                    child: _MoneyStat(
                        label: 'Recovered overdue today',
                        value: fmt.format(collected),
                        tone: const Color(0xFF34D399))),
                Container(
                    width: 1, height: 28, color: Colors.white.withAlpha(20)),
                Expanded(
                    child: _MoneyStat(
                        label: 'Still overdue',
                        value: fmt.format(remaining),
                        tone: const Color(0xFFFF8674))),
                Container(
                    width: 1, height: 28, color: Colors.white.withAlpha(20)),
                Expanded(
                    child: _MoneyStat(
                        label: t.x('dash.overdue_loans'),
                        value: '${summary.overdueLoans}')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact money/value stat used in the overdue card footer (white-on-dark).
class _MoneyStat extends StatelessWidget {
  const _MoneyStat({required this.label, required this.value, this.tone});
  final String label;
  final String value;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            value,
            style: AppTypography.bodyLarge.copyWith(
              color: tone ?? Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 15,
            ),
            maxLines: 1,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: AppTypography.tiny.copyWith(color: Colors.white54),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

/// Larger money stat used in the Today's Collection hero card for prominent
/// Collected / Collectable / Remaining breakdown.
class _MoneyStatLarge extends StatelessWidget {
  const _MoneyStatLarge({required this.label, required this.value, this.tone});
  final String label;
  final String value;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            value,
            style: AppTypography.bodyLarge.copyWith(
              color: tone ?? Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 17,
            ),
            maxLines: 1,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: AppTypography.tiny.copyWith(
            color: Colors.white60,
            fontWeight: FontWeight.w500,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.n, required this.label, this.tone});
  final int n;
  final String label;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$n',
          style: AppTypography.heroNumber.copyWith(
            color: tone ?? Colors.white,
            fontSize: 22,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: AppTypography.tiny.copyWith(color: Colors.white54),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
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
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

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
  });
  final IconData icon;
  final Color iconColor, iconBg;
  final String label, value, sub;

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
          Text(
            value,
            style: AppTypography.heroNumber.copyWith(
              fontSize: 22,
              color: AppColors.textPrimary,
            ),
          ),
          Text(sub, style: AppTypography.caption),
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
  const _QuickActions({required this.t});
  final T t;

  @override
  Widget build(BuildContext context) {
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
            onTap: () => context.go('/loans'),
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
  });
  final IconData icon;
  final String label;
  final Color color;
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
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTokens.radius),
            boxShadow: AppTokens.shadow,
          ),
          child: Column(
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

class _ActivitySection extends StatelessWidget {
  const _ActivitySection({required this.summary, required this.t});
  final DashboardSummary summary;
  final T t;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: t.x('dash.recent_activity'),
      child: summary.recentActivity.isEmpty
          ? SizedBox(
              height: 100,
              child: EmptyState(
                icon: Icons.history,
                title: t.x('dash.no_activity'),
              ),
            )
          : Column(
              children: [
                for (final a in summary.recentActivity)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        _Avatar(name: a.userName, size: 36),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                a.userName,
                                style: AppTypography.bodyLarge,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                '${a.action} ${a.resource}',
                                style: AppTypography.caption,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        Text(
                          _relTime(a.createdAt, t),
                          style: AppTypography.extraTiny,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

String _relTime(DateTime dt, T t) {
  final d = DateTime.now().difference(dt);
  if (d.inMinutes < 1) return t.x('common.now');
  if (d.inHours < 1) return '${d.inMinutes}m';
  if (d.inDays < 1) return '${d.inHours}h';
  if (d.inDays < 7) return '${d.inDays}d';
  return DateFormat('d MMM').format(dt);
}

/// Today's Activity — every collection recorded today, newest first, with the
/// time, customer collected from, the agent who collected, and the amount. Lets
/// the user see "what was done today" without leaving the dashboard.
class _TodayActivitySection extends ConsumerWidget {
  const _TodayActivitySection({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = summary.todayActivity;
    final total = items.fold<double>(0, (s, a) => s + a.amount);
    return _Section(
      title:
          '${t.x('dash.today_activity')}${items.isEmpty ? '' : '  ·  ${fmt.format(total)}'}',
      child: items.isEmpty
          ? SizedBox(
              height: 100,
              child: EmptyState(
                icon: Icons.event_available_outlined,
                title: t.x('dash.no_today_activity'),
              ),
            )
          : Column(
              children: [
                for (final a in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      onTap: a.customerId.isEmpty
                          ? null
                          : () => context.push('/customers/${a.customerId}'),
                      borderRadius: BorderRadius.circular(8),
                      child: Row(
                        children: [
                          // Time column
                          SizedBox(
                            width: 58,
                            child: Text(
                              DateFormat('h:mm a').format(a.submittedAt),
                              style: AppTypography.caption.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          _Avatar(
                            name: a.customerName,
                            size: 34,
                            image: a.customerPhoto != null &&
                                    a.customerPhoto!.isNotEmpty
                                ? authedImage(ref, a.customerPhoto!)
                                : null,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  a.customerName,
                                  style: AppTypography.bodyLarge,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '${a.loanCode} · ${a.agentName} · ${a.paymentMode.toUpperCase()}'
                                  '${a.count > 1 ? ' · ${a.count} inst.' : ''}',
                                  style: AppTypography.caption,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            fmt.format(a.amount),
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: FontWeight.w800,
                              color: AppColors.success,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
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

String _speakAmount(double amount) {
  if (amount <= 0) return 'zero rupees';
  final rounded = amount.round();
  if (rounded >= 10000000) {
    final cr = (amount / 10000000).toStringAsFixed(2);
    return '$cr crore rupees';
  }
  if (rounded >= 100000) {
    final l = (amount / 100000).toStringAsFixed(2);
    return '$l lakh rupees';
  }
  if (rounded >= 1000) {
    final k = (amount / 1000).toStringAsFixed(1);
    return '$k thousand rupees';
  }
  return '$rounded rupees';
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
