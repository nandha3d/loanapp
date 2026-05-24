import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';

class _ModuleItem {
  const _ModuleItem({
    required this.icon,
    required this.labelKey,
    required this.subtitleKey,
    required this.route,
    required this.color,
    required this.bgColor,
  });
  final IconData icon;
  final String labelKey, subtitleKey, route;
  final Color color, bgColor;
}

const _modules = <_ModuleItem>[
  _ModuleItem(
    icon: Icons.warning_amber_rounded,
    labelKey: 'title.penalties',
    subtitleKey: 'more.penalties_sub',
    route: '/penalties',
    color: AppColors.danger,
    bgColor: AppColors.dangerBg,
  ),
  _ModuleItem(
    icon: Icons.fact_check_outlined,
    labelKey: 'title.approvals',
    subtitleKey: 'more.approvals_sub',
    route: '/approvals',
    color: AppColors.success,
    bgColor: AppColors.successBg,
  ),
  _ModuleItem(
    icon: Icons.bar_chart_rounded,
    labelKey: 'title.analytics',
    subtitleKey: 'more.analytics_sub',
    route: '/analytics',
    color: AppColors.info,
    bgColor: AppColors.infoBg,
  ),
  _ModuleItem(
    icon: Icons.savings_outlined,
    labelKey: 'title.chits',
    subtitleKey: 'more.chits_sub',
    route: '/chits',
    color: AppColors.purple,
    bgColor: AppColors.purpleBg,
  ),
  _ModuleItem(
    icon: Icons.account_balance_outlined,
    labelKey: 'title.accounting',
    subtitleKey: 'more.accounting_sub',
    route: '/accounting',
    color: AppColors.info,
    bgColor: AppColors.infoBg,
  ),
  _ModuleItem(
    icon: Icons.settings_outlined,
    labelKey: 'set.title',
    subtitleKey: 'more.settings_sub',
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
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(t.x('title.more')), centerTitle: true),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _modules.length,
        itemBuilder: (_, i) => _ModuleTile(item: _modules[i], t: t),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/more'),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  const _ModuleTile({required this.item, required this.t});
  final _ModuleItem item;
  final T t;

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
                      Text(t.x(item.labelKey),
                          style: AppTypography.sectionTitle),
                      const SizedBox(height: 3),
                      Text(
                        t.x(item.subtitleKey),
                        style: AppTypography.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.textLight, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
