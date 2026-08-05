import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/user.dart';

class NavItem {
  const NavItem({required this.icon, required this.label, required this.route});
  final IconData icon;
  final String label;
  final String route;
}

// 4 tabs — 2 each side of the center "+" button. The full menu lives behind
// the dashboard hamburger (/more); the tab bar carries the daily-work
// screens: Home, Loans, Collection, Customers.
const _items = <NavItem>[
  NavItem(icon: Icons.home_outlined, label: 'Home', route: '/dashboard'),
  NavItem(
      icon: Icons.account_balance_wallet_outlined,
      label: 'Loans',
      route: '/loans'),
  NavItem(
      icon: Icons.payments_outlined, label: 'Collection', route: '/collection'),
  NavItem(
      icon: Icons.people_alt_outlined, label: 'Customers', route: '/customers'),
];

const _chitItems = <NavItem>[
  NavItem(icon: Icons.home_outlined, label: 'Home', route: '/dashboard'),
  NavItem(icon: Icons.savings_outlined, label: 'Chits', route: '/chits'),
  NavItem(
      icon: Icons.account_balance_outlined,
      label: 'Accounts',
      route: '/accounting'),
  NavItem(icon: Icons.grid_view_rounded, label: 'More', route: '/more'),
];

class AppBottomNav extends ConsumerWidget {
  const AppBottomNav({super.key, required this.currentRoute});

  final String currentRoute;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final items = AppType.userIsChit(user) ? _chitItems : _items;

    return Container(
      clipBehavior: Clip.none,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
              color: Color(0x1A000000), offset: Offset(0, -4), blurRadius: 24),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  // 2 tabs — center gap for the "+" button — 2 tabs, so the
                  // FAB never overlaps a tappable tab.
                  for (var i = 0; i < items.length; i++) ...[
                    if (i == items.length ~/ 2)
                      const SizedBox(width: 64),
                    _NavTab(
                      item: items[i],
                      active: currentRoute.startsWith(items[i].route),
                    ),
                  ],
                ],
              ),
              Positioned(
                top: -20,
                left: 0,
                right: 0,
                child: Center(child: _CreateFab()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavTab extends StatelessWidget {
  const _NavTab({required this.item, required this.active});
  final NavItem item;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.primary : AppColors.textLight;
    return Expanded(
      child: InkWell(
        onTap: () => context.go(item.route),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(item.icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(
              item.label,
              style: AppTypography.caption.copyWith(
                color: color,
                fontWeight: active ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Center "create" button — one entry point for every kind of activity the
/// app can start, instead of hunting for the right screen's own FAB first.
/// Admin-only actions (agents, routes, wallet release, accounting entries)
/// are hidden from field agents.
class _CreateFab extends ConsumerWidget {
  const _CreateFab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () => _showCreateSheet(context, ref),
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: AppColors.primary,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.surface, width: 3),
          boxShadow: const [
            BoxShadow(
                color: Color(0x33000000), offset: Offset(0, 3), blurRadius: 10),
          ],
        ),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),
    );
  }

  void _showCreateSheet(BuildContext context, WidgetRef ref) {
    final user = ref.read(authControllerProvider).user;
    final role = user?.role;
    final privileged = role == UserRole.admin ||
        role == UserRole.superadmin ||
        role == UserRole.developer;
    final isChit = AppType.userIsChit(user);

    void go(BuildContext ctx, String route) {
      Navigator.pop(ctx);
      context.push(route);
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                _CreateOption(
                  icon: Icons.person_add_alt_1_outlined,
                  label: 'New Customer',
                  onTap: () => go(ctx, '/customers/new'),
                ),
                if (!isChit) ...[
                  _CreateOption(
                    icon: Icons.request_quote_outlined,
                    label: 'New Loan',
                    onTap: () => go(ctx, '/loans/new'),
                  ),
                  _CreateOption(
                    icon: Icons.route_outlined,
                    label: 'Collection Run',
                    onTap: () => go(ctx, '/collection/runs'),
                  ),
                ] else ...[
                  _CreateOption(
                    icon: Icons.savings_outlined,
                    label: 'New Chit Group',
                    onTap: () => go(ctx, '/chits/new'),
                  ),
                ],
                if (privileged) ...[
                  const _CreateSectionLabel('Account'),
                  _CreateOption(
                    icon: Icons.savings_outlined,
                    label: 'Add Capital',
                    onTap: () => go(ctx, '/accounting'),
                  ),
                  _CreateOption(
                    icon: Icons.receipt_long_outlined,
                    label: 'Add Expense',
                    onTap: () => go(ctx, '/accounting'),
                  ),
                  const _CreateSectionLabel('Team'),
                  _CreateOption(
                    icon: Icons.badge_outlined,
                    label: 'Create Agent',
                    onTap: () => go(ctx, '/admin/team'),
                  ),
                  if (!isChit) ...[
                    _CreateOption(
                      icon: Icons.alt_route_outlined,
                      label: 'Create Route',
                      onTap: () => go(ctx, '/settings'),
                    ),
                    _CreateOption(
                      icon: Icons.account_balance_wallet_outlined,
                      label: 'Release Agent Wallet',
                      onTap: () => go(ctx, '/wallet'),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CreateSectionLabel extends StatelessWidget {
  const _CreateSectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          label.toUpperCase(),
          style: AppTypography.tiny.copyWith(
            color: AppColors.textLight,
            letterSpacing: 0.8,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _CreateOption extends StatelessWidget {
  const _CreateOption({
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
      leading: Icon(icon, color: AppColors.primary),
      title: Text(label, style: AppTypography.bodyLarge),
      onTap: onTap,
    );
  }
}
