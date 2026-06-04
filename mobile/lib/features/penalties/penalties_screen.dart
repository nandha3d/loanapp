import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/data/models/penalty.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/data/services/penalty_service.dart';
import 'package:loantrack/features/loans/widgets/loan_heatmap.dart';
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
    final fmt = ref.watch(currencyFmtProvider);

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

    // Group by customer, then by loan — combine same-loan penalties into one
    // page; a customer with multiple loans becomes a swipeable card.
    final byCustomer = <String, Map<String, List<Penalty>>>{};
    for (final p in filtered) {
      final ck = p.customerCode.isNotEmpty ? p.customerCode : p.customerName;
      final lk = p.loanId.isNotEmpty ? p.loanId : p.loanCode;
      byCustomer
          .putIfAbsent(ck, () => <String, List<Penalty>>{})
          .putIfAbsent(lk, () => <Penalty>[])
          .add(p);
    }
    final customerGroups = byCustomer.values
        .map((m) => m.values.map((ps) => _LoanPenaltyGroup(ps)).toList())
        .toList();

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
                    ),),
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
            ...customerGroups
                .map((loans) => _CustomerPenaltyCard(loans: loans, fmt: fmt)),
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

/// All penalties for one loan, combined into a single set of figures.
class _LoanPenaltyGroup {
  _LoanPenaltyGroup(this.penalties);
  final List<Penalty> penalties;

  Penalty get primary => penalties.first;
  String get loanCode => primary.loanCode;
  String get customerName => primary.customerName;

  double get gross => penalties.fold(0, (s, p) => s + p.grossPenalty);
  double get settled => penalties.fold(0, (s, p) => s + p.settledAmount);
  double get waived => penalties.fold(0, (s, p) => s + p.waivedAmount);
  double get net => gross - settled - waived;

  /// Days the customer skipped on this loan (max across its penalty rows).
  int get skippedDays =>
      penalties.fold(0, (m, p) => p.missedDays > m ? p.missedDays : m);

  String get loanId => primary.loanId;

  List<Penalty> get pending =>
      penalties.where((p) => p.status == 'pending').toList();
  bool get hasPending => pending.isNotEmpty;

  String get status {
    if (hasPending) return 'pending';
    if (penalties.any((p) => p.status == 'waived')) return 'waived';
    return 'settled';
  }
}

/// One card per customer. Penalties of the same loan are combined; a customer
/// with multiple loans becomes a swipeable PageView (single static card if
/// there's only one loan).
class _CustomerPenaltyCard extends ConsumerStatefulWidget {
  const _CustomerPenaltyCard({required this.loans, required this.fmt});
  final List<_LoanPenaltyGroup> loans;
  final NumberFormat fmt;

  @override
  ConsumerState<_CustomerPenaltyCard> createState() =>
      _CustomerPenaltyCardState();
}

class _CustomerPenaltyCardState extends ConsumerState<_CustomerPenaltyCard> {
  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final loans = widget.loans;
    final multi = loans.length > 1;
    final user = ref.watch(authControllerProvider).user;
    final isAdmin = user?.role == UserRole.admin ||
        user?.role == UserRole.superadmin ||
        user?.role == UserRole.developer;

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
          // Shared customer header.
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(loans.first.customerName,
                      style: AppTypography.bodyLarge,),
                ),
                if (multi)
                  Row(
                    children: [
                      const Icon(Icons.swipe, size: 14, color: AppColors.textLight),
                      const SizedBox(width: 4),
                      Text(
                        '${_page + 1}/${loans.length} ${t.x('pen.loans')}',
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          SizedBox(
            height: 150,
            child: PageView.builder(
              controller: _controller,
              itemCount: loans.length,
              physics: multi
                  ? const BouncingScrollPhysics()
                  : const NeverScrollableScrollPhysics(),
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) => _loanPage(t, loans[i], isAdmin),
            ),
          ),
          if (multi)
            Padding(
              padding: const EdgeInsets.only(top: 2, bottom: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(loans.length, (i) {
                  final active = i == _page;
                  return AnimatedContainer(
                    duration: AppTokens.transition,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: active ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: active ? AppColors.primary : AppColors.border,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  );
                }),
              ),
            ),
        ],
      ),
    );
  }

  Widget _loanPage(T t, _LoanPenaltyGroup g, bool isAdmin) {
    final fmt = widget.fmt;
    final BadgeKind badgeKind = g.status == 'settled'
        ? BadgeKind.active
        : g.status == 'waived'
            ? BadgeKind.waived
            : BadgeKind.pending;

    return InkWell(
      onTap: () => _showSkippedDays(g),
      child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                g.loanCode,
                style: AppTypography.caption.copyWith(color: AppColors.primary),
              ),
              if (g.skippedDays > 0) ...[
                const SizedBox(width: 8),
                _SkippedChip(days: g.skippedDays),
              ],
              const Spacer(),
              AppBadge(label: g.status.toUpperCase(), kind: badgeKind),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _AmountCol(label: 'Gross', value: fmt.format(g.gross), color: AppColors.danger),
              _AmountCol(label: 'Settled', value: fmt.format(g.settled), color: AppColors.success),
              _AmountCol(label: 'Waived', value: fmt.format(g.waived), color: AppColors.purple),
              _AmountCol(label: 'Net Due', value: fmt.format(g.net), color: AppColors.warning),
            ],
          ),
          const Spacer(),
          if (g.hasPending)
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _showSettleSheet(g),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.onPrimary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.payments_outlined, size: 18),
                    label: const Text('Settle'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _confirmWaive(g),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.ink,
                      foregroundColor: AppColors.onInk,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.block_outlined, size: 18),
                    label: const Text('Waive'),
                  ),
                ),
              ],
            ),
        ],
      ),
      ),
    );
  }

  /// Loan payment calendar (heatmap) — shows which instalments were skipped.
  void _showSkippedDays(_LoanPenaltyGroup g) {
    final t = T.of(ref);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppTokens.radius)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.62,
        minChildSize: 0.4,
        maxChildSize: 0.92,
        builder: (_, scrollCtrl) => SingleChildScrollView(
          controller: scrollCtrl,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('${g.customerName} · ${g.loanCode}',
                  style: AppTypography.sectionTitle,),
              const SizedBox(height: 4),
              Text(
                '${g.skippedDays} ${t.x('pen.days_skipped')}',
                style: AppTypography.caption
                    .copyWith(color: AppColors.danger, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              FutureBuilder<Loan>(
                future: ref.read(loanServiceProvider).getById(g.loanId),
                builder: (c, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }
                  if (snap.hasError || snap.data == null) {
                    return Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(t.x('pen.heatmap_failed'),
                          style: AppTypography.caption,),
                    );
                  }
                  return LoanHeatmap(
                    instalments: snap.data!.instalments,
                    title: t.x('pen.skipped_calendar'),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Settles [amount] across the loan's pending penalties, oldest first.
  Future<void> _settleGroup(_LoanPenaltyGroup g, double amount) async {
    final svc = ref.read(penaltyServiceProvider);
    final pend = [...g.pending]..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    var remaining = amount;
    for (final p in pend) {
      if (remaining <= 0) break;
      final pNet = p.grossPenalty - p.settledAmount - p.waivedAmount;
      if (pNet <= 0) continue;
      final pay = remaining < pNet ? remaining : pNet;
      await svc.settle(id: p.id, amount: pay);
      remaining -= pay;
    }
  }

  void _showSettleSheet(_LoanPenaltyGroup g) {
    final t = T.of(ref);
    final net = g.net;
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
              '${g.customerName} · ${g.loanCode}',
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
                  await _settleGroup(g, amount);
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

  Future<void> _confirmWaive(_LoanPenaltyGroup g) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _WaiveDialog(
        group: g,
        customerName: g.customerName,
        net: g.net,
      ),
    );
    if (result == true && mounted) {
      ref.invalidate(_penaltiesProvider);
    }
  }
}

class _SkippedChip extends StatelessWidget {
  const _SkippedChip({required this.days});
  final int days;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.danger.withAlpha(28),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.event_busy, size: 12, color: AppColors.danger),
          const SizedBox(width: 4),
          Text('${days}d',
              style: AppTypography.tiny.copyWith(color: AppColors.danger),),
        ],
      ),
    );
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

/// Waives every pending penalty for a loan. The backend waives the full gross
/// of each penalty, so this collects a single reason and applies it to all.
class _WaiveDialog extends ConsumerStatefulWidget {
  const _WaiveDialog({
    required this.group,
    required this.customerName,
    required this.net,
  });
  final _LoanPenaltyGroup group;
  final String customerName;
  final double net;

  @override
  ConsumerState<_WaiveDialog> createState() => _WaiveDialogState();
}

class _WaiveDialogState extends ConsumerState<_WaiveDialog> {
  late final TextEditingController _amountController;
  final _reasonController = TextEditingController();
  final _managerUsernameController = TextEditingController();
  final _managerPasswordController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController(text: widget.net.toStringAsFixed(0));
  }

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    _managerUsernameController.dispose();
    _managerPasswordController.dispose();
    super.dispose();
  }

  Future<void> _waiveGroup(_LoanPenaltyGroup g, double amount, String reason, String? managerUsername, String? managerPassword) async {
    final svc = ref.read(penaltyServiceProvider);
    final pend = [...g.pending]..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    var remaining = amount;
    for (final p in pend) {
      if (remaining <= 0) break;
      final pNet = p.grossPenalty - p.settledAmount - p.waivedAmount;
      if (pNet <= 0) continue;
      final waiveAmt = remaining < pNet ? remaining : pNet;
      await svc.waive(
        id: p.id,
        amount: waiveAmt,
        reason: reason,
        managerUsername: managerUsername,
        managerPassword: managerPassword,
      );
      remaining -= waiveAmt;
    }
  }

  Future<void> _submit() async {
    final t = T.of(ref);
    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0 || amount > widget.net) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${t.x('err.enter_valid_amount')} (max ₹${widget.net.toStringAsFixed(0)})'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.x('pen.reason_required')), backgroundColor: AppColors.warning),
      );
      return;
    }

    final user = ref.read(authControllerProvider).user;
    final isAgent = user?.role == UserRole.agent;
    String? mUser;
    String? mPass;

    if (isAgent) {
      mUser = _managerUsernameController.text.trim();
      mPass = _managerPasswordController.text.trim();
      if (mUser.isEmpty || mPass.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Manager credentials are required for sign-off'),
            backgroundColor: AppColors.warning,
          ),
        );
        return;
      }
    }

    setState(() => _submitting = true);
    try {
      await _waiveGroup(widget.group, amount, reason, mUser, mPass);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t.x('pen.waived')), backgroundColor: AppColors.success),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Waive failed: $e'), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final user = ref.watch(authControllerProvider).user;
    final isAgent = user?.role == UserRole.agent;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radius)),
      title: Text('Waive Penalty - ${widget.customerName}'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Outstanding Penalty: ${fmt.format(widget.net)}',
              style: AppTypography.body.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Amount to Waive',
                prefixIcon: Icon(Icons.currency_rupee, size: 18),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _reasonController,
              decoration: InputDecoration(
                labelText: t.x('pen.waive_reason'),
                border: const OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            if (isAgent) ...[
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  border: Border.all(color: AppColors.danger.withValues(alpha: 0.5)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: AppColors.danger),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Manager Sign-off Required',
                        style: AppTypography.body.copyWith(
                          color: AppColors.danger,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _managerUsernameController,
                decoration: const InputDecoration(
                  labelText: 'Manager Username/Phone',
                  prefixIcon: Icon(Icons.person_outline, size: 18),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _managerPasswordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Manager Password',
                  prefixIcon: Icon(Icons.lock_outline, size: 18),
                  border: OutlineInputBorder(),
                ),
              ),
            ],
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
            backgroundColor: AppColors.ink,
            foregroundColor: AppColors.onInk,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
          ),
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Waive', style: TextStyle(color: AppColors.onInk)),
        ),
      ],
    );
  }
}
