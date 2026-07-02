import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/user.dart';

class NavItem {
  const NavItem({required this.icon, required this.label, required this.route});
  final IconData icon;
  final String label;
  final String route;
}

const _items = <NavItem>[
  NavItem(icon: Icons.home_outlined, label: 'Home', route: '/dashboard'),
  NavItem(icon: Icons.people_outline, label: 'Customers', route: '/customers'),
  NavItem(
      icon: Icons.account_balance_wallet_outlined,
      label: 'Loans',
      route: '/loans'),
  NavItem(
      icon: Icons.payments_outlined, label: 'Collection', route: '/collection'),
  NavItem(icon: Icons.grid_view_rounded, label: 'More', route: '/more'),
];

const _chitItems = <NavItem>[
  NavItem(icon: Icons.home_outlined, label: 'Home', route: '/dashboard'),
  NavItem(icon: Icons.people_outline, label: 'Members', route: '/customers'),
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
                children: items.map((item) {
                  final active = currentRoute.startsWith(item.route);
                  final color =
                      active ? AppColors.primary : AppColors.textLight;
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
                              fontWeight:
                                  active ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
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

/// Center "create" button — one entry point for every kind of activity the
/// app can start (new customer, new loan, collection run), instead of
/// hunting for the right screen's own FAB first.
class _CreateFab extends StatelessWidget {
  const _CreateFab();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showCreateSheet(context),
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

  void _showCreateSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
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
                onTap: () {
                  Navigator.pop(ctx);
                  context.push('/customers/new');
                },
              ),
              _CreateOption(
                icon: Icons.request_quote_outlined,
                label: 'New Loan',
                onTap: () {
                  Navigator.pop(ctx);
                  context.push('/loans/new');
                },
              ),
              _CreateOption(
                icon: Icons.route_outlined,
                label: 'Collection Run',
                onTap: () {
                  Navigator.pop(ctx);
                  context.push('/collection/runs');
                },
              ),
            ],
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
