import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/dashboard_summary.dart';
import 'package:loantrack/data/repositories/dashboard_repository.dart';
import 'package:loantrack/features/dashboard/widgets/activity_item.dart';
import 'package:loantrack/features/dashboard/widgets/kpi_card.dart';
import 'package:loantrack/features/dashboard/widgets/today_schedule_card.dart';
import 'package:loantrack/features/notifications/notifications_screen.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final summary = ref.watch(dashboardSummaryProvider);
    final fmt = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        centerTitle: true,
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        actions: [
          ValueListenableBuilder<int>(
            valueListenable: NotificationInbox.instance.changes,
            builder: (_, __, ___) {
              final unread = NotificationInbox.instance.unreadCount;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_outlined),
                    onPressed: () => context.push('/notifications'),
                  ),
                  if (unread > 0)
                    Positioned(
                      right: 6,
                      top: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1,
                        ),
                        decoration: const BoxDecoration(
                          color: AppColors.danger,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '$unread',
                          style: AppTypography.extraTiny
                              .copyWith(color: Colors.white),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      drawer: _SideDrawer(userName: user?.name ?? '—'),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async => ref.refresh(dashboardSummaryProvider.future),
        child: summary.when(
          loading: () => const _LoadingSkeleton(),
          error: (err, _) => _ErrorState(message: err.toString()),
          data: (s) => _DashboardBody(summary: s, fmt: fmt),
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/dashboard'),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.summary, required this.fmt});
  final DashboardSummary summary;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          shrinkWrap: true,
          childAspectRatio: 1.55,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            KpiCard(
              icon: Icons.account_balance_wallet,
              value: fmt.format(summary.todayCollected),
              label: "Today's Collection",
              tone: KpiTone.green,
            ),
            KpiCard(
              icon: Icons.pending_actions,
              value: '${summary.pendingPenalties}',
              label: 'Pending Penalties',
              tone: KpiTone.orange,
            ),
            KpiCard(
              icon: Icons.payments,
              value: '${summary.activeLoans}',
              label: 'Active Loans',
              tone: KpiTone.blue,
            ),
            KpiCard(
              icon: Icons.warning_amber,
              value: '${summary.overdueLoans}',
              label: 'Overdue Loans',
              tone: KpiTone.red,
            ),
          ],
        ),
        const SizedBox(height: 20),
        _Section(
          title: "Today's Schedule",
          child: summary.todayInstalments.isEmpty
              ? const SizedBox(
                  height: 140,
                  child: EmptyState(
                    icon: Icons.calendar_today_outlined,
                    title: 'No collections scheduled',
                  ),
                )
              : SizedBox(
                  height: 170,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: summary.todayInstalments.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (_, i) => TodayScheduleCard(
                      item: summary.todayInstalments[i],
                      onCollect: () {}, // Sprint 4
                    ),
                  ),
                ),
        ),
        const SizedBox(height: 20),
        _Section(
          title: 'Recent Activity',
          child: summary.recentLoans.isEmpty
              ? const SizedBox(
                  height: 140,
                  child: EmptyState(icon: Icons.history, title: 'No recent activity'),
                )
              : Column(
                  children: summary.recentLoans
                      .map((l) => ActivityItem(
                            text:
                                'New loan ${l.loanCode} • ${l.customerName}',
                            timestamp: l.createdAt,
                          ))
                      .toList(growable: false),
                ),
        ),
      ],
    );
  }
}

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          shrinkWrap: true,
          childAspectRatio: 1.55,
          physics: const NeverScrollableScrollPhysics(),
          children: List.generate(
            4,
            (_) => Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppTokens.radius),
                boxShadow: AppTokens.shadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Skeleton(width: 80, height: 22),
                  SizedBox(height: 6),
                  Skeleton(width: 120, height: 10),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        const Skeleton(height: 140, borderRadius: AppTokens.radius),
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

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _SideDrawer extends ConsumerWidget {
  const _SideDrawer({required this.userName});
  final String userName;

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
            _DrawerLink(icon: Icons.dashboard_outlined, label: 'Dashboard', onTap: () => context.go('/dashboard')),
            _DrawerLink(icon: Icons.people_outline, label: 'Customers', onTap: () => context.go('/customers')),
            _DrawerLink(icon: Icons.account_balance_wallet_outlined, label: 'Loans', onTap: () => context.go('/loans')),
            _DrawerLink(icon: Icons.payments_outlined, label: 'Collection', onTap: () => context.go('/collection')),
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
                icon: const Icon(Icons.logout, color: Colors.white70, size: 18),
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

class _DrawerLink extends StatelessWidget {
  const _DrawerLink({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: Colors.white70, size: 20),
      title: Text(label, style: AppTypography.body.copyWith(color: Colors.white)),
      onTap: onTap,
      dense: true,
    );
  }
}
