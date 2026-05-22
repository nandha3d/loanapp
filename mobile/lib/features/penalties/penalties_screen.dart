import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/penalty.dart';
import 'package:loantrack/data/services/penalty_service.dart';
import 'package:loantrack/features/penalties/penalty_settle_sheet.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

final _penaltiesProvider = FutureProvider.autoDispose<List<Penalty>>(
  (ref) => ref.watch(penaltyServiceProvider).list(status: 'pending'),
);

class PenaltiesScreen extends ConsumerWidget {
  const PenaltiesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_penaltiesProvider);
    final money =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final df = DateFormat('MMM d');
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Penalties'), centerTitle: true),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) => list.isEmpty
            ? const EmptyState(
                icon: Icons.gpp_good_outlined,
                title: 'No pending penalties',
                subtitle: 'Penalties auto-create when instalments are missed.',
              )
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async => ref.invalidate(_penaltiesProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final p = list[i];
                    final due = p.grossPenalty - p.settledAmount - p.waivedAmount;
                    return Container(
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
                                child: Text(p.customerName,
                                    style: AppTypography.bodyLarge),
                              ),
                              AppBadge(
                                label: p.status,
                                kind: p.status == 'pending'
                                    ? BadgeKind.pending
                                    : p.status == 'waived'
                                        ? BadgeKind.waived
                                        : BadgeKind.active,
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${p.loanCode} • ${p.customerCode}',
                            style: AppTypography.extraTiny.copyWith(
                              fontFamily: 'monospace',
                              color: AppColors.textLight,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text('Outstanding',
                                        style: AppTypography.caption),
                                    Text(
                                      money.format(due),
                                      style: AppTypography.bodyLarge.copyWith(
                                        color: AppColors.warning,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Text(df.format(p.createdAt),
                                  style: AppTypography.extraTiny),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: AppButton(
                                  label: 'Waive',
                                  variant: AppButtonVariant.secondary,
                                  expand: true,
                                  onPressed: () => _waive(context, ref, p),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                flex: 2,
                                child: AppButton(
                                  label: 'Settle',
                                  expand: true,
                                  onPressed: () =>
                                      _settle(context, ref, p, due),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }

  Future<void> _settle(
      BuildContext context, WidgetRef ref, Penalty p, double due) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PenaltySettleSheet(penalty: p, due: due),
    );
    if (ok == true) ref.invalidate(_penaltiesProvider);
  }

  Future<void> _waive(BuildContext context, WidgetRef ref, Penalty p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Waive penalty?'),
        content: Text('Waive penalty for ${p.customerName}? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Waive'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(penaltyServiceProvider).waive(p.id);
      ref.invalidate(_penaltiesProvider);
    } on Object catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}
