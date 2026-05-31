import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
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
    icon: Icons.verified_user_outlined,
    label: 'KYC Review',
    subtitle: 'Verify pending customer KYC',
    route: '/kyc-review',
    color: AppColors.warning,
    bgColor: AppColors.warningBg,
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

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final user = ref.watch(authControllerProvider).user;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(t.x('nav.more')), centerTitle: true),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ProfileHeader(
            name: user?.name ?? '—',
            role: user?.role.name ?? '',
            tenantSlug: user?.tenantSlug ?? '',
          ),
          const SizedBox(height: 16),
          for (final m in _modules) _ModuleTile(item: m),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/more'),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.name,
    required this.role,
    required this.tenantSlug,
  });
  final String name;
  final String role;
  final String tenantSlug;

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
    final roleLabel = role.isEmpty
        ? ''
        : '${role[0].toUpperCase()}${role.substring(1)}';
    final subtitle = [roleLabel, if (tenantSlug.isNotEmpty) tenantSlug]
        .where((s) => s.isNotEmpty)
        .join(' · ');
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2A2520), Color(0xFF1B1815)],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(40),
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Text(
              _initials(),
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w800,
                fontSize: 19,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: Colors.white.withAlpha(150),
                      fontSize: 12.5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(50),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  'ONLINE',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
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
            decoration: const BoxDecoration(
              boxShadow: AppTokens.shadow,
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: item.bgColor,
                    borderRadius:
                        BorderRadius.circular(AppTokens.radiusKpiIcon),
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
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textLight,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
