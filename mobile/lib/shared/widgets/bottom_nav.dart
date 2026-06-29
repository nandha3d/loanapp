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
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: items.map((item) {
              final active = currentRoute.startsWith(item.route);
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
        ),
      ),
    );
  }
}
