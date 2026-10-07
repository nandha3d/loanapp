import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/a11y/ui_prefs.dart';
import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/features/billing/widgets/plan_upgrade_sheet.dart';
import 'package:zolofund/shared/widgets/app_card.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/module_app_bar_title.dart';

// ── Module category enum ──────────────────────────────────────────────────────

enum _ModuleCategory {
  core('Core Operations'),
  operations('Operations & Approvals'),
  finance('Financials & Reports'),
  system('Settings & Account');

  const _ModuleCategory(this.title);
  final String title;
}

// ── Module tile config ────────────────────────────────────────────────────────

class _ModuleItem {
  const _ModuleItem({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.route,
    required this.color,
    required this.bgColor,
    this.category = _ModuleCategory.core,
    this.moduleKey,
    this.addonKey,
    this.minRole,
  });

  final IconData icon;
  final String label, subtitle, route;
  final Color color, bgColor;
  final _ModuleCategory category;
  final String? moduleKey;
  final String? addonKey;
  final UserRole? minRole;
}

// Unified with brand theme color: single primary color palette across features.
List<_ModuleItem> get _allModules => <_ModuleItem>[
  _ModuleItem(
    icon: Icons.people_outline,
    label: 'Customers',
    subtitle: 'Profiles, KYC, and loan history',
    route: '/customers',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.core,
  ),
  _ModuleItem(
    icon: Icons.payments_outlined,
    label: 'Collection',
    subtitle: 'Daily dues, route work, and chit contributions',
    route: '/collection',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.core,
  ),
  _ModuleItem(
    icon: Icons.account_balance_wallet_outlined,
    label: 'Cash Float',
    subtitle: 'Agent float & fund release',
    route: '/wallet',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.core,
  ),
  _ModuleItem(
    icon: Icons.fact_check_outlined,
    label: 'Approvals',
    subtitle: 'Review pending requests',
    route: '/approvals',
    moduleKey: 'approvals',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.operations,
  ),
  _ModuleItem(
    icon: Icons.verified_user_outlined,
    label: 'KYC Review',
    subtitle: 'Verify pending customer KYC',
    route: '/kyc-review',
    addonKey: 'kyc',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    minRole: UserRole.admin,
    category: _ModuleCategory.operations,
  ),
  _ModuleItem(
    icon: Icons.warning_amber_rounded,
    label: 'Penalties',
    subtitle: 'Manage & settle overdue fines',
    route: '/penalties',
    moduleKey: 'penalties',
    minRole: UserRole.admin,
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.operations,
  ),
  _ModuleItem(
    icon: Icons.health_and_safety_outlined,
    label: 'NPA Monitoring',
    subtitle: 'Portfolio risk, provisioning & upgrades',
    route: '/npa',
    moduleKey: 'npa',
    addonKey: 'npa',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    minRole: UserRole.admin,
    category: _ModuleCategory.operations,
  ),
  _ModuleItem(
    icon: Icons.bar_chart_rounded,
    label: 'Reports & Analytics',
    subtitle: 'Collection trends & agent performance',
    route: '/analytics',
    moduleKey: 'analytics',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.finance,
  ),
  _ModuleItem(
    icon: Icons.receipt_long_outlined,
    label: 'Reports',
    subtitle: 'Daily, agent, and overdue reports',
    route: '/reports',
    moduleKey: 'reports',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.finance,
  ),
  _ModuleItem(
    icon: Icons.account_balance_outlined,
    label: 'Accounting & P&L',
    subtitle: 'Daily financials, capital & overdue',
    route: '/accounting',
    moduleKey: 'accounting',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.finance,
  ),
  _ModuleItem(
    icon: Icons.workspace_premium_outlined,
    label: 'Gold Pledge Report',
    subtitle: 'Pending interests & pledged weight',
    route: '/gold-reports',
    moduleKey: 'goldloan',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.finance,
  ),
  _ModuleItem(
    icon: Icons.savings_outlined,
    label: 'Chit Funds',
    subtitle: 'Group savings management',
    route: '/chits',
    moduleKey: 'chitfunds',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    category: _ModuleCategory.finance,
  ),
  _ModuleItem(
    icon: Icons.account_balance_rounded,
    label: 'Payment Gateway',
    subtitle: 'UPI & Razorpay for borrower self-pay',
    route: '/settings/payment-gateway',
    color: AppColors.primary,
    bgColor: AppColors.primaryLight,
    minRole: UserRole.developer,
    category: _ModuleCategory.system,
  ),
  _ModuleItem(
    icon: Icons.settings_outlined,
    label: 'Settings',
    subtitle: 'Routes, account & app preferences',
    route: '/settings',
    moduleKey: 'settings',
    color: AppColors.textSecondary,
    bgColor: AppColors.rowHover,
    category: _ModuleCategory.system,
  ),
];

bool _canAccess(_ModuleItem item, User user) {
  final privileged = user.role == UserRole.admin ||
      user.role == UserRole.superadmin ||
      user.role == UserRole.developer;

  final roleOk =
      item.minRole == null || privileged || item.minRole == UserRole.agent;
  if (!roleOk) return false;

  final key = item.moduleKey;
  if (key == null) return true;
  if (user.role == UserRole.developer) return true;

  // Core features are role-gated, not subscription-gated.
  switch (key) {
    // APR-01: agents see their own requests (read-only; server scopes them).
    case 'approvals':
      return true;
    case 'analytics':
    case 'accounting':
    case 'npa':
    case 'settings':
    case 'reports':
      return user.role != UserRole.agent;
  }

  // Everything else is subscription-gated.
  if (user.enabledModules.isNotEmpty) return user.hasModule(key);
  return privileged;
}

// ── Screen ────────────────────────────────────────────────────────────────────

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final user = ref.watch(authControllerProvider).user;
    final simpleMode = ref.watch(simpleModeProvider);

    // Simple mode (U4): field agents see only daily-work items. Admin roles
    // keep the full grid regardless of the toggle - never hides capability.
    // '/customers' counts as daily work — it moved here from the bottom nav.
    const dailyWorkRoutes = {'/customers', '/wallet', '/settings'};
    final visible = user == null
        ? <_ModuleItem>[]
        : _allModules
            .where((m) => _canAccess(m, user))
            .where(
              (m) =>
                  !simpleMode ||
                  user.role != UserRole.agent ||
                  dailyWorkRoutes.contains(m.route),
            )
            .toList();

    // Portal switch module — accessible to superadmin/admin to switch business verticals
    final portalItem = (user?.role == UserRole.superadmin ||
            user?.role == UserRole.admin)
        ? _ModuleItem(
            icon: Icons.apps_rounded,
            label: 'Portal · Switch Module',
            subtitle: 'Auto finance, gold loan, chits and more',
            route: '/portal',
            color: AppColors.primary,
            bgColor: AppColors.primaryLight,
            category: _ModuleCategory.core,
          )
        : null;

    // Logout item is always available at the end of the System category
    const logoutItem = _ModuleItem(
      icon: Icons.logout_outlined,
      label: 'Log out',
      subtitle: 'Sign out of this account',
      route: '',
      color: AppColors.danger,
      bgColor: AppColors.dangerBg,
      category: _ModuleCategory.system,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: ModuleAppBarTitle(
          subtitle: t.x('nav.more'),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          // Single solid theme color hero card
          _ProfileHeader(
            name: user?.name ?? '—',
            role: user?.role.name ?? '',
            tenantSlug: user?.tenantSlug ?? '',
          ),
          const SizedBox(height: 10),

          // Render categorized module sections with single-color cards
          for (final category in _ModuleCategory.values) ...[
            Builder(
              builder: (ctx) {
                final categoryItems = <_ModuleItem>[
                  if (category == _ModuleCategory.core && portalItem != null)
                    portalItem,
                  ...visible.where((m) => m.category == category),
                  if (category == _ModuleCategory.system) logoutItem,
                ];

                if (categoryItems.isEmpty) return const SizedBox.shrink();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionHeader(title: category.title),
                    for (final m in categoryItems)
                      Builder(
                        builder: (itemCtx) {
                          final isLocked = m.addonKey != null &&
                              user != null &&
                              !user.isAddonSubscribed(m.addonKey!);

                          return _ModuleTile(
                            item: m,
                            isLocked: isLocked,
                            onTap: m.route.isEmpty
                                ? () => _confirmLogout(context, ref)
                                : isLocked && m.addonKey != 'npa'
                                    ? () => showPlanUpgradeSheet(
                                          itemCtx,
                                          ref,
                                          featureKey: m.addonKey!,
                                        )
                                    : null,
                            onUpgradeTap: isLocked
                                ? () => showPlanUpgradeSheet(
                                      itemCtx,
                                      ref,
                                      featureKey: m.addonKey!,
                                    )
                                : null,
                          );
                        },
                      ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/more'),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out'),
        content: const Text('Log out of this account?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.danger,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(authControllerProvider.notifier).logout();
    }
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
      child: Row(
        children: [
          Container(
            width: 3.5,
            height: 14,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            title.toUpperCase(),
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.9,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Profile header (Single theme color, zero gradients) ───────────────────────

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
    final roleLabel =
        role.isEmpty ? '' : '${role[0].toUpperCase()}${role.substring(1)}';

    return Container(
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Colors.white.withAlpha(35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withAlpha(75),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: Colors.black.withAlpha(20),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => context.push('/profile'),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                // Solid white avatar badge with theme purple initials
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(25),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    _initials(),
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w800,
                      fontSize: 20,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const SizedBox(width: 14),

                // Name and role / tenant details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Icon(
                            Icons.edit_outlined,
                            size: 15,
                            color: Colors.white.withAlpha(180),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          if (roleLabel.isNotEmpty) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2.5,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(28),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                roleLabel.toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.6,
                                ),
                              ),
                            ),
                          ],
                          if (tenantSlug.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Text(
                              '• $tenantSlug',
                              style: TextStyle(
                                color: Colors.white.withAlpha(180),
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),

                // Sleek online status pill with brand yellow indicator dot
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(24),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.white.withAlpha(40),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: AppColors.brandYellow,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.brandYellow.withAlpha(180),
                              blurRadius: 4,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'ONLINE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Module tile (Solid single-color card, zero gradients) ─────────────────────

class _ModuleTile extends StatelessWidget {
  const _ModuleTile({
    required this.item,
    this.onTap,
    this.isLocked = false,
    this.onUpgradeTap,
  });

  final _ModuleItem item;
  final VoidCallback? onTap;
  final bool isLocked;
  final VoidCallback? onUpgradeTap;

  @override
  Widget build(BuildContext context) {
    final baseColor = isLocked ? AppColors.warning : item.color;
    final effectiveColor = AppColors.isDark
        ? AppColors.readableOnDark(baseColor)
        : baseColor;
    final effectiveBg = AppColors.isDark
        ? Color.alphaBlend(effectiveColor.withAlpha(30), AppColors.surface)
        : (isLocked ? AppColors.warningBg : item.bgColor);

    return AppCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      onTap: onTap ?? () => context.push(item.route),
      child: Row(
        children: [
          // Single solid squircle icon badge
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: effectiveBg,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: effectiveColor.withAlpha(30),
                    width: 1,
                  ),
                ),
                child: Icon(
                  item.icon,
                  color: effectiveColor,
                  size: 24,
                ),
              ),
              if (isLocked)
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Container(
                    padding: const EdgeInsets.all(3.5),
                    decoration: BoxDecoration(
                      color: AppColors.warning,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.warning.withAlpha(120),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.lock_rounded,
                      size: 10,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),

          // Label, subtitle, and optional locked badge
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        item.label,
                        style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.2,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (isLocked) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 2.5,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.warningBg,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: AppColors.warning.withAlpha(100),
                            width: 1,
                          ),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.lock_rounded,
                              size: 10,
                              color: AppColors.warningText,
                            ),
                            SizedBox(width: 3),
                            Text(
                              'LOCKED',
                              style: TextStyle(
                                color: AppColors.warningText,
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  item.subtitle,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w400,
                    color: AppColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Action / navigation indicator
          if (isLocked)
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: onUpgradeTap ?? onTap,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withAlpha(50),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.bolt_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      'Upgrade',
                      style: AppTypography.extraTiny.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.rowHover,
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.border,
                  width: 1,
                ),
              ),
              child: Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textSecondary,
                size: 18,
              ),
            ),
        ],
      ),
    );
  }
}
