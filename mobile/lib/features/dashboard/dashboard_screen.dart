import 'dart:math' as math;

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
import 'package:loantrack/data/models/dashboard_summary.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/repositories/dashboard_repository.dart';
import 'package:loantrack/features/admin/tracking/agent_tracking_screen.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final summary = ref.watch(dashboardSummaryProvider);
    final t = T.of(ref);
    final fmt = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );

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
      drawer: _SideDrawer(user: user),
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
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        _GreetingRow(name: userName, t: t),
        const SizedBox(height: 14),
        _HeroBalance(summary: summary, fmt: fmt, t: t),
        const SizedBox(height: 14),
        _MoneyFlowRow(summary: summary, t: t),
        const SizedBox(height: 14),
        _AlertsRow(summary: summary, t: t),
        const SizedBox(height: 18),
        _QuickActions(t: t),
        const SizedBox(height: 18),
        _ScheduleSection(summary: summary, fmt: fmt, t: t),
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
    final collected = summary.todayCollected;
    final expected = summary.todayExpected;
    final pct = expected <= 0 ? 0.0 : (collected / expected).clamp(0.0, 1.0);

    return GestureDetector(
      onTap: () => ref.speak(
        '${t.x('dash.today_collected')} ${_speakAmount(collected)}',
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(48),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.bolt_rounded,
                        color: AppColors.primary,
                        size: 14,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'LIVE',
                        style: AppTypography.tiny.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  t.x('dash.today_collected'),
                  style: AppTypography.heroLabel.copyWith(
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fmt.format(collected),
                        style: AppTypography.heroNumber.copyWith(
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(
                            Icons.flag_outlined,
                            size: 14,
                            color: Colors.white54,
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              '${t.x('dash.today_expected')} ${fmt.format(expected)}',
                              style: AppTypography.heroMeta.copyWith(
                                color: Colors.white54,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                _ProgressArc(pct: pct),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressArc extends StatelessWidget {
  const _ProgressArc({required this.pct});
  final double pct;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 78,
      height: 78,
      child: CustomPaint(
        painter: _ArcPainter(pct: pct),
        child: Center(
          child: Text(
            '${(pct * 100).round()}%',
            style: AppTypography.bodyLarge.copyWith(
              color: Colors.white,
              fontSize: 16,
            ),
          ),
        ),
      ),
    );
  }
}

class _ArcPainter extends CustomPainter {
  _ArcPainter({required this.pct});
  final double pct;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(4, 4, size.width - 8, size.height - 8);
    final track = Paint()
      ..color = Colors.white12
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;
    final fill = Paint()
      ..shader = const LinearGradient(
        colors: [AppColors.primary, Color(0xFFFFD37A)],
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(rect, -math.pi / 2, math.pi * 2, false, track);
    canvas.drawArc(rect, -math.pi / 2, math.pi * 2 * pct, false, fill);
  }

  @override
  bool shouldRepaint(covariant _ArcPainter old) => old.pct != pct;
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
            sub: '${summary.totalCustomers} customers',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatTile(
            icon: Icons.groups_2_outlined,
            iconColor: AppColors.info,
            iconBg: AppColors.infoBg,
            label: 'Agents',
            value: '${summary.activeAgents}',
            sub: 'on field',
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
            label: 'New\nCustomer',
            color: AppColors.info,
            onTap: () => context.go('/customers/new'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionBtn(
            icon: Icons.add_card_rounded,
            label: 'New\nLoan',
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

class _ScheduleSection extends ConsumerWidget {
  const _ScheduleSection({
    required this.summary,
    required this.fmt,
    required this.t,
  });
  final DashboardSummary summary;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Section(
      title: t.x('dash.today_schedule'),
      trailing: Text(
        '${summary.todayInstalments.length}',
        style: AppTypography.caption,
      ),
      child: summary.todayInstalments.isEmpty
          ? SizedBox(
              height: 140,
              child: EmptyState(
                icon: Icons.calendar_today_outlined,
                title: t.x('dash.no_schedule'),
              ),
            )
          : SizedBox(
              height: 178,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                itemCount: summary.todayInstalments.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, i) {
                  final inst = summary.todayInstalments[i];
                  return _ScheduleCard(
                    inst: inst,
                    fmt: fmt,
                    onTap: () {
                      ref.speak(
                        '${inst.customerName}, ${fmt.format(inst.dueAmount)}',
                      );
                      context.go('/collection');
                    },
                  );
                },
              ),
            ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({
    required this.inst,
    required this.fmt,
    required this.onTap,
  });
  final TodayInstalment inst;
  final NumberFormat fmt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isPaid = inst.status == 'paid';
    final isPartial = inst.status == 'partial';
    final statusColor = isPaid
        ? AppColors.success
        : isPartial
            ? AppColors.warning
            : AppColors.info;
    final statusBg = isPaid
        ? AppColors.successBg
        : isPartial
            ? AppColors.warningBg
            : AppColors.infoBg;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 200,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
          border: Border.all(color: statusColor.withAlpha(40)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _Avatar(name: inst.customerName, size: 36),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        inst.customerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.bodyLarge,
                      ),
                      Text(inst.loanCode, style: AppTypography.caption),
                    ],
                  ),
                ),
              ],
            ),
            const Spacer(),
            Text(
              fmt.format(inst.dueAmount),
              style: AppTypography.moneyLg.copyWith(
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: statusBg,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                inst.status.toUpperCase(),
                style: AppTypography.tiny.copyWith(color: statusColor),
              ),
            ),
          ],
        ),
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
      child: summary.recentLoans.isEmpty
          ? SizedBox(
              height: 100,
              child: EmptyState(
                icon: Icons.history,
                title: t.x('dash.no_activity'),
              ),
            )
          : Column(
              children: [
                for (final l in summary.recentLoans)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        _Avatar(name: l.customerName, size: 36),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l.customerName,
                                style: AppTypography.bodyLarge,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                'New loan ${l.loanCode}',
                                style: AppTypography.caption,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        Text(
                          _relTime(l.createdAt),
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

String _relTime(DateTime dt) {
  final d = DateTime.now().difference(dt);
  if (d.inMinutes < 1) return 'now';
  if (d.inHours < 1) return '${d.inMinutes}m';
  if (d.inDays < 1) return '${d.inHours}h';
  if (d.inDays < 7) return '${d.inDays}d';
  return DateFormat('d MMM').format(dt);
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
    this.trailing,
  });
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

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 80),
        const Icon(Icons.cloud_off, size: 56, color: AppColors.textLight),
        const SizedBox(height: 12),
        Text(
          'Could not load dashboard',
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
  const _SideDrawer({required this.user});
  final User? user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
              label: 'Dashboard',
              onTap: () => context.go('/dashboard'),
            ),
            _DrawerLink(
              icon: Icons.payments_outlined,
              label: 'Collection Entry',
              onTap: () => context.go('/collection'),
            ),
            const _DrawerSection(label: 'MANAGEMENT'),
            _DrawerLink(
              icon: Icons.people_outline,
              label: 'Customers',
              onTap: () => context.go('/customers'),
            ),
            _DrawerLink(
              icon: Icons.account_balance_wallet_outlined,
              label: 'Loans',
              onTap: () => context.go('/loans'),
            ),
            _DrawerLink(
              icon: Icons.warning_amber_outlined,
              label: 'Penalties',
              onTap: () => context.go('/penalties'),
            ),
            _DrawerLink(
              icon: Icons.fact_check_outlined,
              label: 'Approvals',
              onTap: () => context.go('/approvals'),
            ),
            const _DrawerSection(label: 'INSIGHTS'),
            _DrawerLink(
              icon: Icons.bar_chart_rounded,
              label: 'Analytics',
              onTap: () => context.go('/analytics'),
            ),
            _DrawerLink(
              icon: Icons.account_balance_outlined,
              label: 'Accounting & P&L',
              onTap: () => context.go('/accounting'),
            ),
            const _DrawerSection(label: 'ACCOUNT'),
            if (user?.role == UserRole.admin || user?.role == UserRole.superadmin)
              _DrawerLink(
                icon: Icons.location_on_outlined,
                label: 'Agent Tracking',
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AgentTrackingScreen()),
                ),
              ),
            _DrawerLink(
              icon: Icons.settings_outlined,
              label: 'Settings',
              onTap: () => context.go('/settings'),
            ),
            const Spacer(),
            const Divider(color: Colors.white12, height: 1),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: AppColors.primary,
                child: Icon(Icons.person, color: Colors.white, size: 18),
              ),
              title: Text(
                user?.name ?? '—',
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
