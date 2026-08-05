import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/chit_dashboard_summary.dart';
import 'package:zolofund/features/dashboard/widgets/kpi_card.dart';

/// Chit-funds home dashboard body. Chit tenants see this on the Home tab
/// instead of the lending dashboard (which talks about loans, routes and
/// instalments that don't exist for them).
class ChitDashboardBody extends ConsumerWidget {
  const ChitDashboardBody({
    super.key,
    required this.summary,
    required this.fmt,
    required this.userName,
    required this.t,
  });

  final ChitDashboardSummary summary;
  final NumberFormat fmt;
  final String userName;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        _ChitGreeting(name: userName, t: t),
        const SizedBox(height: 14),
        for (final live in summary.liveAuctions) ...[
          _LiveAuctionBanner(auction: live, t: t),
          const SizedBox(height: 10),
        ],
        if (summary.liveAuctions.isNotEmpty) const SizedBox(height: 4),
        _ChitHeroCard(summary: summary, fmt: fmt, t: t),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: KpiCard(
                icon: Icons.savings_outlined,
                value: '${summary.activeGroups}',
                label: t.x('chit.dash.active_groups'),
                tone: KpiTone.orange,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: KpiCard(
                icon: Icons.people_alt_outlined,
                value: '${summary.totalMembers}',
                label: t.x('chit.dash.members'),
                tone: KpiTone.blue,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: KpiCard(
                icon: Icons.gavel_outlined,
                value: '${summary.auctionsThisMonth}',
                label: t.x('chit.dash.auctions_month'),
                tone: KpiTone.purple,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: KpiCard(
                icon: Icons.pending_actions_outlined,
                value: '${summary.pendingApprovals}',
                label: t.x('chit.dash.approvals'),
                tone: summary.pendingApprovals > 0
                    ? KpiTone.red
                    : KpiTone.green,
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _ChitQuickActions(t: t),
        const SizedBox(height: 18),
        _UpcomingAuctionsCard(summary: summary, fmt: fmt, t: t),
        const SizedBox(height: 18),
        _OverdueMembersCard(summary: summary, fmt: fmt, t: t),
        const SizedBox(height: 18),
        _GroupsTableCard(summary: summary, fmt: fmt, t: t),
      ],
    );
  }
}

class _ChitGreeting extends StatelessWidget {
  const _ChitGreeting({required this.name, required this.t});
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

/// Pulsing "auction live now" strip — the one thing a foreman must never
/// miss on the home screen. Tapping lands on the group detail, where the
/// live room entry point lives (it needs the member list loaded).
class _LiveAuctionBanner extends StatelessWidget {
  const _LiveAuctionBanner({required this.auction, required this.t});
  final ChitAuctionBrief auction;
  final T t;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        onTap: () => context.push('/chits/${auction.chitGroupId}'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTokens.radius),
            gradient: const LinearGradient(
              colors: [Color(0xFF7F1D1D), Color(0xFFB91C1C)],
            ),
            boxShadow: AppTokens.shadow,
          ),
          child: Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(46),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.podcasts, color: Colors.white, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      t.x('dash.live'),
                      style:
                          AppTypography.tiny.copyWith(color: Colors.white),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${auction.chitGroupName} · ${t.x('chit.live.period')} ${auction.periodNumber}',
                  style: AppTypography.bodyLarge.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.white70),
            ],
          ),
        ),
      ),
    );
  }
}

Color _chitProgressColor(double pct) {
  const red = Color(0xFFFF8674);
  const amber = Color(0xFFFBBF24);
  const green = Color(0xFF34D399);
  final p = pct.clamp(0.0, 1.0);
  return p < 0.5
      ? Color.lerp(red, amber, p * 2)!
      : Color.lerp(amber, green, (p - 0.5) * 2)!;
}

/// Dark hero card — today's subscription collection at a glance
/// (same visual language as the lending hero).
class _ChitHeroCard extends StatelessWidget {
  const _ChitHeroCard({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final ChitDashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
    final collected = summary.todayCollected;
    final expected = summary.todayExpected;
    final pct = expected <= 0 ? 0.0 : (collected / expected).clamp(0.0, 1.0);
    final pctInt = (pct * 100).round();
    final barColor = _chitProgressColor(pct);

    return Container(
      padding: const EdgeInsets.all(20),
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
                t.x('chit.dash.today_due'),
                style: AppTypography.heroLabel.copyWith(color: Colors.white70),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    fmt.format(collected),
                    style:
                        AppTypography.heroNumber.copyWith(color: Colors.white),
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
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: Colors.white.withAlpha(24),
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _HeroStat(
                  label: t.x('chit.dash.collected'),
                  value: fmt.format(collected),
                  color: const Color(0xFF34D399),
                ),
                _heroDivider(),
                _HeroStat(
                  label: t.x('chit.dash.today_due'),
                  value: fmt.format(expected),
                  color: Colors.white,
                ),
                _heroDivider(),
                _HeroStat(
                  label: t.x('chit.dash.pending'),
                  value: fmt.format(summary.todayGap),
                  color: const Color(0xFFFF8674),
                ),
              ],
            ),
          ),
          if (summary.totalOverdueAmount > 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded,
                    color: Color(0xFFFF8674), size: 16),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '${t.x('chit.dash.overdue_members')}: '
                    '${summary.overdueMembersCount} · '
                    '${fmt.format(summary.totalOverdueAmount)}',
                    style: AppTypography.caption
                        .copyWith(color: Colors.white70),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _heroDivider() => Container(
        width: 1,
        height: 30,
        color: Colors.white.withAlpha(24),
      );
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: AppTypography.bodyLarge.copyWith(
                color: color,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTypography.tiny.copyWith(color: Colors.white60),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _ChitQuickActions extends StatelessWidget {
  const _ChitQuickActions({required this.t});
  final T t;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ChitActionBtn(
            icon: Icons.savings_rounded,
            label: t.x('chit.dash.new_group'),
            color: AppColors.primary,
            onTap: () => context.push('/chits/new'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ChitActionBtn(
            icon: Icons.person_add_alt_1_rounded,
            label: t.x('dash.new_customer'),
            color: AppColors.info,
            onTap: () => context.push('/customers/new'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ChitActionBtn(
            icon: Icons.account_balance_rounded,
            label: t.x('chit.dash.accounts'),
            color: AppColors.success,
            onTap: () => context.go('/accounting'),
          ),
        ),
      ],
    );
  }
}

class _ChitActionBtn extends StatelessWidget {
  const _ChitActionBtn({
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

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child, this.trailing});
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
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _UpcomingAuctionsCard extends StatelessWidget {
  const _UpcomingAuctionsCard({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final ChitDashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: t.x('chit.dash.upcoming_auctions'),
      child: summary.upcomingAuctions.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                t.x('chit.dash.no_upcoming'),
                style: AppTypography.caption,
              ),
            )
          : Column(
              children: [
                for (final a in summary.upcomingAuctions)
                  InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => context.push('/chits/${a.chitGroupId}'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.purpleBg,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.gavel_outlined,
                                color: AppColors.purple, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  a.chitGroupName,
                                  style: AppTypography.bodyLarge.copyWith(
                                      fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '${t.x('chit.live.period')} ${a.periodNumber}'
                                  ' · ${fmt.format(a.chitValue)}',
                                  style: AppTypography.caption,
                                ),
                              ],
                            ),
                          ),
                          Text(
                            a.auctionDate == null
                                ? '—'
                                : DateFormat('d MMM').format(a.auctionDate!),
                            style: AppTypography.bodyLarge.copyWith(
                              color: AppColors.purple,
                              fontWeight: FontWeight.w700,
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

class _OverdueMembersCard extends ConsumerWidget {
  const _OverdueMembersCard({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final ChitDashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _SectionCard(
      title: t.x('chit.dash.overdue_members'),
      child: summary.overdueSubscriptions.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                t.x('chit.dash.no_overdue'),
                style: AppTypography.caption,
              ),
            )
          : Column(
              children: [
                for (final s in summary.overdueSubscriptions)
                  InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => context.push('/chits/${s.chitGroupId}'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: AppColors.dangerBg,
                            foregroundImage: (s.customerPhoto == null ||
                                    s.customerPhoto!.isEmpty)
                                ? null
                                : authedImage(ref, s.customerPhoto!),
                            child: Text(
                              s.customerName.isEmpty
                                  ? '?'
                                  : s.customerName[0].toUpperCase(),
                              style: AppTypography.bodyLarge
                                  .copyWith(color: AppColors.danger),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  s.customerName,
                                  style: AppTypography.bodyLarge.copyWith(
                                      fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '${s.chitGroupName} · '
                                  '${t.x('chit.live.period')} ${s.periodNumber}',
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
                                fmt.format(s.overdueAmount),
                                style: AppTypography.bodyLarge.copyWith(
                                  color: AppColors.danger,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                '${s.daysOverdue}${t.x('chit.dash.days_suffix')}',
                                style: AppTypography.tiny
                                    .copyWith(color: AppColors.textLight),
                              ),
                            ],
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

/// Active groups as a compact table — the mobile counterpart of the web
/// dashboard's chit-group table: value, seats filled, period progress.
class _GroupsTableCard extends StatelessWidget {
  const _GroupsTableCard({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final ChitDashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: t.x('chit.dash.groups'),
      trailing: TextButton(
        onPressed: () => context.go('/chits'),
        child: Text(t.x('chit.dash.view_all')),
      ),
      child: summary.groups.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                t.x('chit.dash.no_groups'),
                style: AppTypography.caption,
              ),
            )
          : Column(
              children: [
                for (final g in summary.groups)
                  InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => context.push('/chits/${g.id}'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  g.name,
                                  style: AppTypography.bodyLarge.copyWith(
                                      fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(
                                fmt.format(g.chitValue),
                                style: AppTypography.bodyLarge.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(Icons.people_alt_outlined,
                                  size: 14, color: AppColors.textLight),
                              const SizedBox(width: 4),
                              Text(
                                '${g.membersCount}/${g.totalMembers}',
                                style: AppTypography.caption,
                              ),
                              const SizedBox(width: 12),
                              Icon(Icons.event_repeat_outlined,
                                  size: 14, color: AppColors.textLight),
                              const SizedBox(width: 4),
                              Text(
                                '${t.x('chit.live.period')} '
                                '${g.currentPeriod}/${g.durationMonths}',
                                style: AppTypography.caption,
                              ),
                              const Spacer(),
                              Text(
                                '${fmt.format(g.monthlyContrib)}/mo',
                                style: AppTypography.caption,
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                              value: g.progress,
                              minHeight: 5,
                              backgroundColor: AppColors.border,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                _chitProgressColor(g.progress),
                              ),
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
