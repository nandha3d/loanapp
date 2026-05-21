import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/local/collection_queue.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/services/collection_service.dart';
import 'package:loantrack/features/collection/quick_collect_sheet.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final collectionTodayProvider =
    FutureProvider.autoDispose<List<CollectionRow>>((ref) {
  return ref.watch(collectionServiceProvider).today();
});

class CollectionScreen extends ConsumerWidget {
  const CollectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(collectionTodayProvider);
    final sync = ref.watch(collectionSyncProvider);
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Collection'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: sync.online ? AppColors.success : AppColors.danger,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  sync.pending > 0
                      ? '${sync.pending} queued'
                      : (sync.online ? 'Synced' : 'Offline'),
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
        ],
      ),
      body: async.when(
        loading: () => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: 6,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, __) => const Skeleton(height: 78, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: 'Could not load collection',
          subtitle: e.toString(),
        ),
        data: (rows) {
          final byRoute = <String, List<CollectionRow>>{};
          for (final r in rows) {
            byRoute.putIfAbsent(r.routeName ?? '—', () => []).add(r);
          }
          final totalDue = rows.fold<double>(0, (s, r) => s + r.dueAmount);
          final totalCollected =
              rows.fold<double>(0, (s, r) => s + r.receivedAmount);
          final pending = totalDue - totalCollected;
          if (rows.isEmpty) {
            return const EmptyState(
              icon: Icons.calendar_today_outlined,
              title: 'Nothing to collect today',
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.refresh(collectionTodayProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppTokens.radius),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _stat('Total Due', fmt.format(totalDue),
                          AppColors.textPrimary),
                      _stat('Collected', fmt.format(totalCollected),
                          AppColors.success),
                      _stat(
                          'Pending', fmt.format(pending), AppColors.warning),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                for (final entry in byRoute.entries) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(entry.key,
                            style: AppTypography.label
                                .copyWith(color: AppColors.primaryDark)),
                        Text(
                          '${entry.value.length} customers',
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  for (final r in entry.value) ...[
                    _CollectionTile(row: r, fmt: fmt),
                    const SizedBox(height: 6),
                  ],
                  const SizedBox(height: 8),
                ],
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/collection'),
    );
  }

  Widget _stat(String label, String value, Color valueColor) {
    return Column(
      children: [
        Text(value,
            style: AppTypography.bodyLarge
                .copyWith(color: valueColor, fontSize: 14 * 1.1)),
        Text(label, style: AppTypography.caption),
      ],
    );
  }
}

class _CollectionTile extends ConsumerWidget {
  const _CollectionTile({required this.row, required this.fmt});
  final CollectionRow row;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overdue = row.daysOverdue > 0;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(row.customerName,
                    style: AppTypography.bodyLarge,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ),
              if (overdue)
                Text('${row.daysOverdue}d overdue',
                    style: AppTypography.caption
                        .copyWith(color: AppColors.danger)),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(row.loanCode,
                  style: AppTypography.caption.copyWith(
                    fontFamily: 'monospace',
                    color: AppColors.textLight,
                  )),
              Text(fmt.format(row.dueAmount),
                  style: AppTypography.bodyLarge),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text('${fmt.format(row.outstanding)} outstanding',
                    style: AppTypography.bodySmall
                        .copyWith(color: AppColors.warning)),
              ),
              AppButton(
                label: row.status == 'paid' ? 'Paid' : 'Collect',
                size: AppButtonSize.small,
                onPressed: row.status == 'paid'
                    ? null
                    : () => showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => QuickCollectSheet(row: row),
                        ).then((_) =>
                            ref.invalidate(collectionTodayProvider)),
              ),
              const SizedBox(width: 8),
              AppBadge(label: row.status, kind: _kindFor(row.status)),
            ],
          ),
        ],
      ),
    );
  }

  BadgeKind _kindFor(String s) => switch (s) {
        'paid' => BadgeKind.active,
        'partial' => BadgeKind.partial,
        'missed' => BadgeKind.overdue,
        _ => BadgeKind.upcoming,
      };
}
