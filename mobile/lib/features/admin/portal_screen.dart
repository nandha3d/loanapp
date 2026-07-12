import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:loantrack/data/models/user.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

/// Immersive app-selector landing — the mobile twin of the web `/portal`
/// page. Superadmins/admins land here after login: a dark gradient hub with
/// one glassmorphic card per subscribed vertical, plus Quick Access and
/// System Administration shortcuts. Picking a card sets the active appType
/// and drops into that module.
final _verticalsProvider =
    FutureProvider.autoDispose<List<String>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.me);
  final data = res.data?['data'] as Map<String, dynamic>?;
  return (data?['verticals'] as List<dynamic>? ?? const [])
      .whereType<String>()
      .toList(growable: false);
});

// Portal palette — fixed brand colors matching the web app-selector, not the
// (mutable) themed AppColors, so both platforms read identically.
const _kPortalTop = Color(0xFF1A1A2E);
const _kPortalMid = Color(0xFF16213E);
const _kPortalBottom = Color(0xFF0F3460);
const _kGlass = Color(0x0DFFFFFF); // white @ 5%
const _kGlassHi = Color(0x1FFFFFFF); // white @ 12%
const _kGlassBorder = Color(0x1AFFFFFF); // white @ 10%
const _kWhite70 = Color(0xB3FFFFFF);
const _kWhite60 = Color(0x99FFFFFF);
const _kWhite50 = Color(0x80FFFFFF);

class _VerticalDef {
  const _VerticalDef(
      this.key, this.title, this.description, this.icon, this.color);
  final String key;
  final String title;
  final String description;
  final IconData icon;
  final Color color;
}

// App cards — same order, copy, icons and accent colors as appConfig.ts.
const _verticalDefs = <_VerticalDef>[
  _VerticalDef(
    AppType.microlending,
    'Micro Lending',
    'Manage micro-loans, collections, penalties, and customer portfolios.',
    Icons.account_balance_rounded,
    Color(0xFFE67E22),
  ),
  _VerticalDef(
    AppType.autofinance,
    'Auto Finance',
    'Vehicle financing, EMI management, and auto loan tracking.',
    Icons.directions_car_rounded,
    Color(0xFF2980B9),
  ),
  _VerticalDef(
    AppType.chitfunds,
    'Chit Funds',
    'Chit fund management, auctions, and member tracking.',
    Icons.savings_rounded,
    Color(0xFF27AE60),
  ),
  _VerticalDef(
    AppType.goldloan,
    'Gold Loan',
    'Gold-backed lending, valuation, LTV, packets, pledges, and release tracking.',
    Icons.workspace_premium_rounded,
    Color(0xFFB8860B),
  ),
  _VerticalDef(
    AppType.property,
    'Property Loan',
    'Property-backed lending with mortgage document management and release tracking.',
    Icons.home_work_rounded,
    Color(0xFF7D3C98),
  ),
  _VerticalDef(
    AppType.productfinance,
    'Product Finance',
    'Consumer-durable and product financing with dealer and EMI tracking.',
    Icons.shopping_bag_rounded,
    Color(0xFF16A085),
  ),
];

class PortalScreen extends ConsumerWidget {
  const PortalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final verticalsAsync = ref.watch(_verticalsProvider);

    final role = user?.role;
    final isAgent = role == UserRole.agent;
    final isAdminish = role == UserRole.superadmin ||
        role == UserRole.admin ||
        role == UserRole.developer;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_kPortalTop, _kPortalMid, _kPortalBottom],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, box) {
              // 2-up grid on wider phones/tablets, single column on compact.
              final cols = box.maxWidth >= 620 ? 2 : 1;
              return CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _TopBar(ref: ref)),
                  SliverToBoxAdapter(
                      child: _Header(userName: user?.name ?? 'Admin')),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                    sliver: verticalsAsync.when(
                      loading: () => const SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 40),
                          child: Center(
                              child: CircularProgressIndicator(
                                  color: Colors.white)),
                        ),
                      ),
                      error: (_, __) => _appGrid(
                        context,
                        ref,
                        [user?.appType ?? AppType.microlending],
                        cols,
                      ),
                      data: (verticals) => _appGrid(
                        context,
                        ref,
                        verticals.isEmpty
                            ? [user?.appType ?? AppType.microlending]
                            : verticals,
                        cols,
                      ),
                    ),
                  ),
                  if (!isAgent)
                    SliverToBoxAdapter(
                      child: _Section(
                        title: 'Quick Access',
                        children: [
                          _ActionTile(
                            icon: Icons.payments_rounded,
                            color: const Color(0xFF27AE60),
                            title: 'My Collections',
                            subtitle: 'View and manage collections',
                            onTap: () => context.go('/collection'),
                          ),
                          _ActionTile(
                            icon: Icons.people_rounded,
                            color: const Color(0xFF2980B9),
                            title: 'My Customers',
                            subtitle: 'View assigned customers',
                            onTap: () => context.go('/customers'),
                          ),
                          _ActionTile(
                            icon: Icons.account_balance_wallet_rounded,
                            color: const Color(0xFFF5A623),
                            title: 'My Loans',
                            subtitle: 'View loan details',
                            onTap: () => context.go('/loans'),
                          ),
                          _ActionTile(
                            icon: Icons.dashboard_rounded,
                            color: const Color(0xFF9B59B6),
                            title: 'My Dashboard',
                            subtitle: 'View stats and overview',
                            onTap: () => context.go('/dashboard'),
                          ),
                        ],
                      ),
                    ),
                  if (isAdminish)
                    SliverToBoxAdapter(
                      child: _Section(
                        title: 'System Administration',
                        children: [
                          _ActionTile(
                            icon: Icons.manage_accounts_rounded,
                            color: const Color(0xFFF5A623),
                            title: role == UserRole.admin
                                ? 'User Management'
                                : 'Master User Management',
                            subtitle: role == UserRole.admin
                                ? 'Manage agents for your branch'
                                : 'Manage roles across all apps',
                            onTap: () => context.push(
                                role == UserRole.developer || role == UserRole.superadmin
                                    ? '/admin/users'
                                    : '/admin/team'),
                          ),
                          if (role == UserRole.developer ||
                              role == UserRole.superadmin)
                            _ActionTile(
                              icon: Icons.store_mall_directory_rounded,
                              color: const Color(0xFF2980B9),
                              title: 'Branch Management',
                              subtitle: 'Branches and module access',
                              onTap: () => context.push('/admin/branches'),
                            ),
                          _ActionTile(
                            icon: Icons.receipt_long_rounded,
                            color: const Color(0xFF9B59B6),
                            title: role == UserRole.developer
                                ? 'Billing & Subscriptions'
                                : 'My Subscription',
                            subtitle: role == UserRole.developer
                                ? 'Manage tenant plans and limits'
                                : 'View plan details and usage',
                            onTap: () => context.push(
                                role == UserRole.developer
                                    ? '/admin/billing'
                                    : '/portal/billing'),
                          ),
                        ],
                      ),
                    ),
                  const SliverToBoxAdapter(child: SizedBox(height: 28)),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _appGrid(
    BuildContext context,
    WidgetRef ref,
    List<String> enabled,
    int cols,
  ) {
    final normalized = enabled.map(AppType.normalize).toSet();
    final defs =
        _verticalDefs.where((d) => normalized.contains(d.key)).toList();
    if (defs.isEmpty) {
      return SliverToBoxAdapter(
        child: _EmptyApps(),
      );
    }
    return SliverGrid(
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: cols,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
        // Taller than wide on single column, squarer on 2-up.
        childAspectRatio: cols == 1 ? 2.6 : 1.15,
      ),
      delegate: SliverChildBuilderDelegate(
        (context, i) {
          final def = defs[i];
          return _AppCard(
            def: def,
            compact: cols == 1,
            onTap: () async {
              await ref
                  .read(authControllerProvider.notifier)
                  .setActiveAppType(def.key);
              if (context.mounted) {
                context.go(AppType.landingRoute(def.key));
              }
            },
          );
        },
        childCount: defs.length,
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.ref});
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 0),
      child: Row(
        children: [
          // LoanTrack wordmark, small.
          Text.rich(
            TextSpan(
              style: AppTypography.sectionTitle.copyWith(color: Colors.white),
              children: const [
                TextSpan(text: 'Loan'),
                TextSpan(
                    text: 'Track',
                    style: TextStyle(color: Color(0xFFF5A623))),
              ],
            ),
          ),
          const Spacer(),
          TextButton.icon(
            style: TextButton.styleFrom(
              foregroundColor: Colors.white,
              backgroundColor: _kGlassHi,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: const BorderSide(color: _kGlassBorder),
              ),
            ),
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: Text(t.x('set.logout')),
            onPressed: () =>
                ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.userName});
  final String userName;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            'Welcome, $userName',
            textAlign: TextAlign.center,
            style: AppTypography.heroNumber
                .copyWith(color: Colors.white, fontSize: 28),
          ),
          const SizedBox(height: 6),
          Text(
            'Select an application to manage',
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(color: _kWhite60),
          ),
        ],
      ),
    );
  }
}

class _AppCard extends StatelessWidget {
  const _AppCard({
    required this.def,
    required this.compact,
    required this.onTap,
  });
  final _VerticalDef def;
  final bool compact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final iconSquare = Container(
      width: 60,
      height: 60,
      decoration: BoxDecoration(
        color: def.color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: def.color.withAlpha(90), blurRadius: 16),
        ],
      ),
      child: Icon(def.icon, color: Colors.white, size: 30),
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: BoxDecoration(
            color: _kGlass,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: _kGlassBorder),
          ),
          child: Padding(
            padding: EdgeInsets.all(compact ? 16 : 22),
            child: compact
                ? Row(
                    children: [
                      iconSquare,
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(def.title,
                                style: AppTypography.sectionTitle
                                    .copyWith(color: Colors.white)),
                            const SizedBox(height: 4),
                            Text(
                              def.description,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.caption
                                  .copyWith(color: _kWhite50, height: 1.4),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          color: _kWhite50),
                    ],
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      iconSquare,
                      const SizedBox(height: 16),
                      Text(def.title,
                          textAlign: TextAlign.center,
                          style: AppTypography.sectionTitle
                              .copyWith(color: Colors.white)),
                      const SizedBox(height: 8),
                      Text(
                        def.description,
                        textAlign: TextAlign.center,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.caption
                            .copyWith(color: _kWhite50, height: 1.5),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _EmptyApps extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
      decoration: BoxDecoration(
        color: _kGlass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kGlassBorder),
      ),
      child: Column(
        children: [
          const Icon(Icons.apps_rounded, color: _kWhite70, size: 36),
          const SizedBox(height: 10),
          Text('No application access assigned',
              textAlign: TextAlign.center,
              style: AppTypography.sectionTitle.copyWith(color: Colors.white)),
          const SizedBox(height: 8),
          Text(
            'Ask an administrator to assign this user to an active branch and module.',
            textAlign: TextAlign.center,
            style: AppTypography.caption.copyWith(color: _kWhite50),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 32, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              title.toUpperCase(),
              style: AppTypography.caption.copyWith(
                color: _kWhite50,
                letterSpacing: 1.2,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const Divider(color: _kGlassBorder, height: 1),
          const SizedBox(height: 12),
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            children[i],
          ],
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          decoration: BoxDecoration(
            color: _kGlass,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _kGlassBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: color.withAlpha(38),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: AppTypography.bodyLarge.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w600)),
                      Text(subtitle,
                          style:
                              AppTypography.caption.copyWith(color: _kWhite50)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: _kWhite50),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
