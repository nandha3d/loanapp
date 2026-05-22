import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/user.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final isSuperadmin = user?.role == UserRole.superadmin ||
        user?.role == UserRole.developer;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Settings'), centerTitle: true),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _section('Admin', [
            _SettingsTile(
              icon: Icons.alt_route_outlined,
              title: 'Routes',
              subtitle: 'Create and assign agent routes',
              onTap: () => context.push('/settings/routes'),
            ),
            _SettingsTile(
              icon: Icons.inventory_2_outlined,
              title: 'Loan Packages',
              subtitle: 'Manage loan products',
              onTap: () => context.push('/settings/packages'),
            ),
            _SettingsTile(
              icon: Icons.bar_chart_outlined,
              title: 'Analytics',
              subtitle: 'KPIs and charts',
              onTap: () => context.push('/analytics'),
            ),
            _SettingsTile(
              icon: Icons.summarize_outlined,
              title: 'Reports',
              subtitle: 'Daily / agent / overdue',
              onTap: () => context.push('/reports'),
            ),
            _SettingsTile(
              icon: Icons.gavel_outlined,
              title: 'Penalties',
              subtitle: 'Settle pending penalties',
              onTap: () => context.push('/penalties'),
            ),
            _SettingsTile(
              icon: Icons.fact_check_outlined,
              title: 'Approvals',
              subtitle: 'Review pending requests',
              onTap: () => context.push('/approvals'),
            ),
          ]),
          const SizedBox(height: 16),
          _section('Security', [
            _SettingsTile(
              icon: Icons.security_outlined,
              title: 'Two-Factor Authentication',
              subtitle:
                  user?.totpEnabled == true ? 'Enabled' : 'Not enabled',
              onTap: () => context.push('/settings/2fa'),
            ),
            _SettingsTile(
              icon: Icons.logout,
              title: 'Sign out',
              onTap: () =>
                  ref.read(authControllerProvider.notifier).logout(),
            ),
          ]),
          if (isSuperadmin) ...[
            const SizedBox(height: 16),
            _section('Superadmin', [
              _SettingsTile(
                icon: Icons.manage_accounts_outlined,
                title: 'User Management',
                subtitle: 'Create and manage users',
                onTap: () => context.push('/settings/users'),
              ),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> tiles) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Text(
            title.toUpperCase(),
            style: AppTypography.extraTiny.copyWith(
              color: AppColors.textLight,
              fontWeight: FontWeight.w600,
              letterSpacing: 1,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            boxShadow: AppTokens.shadow,
          ),
          child: Column(
            children: [
              for (var i = 0; i < tiles.length; i++) ...[
                tiles[i],
                if (i != tiles.length - 1)
                  const Divider(height: 1, color: AppColors.border, indent: 56),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primaryDark),
      title: Text(title, style: AppTypography.body),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!, style: AppTypography.caption),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textLight),
      onTap: onTap,
    );
  }
}
