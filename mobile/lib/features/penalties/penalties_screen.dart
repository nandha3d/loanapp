import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/penalty.dart';
import 'package:loantrack/data/services/penalty_service.dart';
import 'package:loantrack/shared/constants/endpoints.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _statusFilter = StateProvider.autoDispose<String>((ref) => 'all');

// Fetch all penalties (no status filter) and filter client-side.
final _penaltiesProvider = FutureProvider.autoDispose<List<Penalty>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.penalties);
  return unwrapEnvelope(
    res,
    (dynamic d) => (d as List<dynamic>)
        .map((e) => Penalty.fromJson(e as Map<String, dynamic>))
        .toList(growable: false),
  );
});

class PenaltiesScreen extends ConsumerWidget {
  const PenaltiesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(_statusFilter);
    final async = ref.watch(_penaltiesProvider);
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(t.x('title.penalties')), centerTitle: true),
      body: async.when(
        loading: () => _buildLoading(),
        error: (e, _) => _ErrorState(message: e.toString(), label: t.x('err.failed_to_load')),
        data: (all) {
          final list = status == 'all'
              ? all
              : all.where((p) => p.status == status).toList();
          return _PenaltiesBody(all: all, filtered: list);
        },
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/penalties'),
    );
  }

  Widget _buildLoading() => ListView(
        padding: const EdgeInsets.all(16),
        children: List.generate(
          5,
          (_) => const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Skeleton(height: 130, borderRadius: AppTokens.radius),
          ),
        ),
      );
}

class _PenaltiesBody extends ConsumerWidget {
  const _PenaltiesBody({required this.all, required this.filtered});
  final List<Penalty> all;
  final List<Penalty> filtered;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(_statusFilter);
    final t = T.of(ref);
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    final totalGross = all.fold<double>(0, (s, p) => s + p.grossPenalty);
    final totalSettled = all.fold<double>(0, (s, p) => s + p.settledAmount);
    final totalWaived = all.fold<double>(0, (s, p) => s + p.waivedAmount);
    final netOutstanding = totalGross - totalSettled - totalWaived;

    String statusLabel(String s) {
      switch (s) {
        case 'all':
          return t.x('status.all');
        case 'pending':
          return t.x('status.pending');
        case 'settled':
          return t.x('pen.settled');
        case 'waived':
          return t.x('pen.waived');
      }
      return s;
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(_penaltiesProvider),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            Expanded(child: _SummaryCard(
              label: t.x('pen.total_gross'),
              value: fmt.format(totalGross),
              color: AppColors.danger,
              bgColor: AppColors.dangerBg,
            )),
            const SizedBox(width: 10),
            Expanded(child: _SummaryCard(
              label: t.x('pen.settled'),
              value: fmt.format(totalSettled),
              color: AppColors.success,
              bgColor: AppColors.successBg,
            )),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _SummaryCard(
              label: t.x('pen.waived'),
              value: fmt.format(totalWaived),
              color: AppColors.purple,
              bgColor: AppColors.purpleBg,
            )),
            const SizedBox(width: 10),
            Expanded(child: _SummaryCard(
              label: t.x('pen.net_outstanding'),
              value: fmt.format(netOutstanding),
              color: AppColors.warning,
              bgColor: AppColors.warningBg,
            )),
          ]),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: ['all', 'pending', 'settled', 'waived'].map((s) {
                final active = status == s;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => ref.read(_statusFilter.notifier).state = s,
                    child: AnimatedContainer(
                      duration: AppTokens.transition,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: active ? AppColors.primary : AppColors.surface,
                        borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
                        border: Border.all(
                          color: active ? AppColors.primary : AppColors.border,
                        ),
                        boxShadow: active ? AppTokens.shadow : null,
                      ),
                      child: Text(
                        statusLabel(s),
                        style: AppTypography.label.copyWith(
                          color: active ? Colors.white : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),
          if (filtered.isEmpty)
            SizedBox(
              height: 200,
              child: EmptyState(
                icon: Icons.check_circle_outline,
                title: status == 'all'
                    ? t.x('pen.no_recorded')
                    : '${t.x('status.no_status_penalties_prefix')} ${statusLabel(status)} ${t.x('pen.suffix')}',
                subtitle: t.x('pen.clean_slate'),
              ),
            )
          else
            ...filtered.map((p) => _PenaltyCard(penalty: p, fmt: fmt)),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.label,
    required this.value,
    required this.color,
    required this.bgColor,
  });
  final String label, value;
  final Color color, bgColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            ),
            child: Icon(Icons.currency_rupee, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: AppTypography.sectionTitle.copyWith(color: color),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                Text(label, style: AppTypography.caption),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PenaltyCard extends ConsumerWidget {
  const _PenaltyCard({required this.penalty, required this.fmt});
  final Penalty penalty;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final net = penalty.grossPenalty - penalty.settledAmount - penalty.waivedAmount;
    final BadgeKind badgeKind = penalty.status == 'settled'
        ? BadgeKind.active
        : penalty.status == 'waived'
            ? BadgeKind.waived
            : BadgeKind.pending;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(penalty.customerName, style: AppTypography.bodyLarge),
                      const SizedBox(height: 2),
                      Text(
                        penalty.loanCode,
                        style: AppTypography.caption
                            .copyWith(color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
                AppBadge(
                  label: penalty.status.toUpperCase(),
                  kind: badgeKind,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.border),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Column(
              children: [
                Row(
                  children: [
                    _AmountCol(
                      label: t.x('pen.gross'),
                      value: fmt.format(penalty.grossPenalty),
                      color: AppColors.danger,
                    ),
                    _AmountCol(
                      label: t.x('pen.settled'),
                      value: fmt.format(penalty.settledAmount),
                      color: AppColors.success,
                    ),
                    _AmountCol(
                      label: t.x('pen.waived'),
                      value: fmt.format(penalty.waivedAmount),
                      color: AppColors.purple,
                    ),
                    _AmountCol(
                      label: t.x('pen.net_due'),
                      value: fmt.format(net),
                      color: AppColors.warning,
                    ),
                  ],
                ),
                if (penalty.status == 'pending') ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () =>
                              _showSettleSheet(context, ref, penalty, net),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primary,
                            side: const BorderSide(color: AppColors.primary),
                            padding:
                                const EdgeInsets.symmetric(vertical: 8),
                          ),
                          child: Text(t.x('btn.settle')),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () =>
                              _confirmWaive(context, ref, penalty),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.purple,
                            side: const BorderSide(color: AppColors.purple),
                            padding:
                                const EdgeInsets.symmetric(vertical: 8),
                          ),
                          child: Text(t.x('btn.waive')),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showSettleSheet(
    BuildContext context,
    WidgetRef ref,
    Penalty p,
    double net,
  ) {
    final t = T.of(ref);
    final ctrl = TextEditingController(text: net.toStringAsFixed(0));
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppTokens.radius)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text(t.x('pen.settle_title'), style: AppTypography.sectionTitle),
            const SizedBox(height: 4),
            Text('${p.customerName} · ${p.loanCode}',
                style: AppTypography.caption),
            const SizedBox(height: 20),
            TextField(
              controller: ctrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: t.x('pen.amount_rupee'),
                prefixIcon: const Icon(Icons.currency_rupee, size: 18),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppTokens.radiusSm),
                  ),
                ),
                onPressed: () async {
                  final amount = double.tryParse(ctrl.text.trim()) ?? 0;
                  if (amount <= 0) return;
                  Navigator.pop(ctx);
                  await ref
                      .read(penaltyServiceProvider)
                      .settle(id: p.id, amount: amount);
                  ref.invalidate(_penaltiesProvider);
                },
                child: Text(
                  t.x('pen.confirm_settle'),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmWaive(
      BuildContext context, WidgetRef ref, Penalty p) async {
    final t = T.of(ref);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTokens.radius)),
        title: Text(t.x('pen.waive_title')),
        content: Text('${t.x('pen.waive_full_prompt')} (${p.customerName})'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t.x('common.cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.purple,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(t.x('btn.waive'), style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      await ref.read(penaltyServiceProvider).waive(p.id);
      ref.invalidate(_penaltiesProvider);
    }
  }
}

class _AmountCol extends StatelessWidget {
  const _AmountCol({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label, value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              style: AppTypography.label.copyWith(color: color),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(label, style: AppTypography.caption),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.label});
  final String message;
  final String label;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: AppColors.textLight),
              const SizedBox(height: 12),
              Text(label, style: AppTypography.sectionTitle),
              const SizedBox(height: 6),
              Text(message,
                  style: AppTypography.body, textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}
