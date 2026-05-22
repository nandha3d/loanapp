import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';

class _ModuleItem {
  const _ModuleItem({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.route,
    required this.color,
    required this.bgColor,
  });
  final IconData icon;
  final String label, subtitle, route;
  final Color color, bgColor;
}

const _modules = <_ModuleItem>[
  _ModuleItem(
    icon: Icons.warning_amber_rounded,
    label: 'Penalties',
    subtitle: 'Manage & settle overdue fines',
    route: '/penalties',
    color: AppColors.danger,
    bgColor: AppColors.dangerBg,
  ),
  _ModuleItem(
    icon: Icons.fact_check_outlined,
    label: 'Approvals',
    subtitle: 'Review pending requests',
    route: '/approvals',
    color: AppColors.success,
    bgColor: AppColors.successBg,
  ),
  _ModuleItem(
    icon: Icons.bar_chart_rounded,
    label: 'Reports & Analytics',
    subtitle: 'Collection trends & agent performance',
    route: '/analytics',
    color: AppColors.info,
    bgColor: AppColors.infoBg,
  ),
  _ModuleItem(
    icon: Icons.savings_outlined,
    label: 'Chit Funds',
    subtitle: 'Group savings management',
    route: '/chits',
    color: AppColors.purple,
    bgColor: AppColors.purpleBg,
  ),
  _ModuleItem(
    icon: Icons.account_balance_outlined,
    label: 'Accounting & P&L',
    subtitle: 'Daily financials, capital & overdue',
    route: '/accounting',
    color: AppColors.info,
    bgColor: AppColors.infoBg,
  ),
  _ModuleItem(
    icon: Icons.settings_outlined,
    label: 'Settings',
    subtitle: 'Routes, account & app preferences',
    route: '/settings',
    color: AppColors.textSecondary,
    bgColor: AppColors.background,
  ),
];

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('More'), centerTitle: true),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _modules.length,
        itemBuilder: (_, i) => _ModuleTile(item: _modules[i]),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/more'),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  const _ModuleTile({required this.item});
  final _ModuleItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.go(item.route),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              boxShadow: AppTokens.shadow,
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: item.bgColor,
                    borderRadius: BorderRadius.circular(AppTokens.radiusKpiIcon),
                  ),
                  child: Icon(item.icon, color: item.color, size: 26),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.label, style: AppTypography.sectionTitle),
                      const SizedBox(height: 3),
                      Text(
                        item.subtitle,
                        style: AppTypography.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.chevron_right_rounded,
                    color: AppColors.textLight, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
