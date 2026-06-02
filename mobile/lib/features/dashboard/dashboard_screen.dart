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
import 'package:loantrack/data/services/collection_service.dart';
import 'package:loantrack/features/collection/quick_collect_sheet.dart';
import 'package:loantrack/features/dashboard/widgets/collection_trend_card.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _collectionTodayProvider =
    FutureProvider.autoDispose<List<CollectionRow>>((ref) {
  return ref.watch(collectionServiceProvider).today();
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final summary = ref.watch(dashboardSummaryProvider);
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('dash.title')),
        centerTitle: true,
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          const SizedBox(width: 4),
        ],
      ),
      drawer: _SideDrawer(userName: user?.name ?? '—'),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async => ref.refresh(dashboardSummaryProvider.future),
        child: summary.when(
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
    final isAgent = ref.read(authControllerProvider).user?.role == UserRole.agent;

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
          _MoneyFlowRow(summary: summary, t: t),
        const SizedBox(height: 14),
        _AlertsRow(summary: summary, t: t),
        const SizedBox(height: 18),
        if (!isAgent) ...[
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
                '${t.x('dash.hello')}, ${name.isEmpty ? '—' : name.split(' ').first}',
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
    return Column(
      children: [
        SizedBox(
          height: 304,
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
    // Headline the actual cash taken today (all instalments), not just the
    // portion that landed on today's scheduled dues.
    final collected = summary.cashCollectedToday;
    final expected = summary.todayExpected;
    final pct = expected <= 0 ? 0.0 : (collected / expected).clamp(0.0, 1.0);
    final paid = summary.todayInstalments.where((i) => i.status == 'paid').length;
    final pending = summary.todayInstalments
        .where((i) => i.status == 'upcoming' || i.status == 'partial')
        .length;
    final overdue = summary.todayInstalments
        .where((i) => i.status == 'missed' || i.status == 'overdue')
        .length;
    final pctInt = (pct * 100).round();

    // Color shifts: red → orange → green as collection improves
    final barColor = pct >= 0.75
        ? const Color(0xFF34D399)
        : pct >= 0.4
            ? const Color(0xFFFBBF24)
            : const Color(0xFFFF8674);

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
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(48),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.bolt_rounded, color: AppColors.primary, size: 14),
                      const SizedBox(width: 4),
                      Text(t.x('dash.live'),
                          style: AppTypography.tiny.copyWith(color: AppColors.primary),),
                    ],
                  ),
                ),
                const Spacer(),
                Text(t.x('dash.today_collected'),
                    style: AppTypography.heroLabel.copyWith(color: Colors.white70),),
              ],
            ),
            const SizedBox(height: 16),
            // Amount + percentage badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  fmt.format(collected),
                  style: AppTypography.heroNumber.copyWith(color: Colors.white),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Progress bar
            _CollectionBar(pct: pct, color: barColor),
            const SizedBox(height: 8),
            // Collected / Expected labels
            Row(
              children: [
                const Icon(Icons.check_circle_outline, size: 12, color: Colors.white38),
                const SizedBox(width: 4),
                Text(
                  fmt.format(collected),
                  style: AppTypography.tiny.copyWith(color: Colors.white54),
                ),
                const Spacer(),
                const Icon(Icons.flag_outlined, size: 12, color: Colors.white38),
                const SizedBox(width: 4),
                Text(
                  fmt.format(expected),
                  style: AppTypography.tiny.copyWith(color: Colors.white54),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(height: 1, color: Colors.white.withAlpha(20)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _HeroStat(n: paid, label: t.x('coll.filter_paid'))),
                Container(width: 1, height: 28, color: Colors.white.withAlpha(20)),
                Expanded(child: _HeroStat(n: pending, label: t.x('coll.filter_pending'))),
                Container(width: 1, height: 28, color: Colors.white.withAlpha(20)),
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

    final barColor = pct >= 0.75
        ? const Color(0xFF34D399)
        : pct >= 0.4
            ? const Color(0xFFFBBF24)
            : const Color(0xFFFF8674);

    return GestureDetector(
      onTap: () => ref.speak(
        '${t.x('dash.overdue_collection')} ${_speakAmount(collected)}',
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFB91C1C), Color(0xFF7F1D1D)],
          ),
          boxShadow: AppTokens.shadowLg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(36),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.history_rounded, color: Colors.white, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        t.x('dash.overdue_collection'),
                        style: AppTypography.tiny.copyWith(color: Colors.white),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  t.x('dash.total_overdue'),
                  style: AppTypography.heroLabel.copyWith(color: Colors.white70),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              t.x('dash.overdue_hint'),
              style: AppTypography.extraTiny.copyWith(color: Colors.white54),
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  fmt.format(total),
                  style: AppTypography.heroNumber.copyWith(color: Colors.white),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                      letterSpacing: 0.4,
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
                const Icon(Icons.check_circle_outline, size: 12, color: Colors.white38),
                const SizedBox(width: 4),
                Text(
                  '${fmt.format(collected)} ${t.x('dash.collected_today_suffix')}',
                  style: AppTypography.tiny.copyWith(color: Colors.white54),
                ),
                const Spacer(),
                const Icon(Icons.flag_outlined, size: 12, color: Colors.white38),
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
                Expanded(child: _MoneyStat(label: t.x('dash.collected_today'), value: fmt.format(collected), tone: const Color(0xFF34D399))),
                Container(width: 1, height: 28, color: Colors.white.withAlpha(20)),
                Expanded(child: _MoneyStat(label: t.x('dash.remaining'), value: fmt.format(remaining), tone: const Color(0xFFFF8674))),
                Container(width: 1, height: 28, color: Colors.white.withAlpha(20)),
                Expanded(child: _MoneyStat(label: t.x('dash.overdue_loans'), value: '${summary.overdueLoans}')),
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
        Text(
          value,
          style: AppTypography.bodyLarge.copyWith(
            color: tone ?? Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 15,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
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
  const _MoneyFlowRow({required this.summary, required this.t});
  final DashboardSummary summary;
  final T t;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatTile(
            icon: Icons.account_balance_wallet_rounded,
            iconColor: AppColors.success,
            iconBg: AppColors.successBg,
            label: t.x('dash.active_loans'),
            value: '${summary.activeLoans}',
            sub: '${summary.totalCustomers} ${t.x('dash.customers_suffix')}',
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
    final async = ref.watch(_collectionTodayProvider);

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
                  '${t.x('common.see_all')} →',
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
            final pending = rows
                .where((r) => r.status != 'paid')
                .toList(growable: false);
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
                          Text(t.x('dash.all_done_title'),
                              style: AppTypography.bodyLarge,),
                          const SizedBox(height: 2),
                          Text(t.x('dash.all_done_sub'),
                              style: AppTypography.caption,),
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
                  height: 156,
                  child: PageView.builder(
                    controller: _ctrl,
                    itemCount: pending.length,
                    onPageChanged: (i) => setState(() => _idx = i),
                    itemBuilder: (_, i) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: _UpNextCard(row: pending[i], fmt: widget.fmt),
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

class _UpNextCard extends ConsumerWidget {
  const _UpNextCard({required this.row, required this.fmt});
  final CollectionRow row;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final time = TimeOfDay.fromDateTime(row.dueDate).format(context);
    final route = row.routeName;
    final due = row.outstanding > 0 ? row.outstanding : row.dueAmount;

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
              _Avatar(name: row.customerName, size: 44),
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
                            [time, if (route != null && route.isNotEmpty) route]
                                .join(' · '),
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
                    t.x('coll.status_due_today').toUpperCase(),
                    style: AppTypography.extraTiny.copyWith(
                      color: AppColors.textLight,
                      letterSpacing: 0.5,
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
      builder: (_) => QuickCollectSheet(row: row),
    ).then((_) {
      ref.invalidate(_collectionTodayProvider);
      ref.invalidate(dashboardSummaryProvider);
    });
  }

  void _callCustomer(WidgetRef ref, String customerId) {
    final ctx = ref.context;
    if (ctx.mounted) ctx.push('/customers/$customerId');
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
  const _Avatar({required this.name, this.size = 40});
  final String name;
  final double size;

  Color _color() {
    const palette = [
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
    return parts
        .take(2)
        .map((p) => p.isEmpty ? '' : p[0].toUpperCase())
        .join();
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
      ),
      alignment: Alignment.center,
      child: Text(
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
  const _AgentMetricsRow({required this.summary, required this.fmt, required this.t});
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

class _DefaulterAlerts extends StatelessWidget {
  const _DefaulterAlerts({required this.summary, required this.fmt, required this.t});
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
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
                  _Avatar(name: alert.customerName, size: 36),
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
                        style: AppTypography.label.copyWith(color: AppColors.danger),
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

class _RoutePerformanceList extends StatelessWidget {
  const _RoutePerformanceList({required this.summary, required this.fmt, required this.t});
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
    if (summary.routePerformance.isEmpty) return const SizedBox.shrink();

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
                    child: const Icon(Icons.route, color: AppColors.primaryDark, size: 20),
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
                        style: AppTypography.label.copyWith(color: AppColors.danger),
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

class _SideDrawer extends ConsumerWidget {
  const _SideDrawer({required this.userName});
  final String userName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final user = ref.watch(authControllerProvider).user;

    final privileged = user?.role == UserRole.admin ||
        user?.role == UserRole.superadmin ||
        user?.role == UserRole.developer;

    bool can(String? moduleKey, {bool adminOnly = false}) {
      if (adminOnly && !privileged) return false;
      if (moduleKey == null) return true;
      if (privileged) return true;
      if (user == null) return false;
      if (user.enabledModules.isNotEmpty) return user.hasModule(moduleKey);
      // RBAC fallback
      switch (moduleKey) {
        case 'approvals':
        case 'analytics':
        case 'settings':
          return user.role != UserRole.agent;
        default:
          return true;
      }
    }

    return Drawer(
      backgroundColor: AppColors.sidebarBg,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(24, 20, 24, 20),
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: 'Loan',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16.1,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    TextSpan(
                      text: 'Track',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 16.1,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(color: Colors.white12, height: 1),
            _DrawerLink(
              icon: Icons.dashboard_outlined,
              label: t.x('drawer.dashboard'),
              onTap: () => context.go('/dashboard'),
            ),
            _DrawerLink(
              icon: Icons.payments_outlined,
              label: t.x('drawer.collection_entry'),
              onTap: () => context.go('/collection'),
            ),
            _DrawerSection(label: t.x('drawer.section_management')),
            _DrawerLink(
              icon: Icons.people_outline,
              label: t.x('nav.customers'),
              onTap: () => context.go('/customers'),
            ),
            _DrawerLink(
              icon: Icons.account_balance_wallet_outlined,
              label: t.x('nav.loans'),
              onTap: () => context.go('/loans'),
            ),
            _DrawerLink(
              icon: Icons.warning_amber_outlined,
              label: t.x('title.penalties'),
              onTap: () => context.go('/penalties'),
            ),
            if (can('approvals'))
              _DrawerLink(
                icon: Icons.fact_check_outlined,
                label: t.x('title.approvals'),
                onTap: () => context.go('/approvals'),
              ),
            if (can(null, adminOnly: true))
              _DrawerLink(
                icon: Icons.verified_user_outlined,
                label: t.x('kyc.title'),
                onTap: () => context.go('/kyc-review'),
              ),
            if (can('chits'))
              _DrawerLink(
                icon: Icons.savings_outlined,
                label: t.x('title.chits'),
                onTap: () => context.go('/chits'),
              ),
            if (privileged || can('analytics') || can('accounting')) ...[
              _DrawerSection(label: t.x('drawer.section_insights')),
              if (privileged)
                _DrawerLink(
                  icon: Icons.map_outlined,
                  label: t.x('admin.agent_tracking'),
                  onTap: () => context.go('/tracking'),
                ),
              if (can('analytics'))
                _DrawerLink(
                  icon: Icons.bar_chart_rounded,
                  label: t.x('title.analytics'),
                  onTap: () => context.go('/analytics'),
                ),
              if (can('accounting'))
                _DrawerLink(
                  icon: Icons.account_balance_outlined,
                  label: t.x('title.accounting'),
                  onTap: () => context.go('/accounting'),
                ),
            ],
            if (can('settings')) ...[
              _DrawerSection(label: t.x('drawer.section_account')),
              _DrawerLink(
                icon: Icons.settings_outlined,
                label: t.x('set.title'),
                onTap: () => context.go('/settings'),
              ),
            ],
            const Spacer(),
            const Divider(color: Colors.white12, height: 1),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: AppColors.primary,
                child: Icon(Icons.person, color: Colors.white, size: 18),
              ),
              title: Text(
                userName,
                style: AppTypography.body.copyWith(color: Colors.white),
              ),
              trailing: IconButton(
                icon: const Icon(
                  Icons.logout,
                  color: Colors.white70,
                  size: 18,
                ),
                onPressed: () =>
                    ref.read(authControllerProvider.notifier).logout(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerSection extends StatelessWidget {
  const _DrawerSection({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 4),
      child: Text(
        label,
        style: AppTypography.tiny.copyWith(
          color: Colors.white38,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _DrawerLink extends StatelessWidget {
  const _DrawerLink({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: Colors.white70, size: 20),
      title: Text(
        label,
        style: AppTypography.body.copyWith(color: Colors.white),
      ),
      onTap: onTap,
      dense: true,
    );
  }
}
