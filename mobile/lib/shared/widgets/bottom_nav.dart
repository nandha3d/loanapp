import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';

class NavItem {
  const NavItem({required this.icon, required this.label, required this.route});
  final IconData icon;
  final String label;
  final String route;
}

const _items = <NavItem>[
  NavItem(icon: Icons.home_outlined, label: 'Home', route: '/dashboard'),
  NavItem(icon: Icons.people_outline, label: 'Customers', route: '/customers'),
  NavItem(icon: Icons.account_balance_wallet_outlined, label: 'Loans', route: '/loans'),
  NavItem(icon: Icons.payments_outlined, label: 'Collection', route: '/collection'),
  NavItem(icon: Icons.more_horiz_rounded, label: 'More', route: '/more'),
];

class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.currentRoute});

  final String currentRoute;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, -4), blurRadius: 24),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: _items.map((item) {
              // "More" is active if on /more OR on any secondary route
              final isMore = item.route == '/more' &&
                  (currentRoute == '/more' ||
                      currentRoute.startsWith('/penalties') ||
                      currentRoute.startsWith('/approvals') ||
                      currentRoute.startsWith('/analytics') ||
                      currentRoute.startsWith('/chits') ||
                      currentRoute.startsWith('/accounting') ||
                      currentRoute.startsWith('/settings'));
              final active = isMore || currentRoute.startsWith(item.route);
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
