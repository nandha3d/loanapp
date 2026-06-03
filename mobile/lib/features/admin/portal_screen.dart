import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:loantrack/data/models/user.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class PortalScreen extends ConsumerWidget {
  const PortalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('portal.title')),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // User & Tenant Profile Card
            Container(
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
                  Text(
                    user?.name ?? '—',
                    style: AppTypography.nameLg.copyWith(color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Role: ${user?.role.name.toUpperCase()} · Tenant: ${user?.tenantSlug ?? 'Default'}',
                    style: AppTypography.caption.copyWith(color: Colors.white70),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(20),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline, color: AppColors.primary, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Active App Scope: ${user?.appType.toUpperCase()}',
                            style: AppTypography.caption.copyWith(color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Modules Header
            Text(
              t.x('portal.modules'),
              style: AppTypography.sectionTitle,
            ),
            const SizedBox(height: 12),

            // Microlending Module Card
            _ModuleCard(
              title: 'Micro-Lending Platform',
              description: 'Manage daily loan allocations, field collections, cash handovers, and routing.',
              icon: Icons.monetization_on_outlined,
              iconColor: AppColors.success,
              iconBg: AppColors.successBg,
              onTap: () {
                context.go('/dashboard');
              },
            ),
            const SizedBox(height: 16),

            // Chit Funds Module Card (Visible if chit module enabled or superadmin/admin)
            if (user?.role != UserRole.agent || (user?.hasModule('chits') ?? false)) ...[
              _ModuleCard(
                title: 'Chit Funds Suite',
                description: 'Organize chit groups, subscriber allocations, and process bidding auctions.',
                icon: Icons.account_balance_wallet_outlined,
                iconColor: AppColors.info,
                iconBg: AppColors.infoBg,
                onTap: () {
                  context.go('/chits');
                },
              ),
              const SizedBox(height: 24),
            ],

            // Branch Context Switcher (For Superadmins and Admins)
            if (user?.role == UserRole.superadmin || user?.role == UserRole.admin) ...[
              Text(
                'Branch Locations',
                style: AppTypography.sectionTitle,
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppTokens.radius),
                  boxShadow: AppTokens.shadow,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Currently viewing data for Branch ID: ${user?.branchId ?? 'Head Office'}',
                      style: AppTypography.bodyLarge,
                    ),
                    const SizedBox(height: 12),
                    AppButton(
                      label: 'Switch Active Branch',
                      onPressed: () {
                        // In a real app, this opens a bottom sheet with available branches
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Branch selector sheet opened')),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ModuleCard extends StatelessWidget {
  const _ModuleCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.onTap,
  });

  final String title;
  final String description;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
          border: Border.all(color: AppColors.border, width: 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.sectionTitle.copyWith(fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textLight),
          ],
        ),
      ),
    );
  }
}
