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
import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _statusFilter = StateProvider.autoDispose<String>((ref) => 'all');
final _routeFilter = StateProvider.autoDispose<String?>((ref) => null);

// Fetch all penalties (no status filter) and filter client-side.
final _penaltiesProvider =
    FutureProvider.autoDispose<List<Penalty>>((ref) async {
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
    final routeFilter = ref.watch(_routeFilter);
    final async = ref.watch(_penaltiesProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Penalties'), centerTitle: true),
      body: async.when(
        loading: () => _buildLoading(),
        error: (e, _) => _ErrorState(message: e.toString()),
        data: (all) {
          final list = all.where((p) {
            final matchStatus = status == 'all' || p.status == status;
            final matchRoute = routeFilter == null || p.routeId == routeFilter;
            return matchStatus && matchRoute;
          }).toList();
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
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    final routeMap = <String, String>{};
    for (final p in all) {
      if (p.routeId != null && p.routeId!.isNotEmpty && p.routeName != null) {
        routeMap[p.routeId!] = p.routeName!;
      }
    }

    final totalGross = all.fold<double>(0, (s, p) => s + p.grossPenalty);
    final totalSettled = all.fold<double>(0, (s, p) => s + p.settledAmount);
    final totalWaived = all.fold<double>(0, (s, p) => s + p.waivedAmount);
    final netOutstanding = totalGross - totalSettled - totalWaived;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(_penaltiesProvider),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: _SummaryCard(
                  label: 'Total Gross',
                  value: fmt.format(totalGross),
                  color: AppColors.danger,
                  bgColor: AppColors.dangerBg,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _SummaryCard(
                  label: 'Settled',
                  value: fmt.format(totalSettled),
                  color: AppColors.success,
                  bgColor: AppColors.successBg,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _SummaryCard(
                  label: 'Waived',
                  value: fmt.format(totalWaived),
                  color: AppColors.purple,
                  bgColor: AppColors.purpleBg,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _SummaryCard(
                  label: 'Net Outstanding',
                  value: fmt.format(netOutstanding),
                  color: AppColors.warning,
                  bgColor: AppColors.warningBg,
                ),
              ),
            ],
          ),
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
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8,),
                      decoration: BoxDecoration(
                        color: active ? AppColors.primary : AppColors.surface,
                        borderRadius:
                            BorderRadius.circular(AppTokens.radiusBadge),
                        border: Border.all(
                          color: active ? AppColors.primary : AppColors.border,
                        ),
                        boxShadow: active ? AppTokens.shadow : null,
                      ),
                      child: Text(
                        s[0].toUpperCase() + s.substring(1),
                        style: AppTypography.label.copyWith(
                          color:
                              active ? Colors.white : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          if (routeMap.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                border: Border.all(color: AppColors.border),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String?>(
                  value: ref.watch(_routeFilter),
                  hint: Text(T.of(ref).x('pen.filter_route')),
                  isExpanded: true,
                  icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.textLight),
                  items: [
                    DropdownMenuItem(value: null, child: Text('All Routes', style: AppTypography.body)),
                    ...routeMap.entries.map((e) => DropdownMenuItem(
                      value: e.key,
                      child: Text(e.value, style: AppTypography.body),
                    )),
                  ],
                  onChanged: (v) => ref.read(_routeFilter.notifier).state = v,
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (filtered.isEmpty)
            SizedBox(
              height: 260,
              child: EmptyState(
                icon: Icons.check_circle_outline,
                title: status == 'all'
                    ? 'No penalties recorded'
                    : 'No $status penalties',
                subtitle: 'Clean slate!',
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
                Text(
                  value,
                  style: AppTypography.sectionTitle.copyWith(color: color),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
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
    final user = ref.watch(authControllerProvider).user;
    final isAdmin = user?.role == UserRole.admin || user?.role == UserRole.developer;

    final net =
        penalty.grossPenalty - penalty.settledAmount - penalty.waivedAmount;
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
                      Text(penalty.customerName,
                          style: AppTypography.bodyLarge,),
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
                      label: 'Gross',
                      value: fmt.format(penalty.grossPenalty),
                      color: AppColors.danger,
                    ),
                    _AmountCol(
                      label: 'Settled',
                      value: fmt.format(penalty.settledAmount),
                      color: AppColors.success,
                    ),
                    _AmountCol(
                      label: 'Waived',
                      value: fmt.format(penalty.waivedAmount),
                      color: AppColors.purple,
                    ),
                    _AmountCol(
                      label: 'Net Due',
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
                            padding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                          child: const Text('Settle'),
                        ),
                      ),
                      if (isAdmin) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _confirmWaive(context, ref, penalty),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.purple,
                              side: const BorderSide(color: AppColors.purple),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                            child: const Text('Waive'),
                          ),
                        ),
                      ],
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
            Text(
              '${p.customerName} · ${p.loanCode}',
              style: AppTypography.caption,
            ),
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
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                ),
                onPressed: () async {
                  final amount = double.tryParse(ctrl.text.trim()) ?? 0;
                  if (amount <= 0) return;
                  if (amount > net) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(
                        content: Text(
                          '${t.x('err.enter_valid_amount')} (max ₹${net.toStringAsFixed(0)})',
                        ),
                        backgroundColor: AppColors.danger,
                      ),
                    );
                    return;
                  }
                  Navigator.pop(ctx);
                  await ref
                      .read(penaltyServiceProvider)
                      .settle(id: p.id, amount: amount);
                  ref.invalidate(_penaltiesProvider);
                },
                child: Text(
                  t.x('pen.confirm_settle'),
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600,),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmWaive(
    BuildContext context,
    WidgetRef ref,
    Penalty p,
  ) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _WaiveDialog(penalty: p),
    );
    if (result == true && context.mounted) {
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
          Text(
            value,
            style: AppTypography.label.copyWith(color: color),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(label, style: AppTypography.caption),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: AppColors.textLight),
              const SizedBox(height: 12),
              Text('Failed to load', style: AppTypography.sectionTitle),
              const SizedBox(height: 6),
              Text(
                message,
                style: AppTypography.body,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
}

class _WaiveDialog extends ConsumerStatefulWidget {
  const _WaiveDialog({required this.penalty});
  final Penalty penalty;

  @override
  ConsumerState<_WaiveDialog> createState() => _WaiveDialogState();
}

class _WaiveDialogState extends ConsumerState<_WaiveDialog> {
  late final TextEditingController _amountController;
  final _reasonController = TextEditingController();
  bool _fullWaive = true;
  bool _submitting = false;

  double get _outstanding => widget.penalty.grossPenalty - widget.penalty.settledAmount - widget.penalty.waivedAmount;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController(text: _outstanding.toStringAsFixed(0));
  }

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = T.of(ref);
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.x('pen.reason_required')), backgroundColor: AppColors.warning),
      );
      return;
    }

    final amt = double.tryParse(_amountController.text) ?? 0;
    if (amt <= 0 || amt > _outstanding) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid amount'), backgroundColor: AppColors.warning),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(penaltyServiceProvider).waive(
        id: widget.penalty.id,
        amount: amt,
        reason: reason,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t.x('pen.waived')), backgroundColor: AppColors.success),
        );
        Navigator.pop(context, true);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radius)),
      title: Text('Waive Penalty - ${widget.penalty.customerName}'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(t.x('pen.waive_full'), style: AppTypography.body),
              value: _fullWaive,
              onChanged: (v) {
                setState(() {
                  _fullWaive = v ?? true;
                  if (_fullWaive) {
                    _amountController.text = _outstanding.toStringAsFixed(0);
                  }
                });
              },
            ),
            if (!_fullWaive) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: t.x('pen.waive_amount'),
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 16),
            TextField(
              controller: _reasonController,
              decoration: InputDecoration(
                labelText: t.x('pen.waive_reason'),
                border: const OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.purple,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
          ),
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Waive', style: TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
