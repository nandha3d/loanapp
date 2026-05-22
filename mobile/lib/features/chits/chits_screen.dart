import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

final _chitsProvider = FutureProvider.autoDispose<List<ChitGroup>>(
  (ref) => ref.watch(chitServiceProvider).list(),
);

class ChitsScreen extends ConsumerWidget {
  const ChitsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user != null && user.appType == 'microlending') {
      return Scaffold(
        appBar: AppBar(title: const Text('Chits')),
        body: const EmptyState(
          icon: Icons.lock_outline,
          title: 'Not available',
          subtitle: 'Chit module is disabled for microlending tenants.',
        ),
      );
    }

    final async = ref.watch(_chitsProvider);
    final money =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Chit Groups'), centerTitle: true),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) => list.isEmpty
            ? const EmptyState(
                icon: Icons.groups_outlined,
                title: 'No chit groups',
              )
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async => ref.invalidate(_chitsProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _ChitTile(group: list[i], money: money),
                ),
              ),
      ),
    );
  }
}

class _ChitTile extends StatelessWidget {
  const _ChitTile({required this.group, required this.money});
  final ChitGroup group;
  final NumberFormat money;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppTokens.radius),
      onTap: () => context.push('/chits/${group.id}'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(group.name, style: AppTypography.bodyLarge),
                ),
                AppBadge(
                  label: group.status,
                  kind: group.status == 'active'
                      ? BadgeKind.active
                      : BadgeKind.closed,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${money.format(group.chitValue)} • ${money.format(group.monthlyContrib)}/mo • ${group.durationMonths} months',
              style: AppTypography.bodySmall
                  .copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Text(
              '${group.memberCount}/${group.totalMembers} members • ${group.auctionCount} auctions',
              style: AppTypography.caption,
            ),
          ],
        ),
      ),
    );
  }
}
