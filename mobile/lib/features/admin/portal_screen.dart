import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:loantrack/data/models/user.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

/// Verticals the tenant subscribed to — served by /api/v1/auth/me, mirrors
/// the web /portal module cards.
final _verticalsProvider =
    FutureProvider.autoDispose<List<String>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.me);
  final data = res.data?['data'] as Map<String, dynamic>?;
  return (data?['verticals'] as List<dynamic>? ?? const [])
      .whereType<String>()
      .toList(growable: false);
});

class _VerticalDef {
  const _VerticalDef(
    this.key,
    this.title,
    this.description,
    this.icon,
    this.color,
    this.bg,
    this.route,
  );
  final String key;
  final String title;
  final String description;
  final IconData icon;
  final Color color;
  final Color bg;
  final String route;
}

const _verticalDefs = <_VerticalDef>[
  _VerticalDef(
    AppType.microlending,
    'Micro Lending',
    'Manage micro-loans, collections, penalties, and customer portfolios.',
    Icons.monetization_on_outlined,
    AppColors.success,
    AppColors.successBg,
    '/dashboard',
  ),
  _VerticalDef(
    AppType.autofinance,
    'Auto Finance',
    'Vehicle financing, EMI management, and auto loan tracking.',
    Icons.directions_car_outlined,
    AppColors.info,
    AppColors.infoBg,
    '/vehicles',
  ),
  _VerticalDef(
    AppType.chitfunds,
    'Chit Funds',
    'Chit fund management, auctions, and member tracking.',
    Icons.savings_outlined,
    AppColors.purpleText,
    AppColors.purpleBg,
    '/chits',
  ),
  _VerticalDef(
    AppType.goldloan,
    'Gold Loan',
    'Gold-backed lending, valuation, LTV, pledges, and release tracking.',
    Icons.workspace_premium_outlined,
    AppColors.warning,
    AppColors.warningBg,
    '/dashboard',
  ),
  _VerticalDef(
    AppType.property,
    'Property Loan',
    'Property-backed origination, valuations, and document-led lending.',
    Icons.home_work_outlined,
    AppColors.defaultPrimary,
    AppColors.defaultPrimaryLight,
    '/dashboard',
  ),
  _VerticalDef(
    AppType.productfinance,
    'Product Finance',
    'Consumer durable finance with dealer, invoice, and down-payment capture.',
    Icons.shopping_bag_outlined,
    AppColors.info,
    AppColors.infoBg,
    '/dashboard',
  ),
];

class PortalScreen extends ConsumerWidget {
  const PortalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final t = T.of(ref);
    final verticalsAsync = ref.watch(_verticalsProvider);

    final isAdminish = user?.role == UserRole.superadmin ||
        user?.role == UserRole.admin ||
        user?.role == UserRole.developer;

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
                    'Welcome, ${user?.name ?? '—'}',
                    style: AppTypography.nameLg.copyWith(color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Role: ${user?.role.name.toUpperCase()} · Tenant: ${user?.tenantSlug ?? 'Default'}',
                    style:
                        AppTypography.caption.copyWith(color: Colors.white70),
                  ),
                  if (user?.role == UserRole.superadmin ||
                      user?.role == UserRole.admin) ...[
                    const SizedBox(height: 14),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.zero,
                        ),
                        icon: const Icon(Icons.account_circle_outlined),
                        label: const Text('View profile'),
                        onPressed: () => context.push('/profile'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Module (vertical) cards — same set the tenant subscribed to.
            Text(t.x('portal.modules'), style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            ...verticalsAsync.when(
              loading: () => const [
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ],
              error: (_, __) => _verticalCards(
                context,
                ref,
                [user?.appType ?? AppType.microlending],
              ),
              data: (verticals) => _verticalCards(
                context,
                ref,
                verticals.isEmpty
                    ? [user?.appType ?? AppType.microlending]
                    : verticals,
              ),
            ),
            const SizedBox(height: 24),

            // Quick Access (non-agents) — mirrors web portal.
            if (isAdminish) ...[
              Text('Quick Access', style: AppTypography.sectionTitle),
              const SizedBox(height: 12),
              _quickTile(
                context,
                Icons.payments_outlined,
                AppColors.success,
                'My Collections',
                'View and manage collections',
                '/collection',
              ),
              const SizedBox(height: 10),
              _quickTile(
                context,
                Icons.people_outline,
                AppColors.info,
                'My Customers',
                'View assigned customers',
                '/customers',
              ),
              const SizedBox(height: 10),
              _quickTile(
                context,
                Icons.account_balance_wallet_outlined,
                AppColors.primary,
                'My Loans',
                'View loan details',
                '/loans',
              ),
              const SizedBox(height: 10),
              _quickTile(
                context,
                Icons.dashboard_outlined,
                AppColors.purpleText,
                'My Dashboard',
                'View stats and overview',
                '/dashboard',
              ),
              const SizedBox(height: 24),
            ],

            // System Administration (superadmin / developer).
            if (user?.role == UserRole.superadmin ||
                user?.role == UserRole.developer) ...[
              Text('System Administration', style: AppTypography.sectionTitle),
              const SizedBox(height: 12),
              _quickTile(
                context,
                Icons.manage_accounts_outlined,
                AppColors.warning,
                'User Management',
                'Manage team roles and access',
                user?.role == UserRole.developer
                    ? '/admin/users'
                    : '/admin/team',
              ),
              const SizedBox(height: 10),
              _quickTile(
                context,
                Icons.store_mall_directory_outlined,
                AppColors.info,
                'Branch Management',
                'Branches and module access',
                '/admin/branches',
              ),
              const SizedBox(height: 10),
              _quickTile(
                context,
                Icons.receipt_long_outlined,
                AppColors.purpleText,
                'My Subscription',
                'View plan details and usage',
                user?.role == UserRole.developer
                    ? '/admin/billing'
                    : '/portal/billing',
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _verticalCards(
    BuildContext context,
    WidgetRef ref,
    List<String> enabled,
  ) {
    final cards = <Widget>[];
    final normalized = enabled.map(AppType.normalize).toSet();
    for (final def in _verticalDefs) {
      if (!normalized.contains(def.key)) continue;
      if (cards.isNotEmpty) cards.add(const SizedBox(height: 12));
      cards.add(
        _ModuleCard(
          title: def.title,
          description: def.description,
          icon: def.icon,
          iconColor: def.color,
          iconBg: def.bg,
          onTap: () async {
            await ref
                .read(authControllerProvider.notifier)
                .setActiveAppType(def.key);
            if (context.mounted) context.go(def.route);
          },
        ),
      );
    }
    if (cards.isEmpty) {
      cards.add(
        _ModuleCard(
          title: 'Micro Lending',
          description:
              'Manage micro-loans, collections, penalties, and customer portfolios.',
          icon: Icons.monetization_on_outlined,
          iconColor: AppColors.success,
          iconBg: AppColors.successBg,
          onTap: () => context.go('/dashboard'),
        ),
      );
    }
    return cards;
  }

  Widget _quickTile(
    BuildContext context,
    IconData icon,
    Color color,
    String title,
    String subtitle,
    String route,
  ) {
    return InkWell(
      onTap: () => context.go(route),
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          border: Border.all(color: AppColors.border),
          boxShadow: AppTokens.shadow,
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.bodyLarge
                        .copyWith(fontWeight: FontWeight.w600),
                  ),
                  Text(subtitle, style: AppTypography.caption),
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
                  Text(description, style: AppTypography.caption),
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
