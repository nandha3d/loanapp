import 'dart:typed_data';
import 'package:printing/printing.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/instalment.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/features/loans/gold_servicing_sheet.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/features/collection/quick_collect_sheet.dart';
import 'package:loantrack/features/loans/widgets/loan_heatmap.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final loanDetailProvider =
    FutureProvider.autoDispose.family<Loan, String>((ref, id) {
  return ref.watch(loanServiceProvider).getById(id);
});

final _customerLoansProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, customerId) {
  return ref.watch(loanServiceProvider).list(customerId: customerId);
});

double _dueNowForLoan(Loan loan) {
  final today = DateTime.now();
  final todayStart = DateTime(today.year, today.month, today.day);
  return loan.instalments.where((inst) {
    final due =
        DateTime(inst.dueDate.year, inst.dueDate.month, inst.dueDate.day);
    return !due.isAfter(todayStart) && inst.dynamicStatus != 'paid';
  }).fold<double>(0, (sum, inst) {
    final outstanding = inst.dueAmount - inst.receivedAmount;
    return sum + (outstanding > 0 ? outstanding : 0);
  });
}

class LoanDetailScreen extends ConsumerWidget {
  const LoanDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(loanDetailProvider(id));
    final t = T.of(ref);

    final loaded = async.valueOrNull;
    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('title.loan_details')),
        centerTitle: true,
        actions: [
          if (loaded != null && loaded.loanType == 'gold')
            IconButton(
              icon: const Icon(Icons.workspace_premium_outlined),
              tooltip: 'Gold servicing',
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => GoldServicingSheet(loanId: loaded.id),
              ),
            ),
          if (loaded != null &&
              loaded.status != 'closed' &&
              ref.read(authControllerProvider).user?.role != UserRole.agent)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: t.x('loan.edit_title'),
              onPressed: () =>
                  context.push('/loans/${loaded.id}/edit', extra: loaded),
            ),
        ],
      ),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Skeleton(height: 200, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: t.x('err.could_not_load_loan'),
          subtitle: e.toString(),
        ),
        data: (loan) => _LoanBody(loan: loan),
      ),
      bottomNavigationBar: loaded == null ? null : _LoanBottomBar(loan: loaded),
    );
  }
}

class _LoanBody extends ConsumerStatefulWidget {
  const _LoanBody({required this.loan});
  final Loan loan;

  @override
  ConsumerState<_LoanBody> createState() => _LoanBodyState();
}

class _LoanBodyState extends ConsumerState<_LoanBody> {
  final _scrollCtrl = ScrollController();
  final _pageCtrl = PageController();
  final _rowKeys = <int, GlobalKey>{};
  int? _highlight;
  String _viewMode = 'actual';
  bool _showRestructuredRates = false;
  int _currentSummaryPage = 0;

  @override
  void dispose() {
    _scrollCtrl.dispose();
    _pageCtrl.dispose();
    super.dispose();
  }

  void _jumpTo(int instalmentNo) {
    final key = _rowKeys[instalmentNo];
    final ctx = key?.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOutCubic,
      alignment: 0.2,
    );
    setState(() => _highlight = instalmentNo);
    Future<void>.delayed(const Duration(milliseconds: 1800), () {
      if (!mounted) return;
      setState(() => _highlight = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final loan = widget.loan;
    final fmt = ref.watch(currencyFmtProvider);
    final paid =
        loan.instalments.where((i) => i.dynamicStatus == 'paid').length;
    final progress =
        loan.instalmentCount == 0 ? 0.0 : paid / loan.instalmentCount;

    final displayInstalments = _computeDisplayInstalments(loan);

    return ListView(
      controller: _scrollCtrl,
      padding: const EdgeInsets.all(16),
      children: [
        _BorrowerHeader(loan: loan),
        const SizedBox(height: 12),
        _LoanPillRow(loan: loan),
        const SizedBox(height: 14),
        _buildSummaryCards(loan, fmt, progress, paid),
        const SizedBox(height: 14),
        LoanHeatmap(
          instalments: displayInstalments,
          onJump: _jumpTo,
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            boxShadow: AppTokens.shadow,
          ),
          child: Column(
            children: [
              _buildListControls(ref),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Consumer(
                    builder: (ctx, ref, _) => Text(
                      T.of(ref).x('loan.payment_schedule'),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),
              // Column headers
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: const BoxDecoration(
                  color: AppColors.background,
                  border: Border(
                    bottom: BorderSide(color: AppColors.border),
                  ),
                ),
                child: Consumer(
                  builder: (ctx, ref, _) {
                    final t = T.of(ref);
                    return Row(
                      children: [
                        SizedBox(
                          width: 30,
                          child: Text(
                            '#',
                            style: AppTypography.tiny
                                .copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: Text(
                            t.x('loan.col_date'),
                            style: AppTypography.tiny
                                .copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(
                            t.x('loan.col_due'),
                            style: AppTypography.tiny.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                            textAlign: TextAlign.right,
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(
                            t.x('loan.col_received'),
                            style: AppTypography.tiny.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                            textAlign: TextAlign.right,
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 70,
                          child: Text(
                            t.x('loan.col_status'),
                            style: AppTypography.tiny
                                .copyWith(fontWeight: FontWeight.w700),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(width: 4),
                        SizedBox(
                          width: 48,
                          child: Text(
                            t.x('loan.col_action'),
                            style: AppTypography.tiny
                                .copyWith(fontWeight: FontWeight.w700),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const Spacer(),
                      ],
                    );
                  },
                ),
              ),
              ...displayInstalments.map(
                (inst) => _InstalmentRow(
                  key: _rowKeys.putIfAbsent(
                    inst.instalmentNo,
                    GlobalKey.new,
                  ),
                  inst: inst,
                  loan: loan,
                  fmt: fmt,
                  highlighted: _highlight == inst.instalmentNo,
                  isRestructured: _showRestructuredRates,
                  // Server-computed (lib/restructure.ts) — no client math.
                  restructuredAmount: inst.restructuredAmount ?? inst.dueAmount,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  List<Instalment> _computeDisplayInstalments(Loan loan) {
    if (_viewMode == 'actual') return loan.instalments;

    final dist = loan.instalments.map((i) => i.copyWith()).toList();
    double remaining =
        loan.instalments.fold(0.0, (sum, i) => sum + i.receivedAmount);
    final today = DateTime.now();
    final todayStart = DateTime(today.year, today.month, today.day);

    for (var i = 0; i < dist.length; i++) {
      final due = dist[i].dueAmount;
      if (remaining >= due) {
        dist[i] = dist[i].copyWith(receivedAmount: due, status: 'paid');
        remaining -= due;
      } else if (remaining > 0) {
        dist[i] =
            dist[i].copyWith(receivedAmount: remaining, status: 'partial');
        remaining = 0;
      } else {
        final dDate = DateTime(
            dist[i].dueDate.year, dist[i].dueDate.month, dist[i].dueDate.day);
        dist[i] = dist[i].copyWith(
          receivedAmount: 0,
          status: dDate.isBefore(todayStart) ? 'missed' : 'upcoming',
        );
      }
    }
    return dist;
  }

  Widget _buildListControls(WidgetRef ref) {
    final t = T.of(ref);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              _buildSegment('actual', t.x('loan.actual')),
              _buildSegment('distributed', t.x('loan.distributed')),
            ],
          ),
          Row(
            children: [
              Checkbox(
                value: _showRestructuredRates,
                onChanged: (v) =>
                    setState(() => _showRestructuredRates = v ?? false),
                activeColor: AppColors.primary,
                visualDensity: VisualDensity.compact,
              ),
              Text(
                t.x('loan.show_restructured_rate'),
                style: AppTypography.tiny.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSegment(String mode, String label) {
    final active = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active
              ? AppColors.primary.withValues(alpha: 0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? AppColors.primary : AppColors.border,
          ),
        ),
        margin: const EdgeInsets.only(right: 8),
        child: Text(
          label,
          style: AppTypography.caption.copyWith(
            fontWeight: FontWeight.w700,
            color: active ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCards(
      Loan loan, NumberFormat fmt, double progress, int paid) {
    return Column(
      children: [
        SizedBox(
          height: 230,
          child: PageView(
            controller: _pageCtrl,
            onPageChanged: (i) => setState(() => _currentSummaryPage = i),
            children: [
              _SummaryCardOverview(loan: loan, fmt: fmt, progress: progress),
              _SummaryCardMetrics(
                  loan: loan, fmt: fmt, progress: progress, paid: paid),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(2, (i) {
            final active = _currentSummaryPage == i;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              height: 6,
              width: active ? 16 : 6,
              decoration: BoxDecoration(
                color: active ? AppColors.primary : AppColors.border,
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _SummaryCardOverview extends ConsumerWidget {
  const _SummaryCardOverview({
    required this.loan,
    required this.fmt,
    required this.progress,
  });
  final Loan loan;
  final NumberFormat fmt;
  final double progress;

  BadgeKind _badge(String s) => switch (s) {
        'active' => BadgeKind.active,
        'overdue' => BadgeKind.overdue,
        'closed' => BadgeKind.closed,
        'pending_review' || 'pending' => BadgeKind.pending,
        _ => BadgeKind.info,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final pct = (progress * 100).round();
    final totalCollected = loan.totalCollected;
    final totalRepayable = loan.totalPayable;
    final outstanding = totalRepayable - totalCollected;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(loan.loanCode, style: AppTypography.bodyLarge),
              AppBadge(label: loan.status, kind: _badge(loan.status)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              if (loan.customer?.photoUrl != null &&
                  loan.customer!.photoUrl!.isNotEmpty)
                CircleAvatar(
                  radius: 30,
                  backgroundImage: NetworkImage(loan.customer!.photoUrl!),
                )
              else
                CircleAvatar(
                  radius: 30,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  child: Text(
                    loan.customer?.initials ?? '?',
                    style: TextStyle(
                        color: AppColors.primary, fontWeight: FontWeight.bold),
                  ),
                ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      loan.customer?.name ?? '—',
                      style: AppTypography.body
                          .copyWith(fontWeight: FontWeight.w700),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      loan.customer?.customerCode ?? '',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
              ),
              // Circular progress
              Container(
                width: 60,
                height: 60,
                decoration: const BoxDecoration(shape: BoxShape.circle),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CircularProgressIndicator(
                      value: progress.clamp(0.0, 1.0),
                      strokeWidth: 5,
                      backgroundColor: AppColors.border,
                      valueColor: AlwaysStoppedAnimation(AppColors.primary),
                    ),
                    Center(
                      child: Text(
                        '$pct%',
                        style: AppTypography.body.copyWith(
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.x('loan.lbl_principal').toUpperCase(),
                        style: AppTypography.tiny.copyWith(
                            color: AppColors.textLight,
                            fontWeight: FontWeight.w600)),
                    Text(fmt.format(loan.principalAmount),
                        style: AppTypography.bodyLarge
                            .copyWith(color: AppColors.textPrimary)),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(t.x('loan.lbl_outstanding').toUpperCase(),
                        style: AppTypography.tiny.copyWith(
                            color: AppColors.textLight,
                            fontWeight: FontWeight.w600)),
                    Text(fmt.format(outstanding),
                        style: AppTypography.bodyLarge
                            .copyWith(color: AppColors.danger)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryCardMetrics extends ConsumerWidget {
  const _SummaryCardMetrics({
    required this.loan,
    required this.fmt,
    required this.progress,
    required this.paid,
  });
  final Loan loan;
  final NumberFormat fmt;
  final double progress;
  final int paid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final totalCollected = loan.totalCollected;
    final perInstalment = loan.perInstalment;
    final totalRepayable = loan.totalPayable;
    final outstanding = totalRepayable - totalCollected;
    final dueNow = _dueNowForLoan(loan);

    final dynamicRemainingCount =
        perInstalment > 0 ? (outstanding / perInstalment).ceil() : 0;
    final dynamicPaidCount = (loan.instalmentCount - dynamicRemainingCount)
        .clamp(0, loan.instalmentCount);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    _StatBlock(t.x('loan.lbl_principal'),
                        fmt.format(loan.principalAmount)),
                    _StatBlock(
                        t.x('loan.lbl_repayable'), fmt.format(totalRepayable),
                        valueColor: AppColors.primaryDark),
                    _StatBlock(t.x('loan.lbl_disbursed'),
                        fmt.format(loan.disbursedAmount)),
                    _StatBlock(t.x('loan.lbl_frequency'), loan.frequency),
                    _StatBlock(t.x('loan.lbl_tenure'),
                        '${loan.instalmentCount} ${t.x('loan.val_days')}'),
                    _StatBlock(t.x('loan.lbl_start_date'),
                        DateFormat('dd MMM yyyy').format(loan.startDate)),
                    _StatBlock(
                        t.x('loan.lbl_per_inst'), fmt.format(perInstalment)),
                    _StatBlock(
                        t.x('loan.lbl_collected'), fmt.format(totalCollected),
                        valueColor: AppColors.success),
                    _StatBlock('Due now', fmt.format(dueNow),
                        valueColor: AppColors.warning),
                    _StatBlock(
                        t.x('loan.lbl_outstanding'), fmt.format(outstanding),
                        valueColor: AppColors.danger),
                    _StatBlock(t.x('loan.lbl_paid_period'),
                        '$dynamicPaidCount ${t.x('loan.val_days')}',
                        valueColor: AppColors.success),
                    _StatBlock(t.x('loan.lbl_remaining'),
                        '$dynamicRemainingCount ${t.x('loan.val_days')}',
                        valueColor: AppColors.danger),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatBlock extends StatelessWidget {
  const _StatBlock(this.label, this.value, {this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: (MediaQuery.of(context).size.width - 32 - 16 - 70 - 16 - 16) /
          2, // approximate half width minus paddings
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.tiny.copyWith(
              color: AppColors.textLight,
              letterSpacing: 0.5,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTypography.body.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: valueColor ?? AppColors.textPrimary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// Restructured rate is now computed server-side (lib/restructure.ts) and arrives
// per-instalment as `Instalment.restructuredAmount` — no client recomputation.

class _InstalmentRow extends ConsumerWidget {
  const _InstalmentRow({
    super.key,
    required this.inst,
    required this.loan,
    required this.fmt,
    required this.highlighted,
    this.isRestructured = false,
    this.restructuredAmount = 0,
  });
  final Instalment inst;
  final Loan loan;
  final NumberFormat fmt;
  final bool highlighted;
  final bool isRestructured;
  final double restructuredAmount;

  BadgeKind _badgeKind(String dynStatus) => switch (dynStatus) {
        'paid' => BadgeKind.active,
        'partial' => BadgeKind.partial,
        'missed' => BadgeKind.overdue,
        'due_today' => BadgeKind.pending,
        _ => BadgeKind.upcoming,
      };

  String _statusLabel(String dynStatus, T t) => switch (dynStatus) {
        'paid' => t.x('coll.filter_paid'),
        'partial' => t.x('coll.status_partial'),
        'missed' => t.x('coll.status_overdue_days'),
        'due_today' => t.x('coll.status_due_today'),
        _ => t.x('loan.upcoming'),
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final dynStatus = inst.dynamicStatus;
    final kind = _badgeKind(dynStatus);
    final dateFmt = DateFormat('dd MMM');
    final timeFmt = DateFormat('h:mm a');
    final isPaid = inst.receivedAmount > 0;
    final collectedTime =
        inst.receivedAt != null ? timeFmt.format(inst.receivedAt!) : null;

    // Determine if Pay button should show
    final canPay = loan.status != 'closed' &&
        dynStatus != 'paid' &&
        dynStatus != 'partial';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: highlighted
            ? AppColors.primaryLight
            : (dynStatus == 'paid'
                ? AppColors.background.withAlpha(128)
                : Colors.transparent),
        border: const Border(
          bottom: BorderSide(color: AppColors.border),
        ),
      ),
      child: Row(
        children: [
          // # column
          SizedBox(
            width: 30,
            child: Text(
              '${inst.instalmentNo}',
              style: AppTypography.caption.copyWith(
                color: AppColors.textLight,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          // Date + Time column
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dateFmt.format(inst.dueDate),
                  style: AppTypography.body.copyWith(fontSize: 12.5),
                ),
                if (collectedTime != null)
                  Text(
                    collectedTime,
                    style: AppTypography.tiny.copyWith(
                      color: AppColors.textLight,
                    ),
                  ),
              ],
            ),
          ),
          // Due column — shows the restructured rate (with the original struck
          // through) for still-collectable future/today instalments when the
          // toggle is on and the figure actually changed.
          Expanded(
            flex: 2,
            child: Builder(
              builder: (_) {
                // Show the restructured rate on EVERY unpaid instalment
                // (missed + today + future), matching the server calc.
                final showAdj = isRestructured &&
                    restructuredAmount > 0 &&
                    inst.receivedAmount < inst.dueAmount &&
                    (restructuredAmount - inst.dueAmount).abs() >= 0.01;
                if (!showAdj) {
                  return Text(
                    fmt.format(inst.dueAmount),
                    style: AppTypography.body.copyWith(fontSize: 12),
                    textAlign: TextAlign.right,
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      // Show paisa for the restructured rate (e.g. ₹206.25);
                      // trailing zeros trimmed. Matches the web value exactly.
                      '₹${NumberFormat('#,##0.##', 'en_IN').format(restructuredAmount)}',
                      style: AppTypography.body.copyWith(
                        fontSize: 12,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                      textAlign: TextAlign.right,
                    ),
                    Text(
                      fmt.format(inst.dueAmount),
                      style: AppTypography.extraTiny.copyWith(
                        color: AppColors.textLight,
                        decoration: TextDecoration.lineThrough,
                      ),
                      textAlign: TextAlign.right,
                    ),
                  ],
                );
              },
            ),
          ),
          // Received column
          Expanded(
            flex: 2,
            child: Text(
              isPaid ? fmt.format(inst.receivedAmount) : '—',
              style: AppTypography.body.copyWith(
                fontSize: 12,
                color: isPaid ? AppColors.success : AppColors.textLight,
              ),
              textAlign: TextAlign.right,
            ),
          ),
          const SizedBox(width: 8),
          // Status badge
          SizedBox(
            width: 70,
            child: Center(
              child: AppBadge(
                label: _statusLabel(dynStatus, t),
                kind: kind,
              ),
            ),
          ),
          const SizedBox(width: 4),
          // Pay action button
          SizedBox(
            width: 48,
            child: canPay
                ? _PayButton(
                    inst: inst,
                    loan: loan,
                    isRestructured: isRestructured,
                    restructuredAmount: restructuredAmount,
                    onCompleted: () {
                      // Force rebuild by invalidating the provider
                      // This is handled by the parent refreshing
                    },
                  )
                : (isPaid
                    ? Icon(
                        Icons.check_circle,
                        size: 20,
                        color: AppColors.success.withAlpha(150),
                      )
                    : const SizedBox.shrink()),
          ),
        ],
      ),
    );
  }
}

/// Pay button that opens the QuickCollectSheet for this instalment.
class _PayButton extends ConsumerWidget {
  const _PayButton({
    required this.inst,
    required this.loan,
    this.isRestructured = false,
    this.restructuredAmount = 0,
    this.onCompleted,
  });
  final Instalment inst;
  final Loan loan;
  final bool isRestructured;
  final double restructuredAmount;
  final VoidCallback? onCompleted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Material(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => _openPaySheet(context, ref),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Icon(
            Icons.payments_outlined,
            color: Colors.white,
            size: 18,
          ),
        ),
      ),
    );
  }

  void _openPaySheet(BuildContext context, WidgetRef ref) {
    var defaultAmount = inst.dueAmount;
    // Pre-fill the restructured (even-spread) rate for any unpaid instalment
    // when the toggle is on.
    if (isRestructured &&
        restructuredAmount > 0 &&
        inst.receivedAmount < inst.dueAmount) {
      defaultAmount = restructuredAmount;
    }

    final today = DateTime.now();
    final todayStart = DateTime(today.year, today.month, today.day);
    CollectionRow rowFor(Instalment source, {double? dueAmount}) {
      return CollectionRow(
        instalmentId: source.id,
        loanId: source.loanId,
        loanCode: loan.loanCode,
        customerId: loan.customerId,
        customerName: loan.customer?.name ?? '-',
        customerCode: loan.customer?.customerCode ?? '',
        routeName: null,
        dueAmount: dueAmount ?? source.dueAmount,
        receivedAmount: source.receivedAmount,
        dueDate: source.dueDate,
        status: source.dynamicStatus,
      );
    }

    final dueNowRows = loan.instalments
        .where((source) {
          final due = DateTime(
            source.dueDate.year,
            source.dueDate.month,
            source.dueDate.day,
          );
          return !due.isAfter(todayStart) && source.dynamicStatus != 'paid';
        })
        .map(rowFor)
        .toList(growable: false);

    // Build a CollectionRow from the instalment data to reuse QuickCollectSheet.
    // When opened from loan detail, seed every overdue/today row for this loan
    // so "Total Due" is overdue + today, not full outstanding.
    final row = CollectionRow(
      instalmentId: inst.id,
      loanId: inst.loanId,
      loanCode: loan.loanCode,
      customerId: loan.customerId,
      customerName: loan.customer?.name ?? '—',
      customerCode: loan.customer?.customerCode ?? '',
      routeName: null,
      dueAmount: defaultAmount,
      receivedAmount: inst.receivedAmount,
      dueDate: inst.dueDate,
      status: inst.dynamicStatus,
    );

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(
        row: row,
        scopeRows: dueNowRows.isEmpty ? [row] : dueNowRows,
      ),
    ).then((_) {
      // Invalidate the loan detail to refetch after payment
      ref.invalidate(loanDetailProvider(loan.id));
      onCompleted?.call();
    });
  }
}

class _BorrowerHeader extends ConsumerWidget {
  const _BorrowerHeader({required this.loan});
  final Loan loan;

  BadgeKind _badge(String s) => switch (s) {
        'active' => BadgeKind.active,
        'overdue' => BadgeKind.overdue,
        'closed' => BadgeKind.closed,
        'pending_review' || 'pending' => BadgeKind.pending,
        _ => BadgeKind.info,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = loan.customer?.name ?? '—';
    final code = loan.customer?.customerCode ?? '';
    final photo = loan.customer?.photoUrl;
    final initials = loan.customer?.initials ?? '?';

    return GestureDetector(
      onTap: () => context.push('/customers/${loan.customerId}'),
      behavior: HitTestBehavior.opaque,
      child: Column(
        children: [
          if (photo != null && photo.isNotEmpty)
            CircleAvatar(radius: 36, backgroundImage: NetworkImage(photo))
          else
            CircleAvatar(
              radius: 36,
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              child: Text(
                initials,
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                ),
              ),
            ),
          const SizedBox(height: 10),
          Text(
            name,
            style: AppTypography.sectionTitle.copyWith(
              fontSize: 18,
              letterSpacing: -0.3,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (code.isNotEmpty) ...[
                Text(code, style: AppTypography.caption),
                const SizedBox(width: 8),
              ],
              AppBadge(label: loan.status, kind: _badge(loan.status)),
            ],
          ),
        ],
      ),
    );
  }
}

class _LoanPillRow extends ConsumerWidget {
  const _LoanPillRow({required this.loan});
  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_customerLoansProvider(loan.customerId));
    return async.when(
      loading: () => const SizedBox(height: 36),
      error: (_, __) => const SizedBox(height: 0),
      data: (loans) {
        if (loans.length <= 1) return const SizedBox.shrink();
        final visible = loans.take(3).toList(growable: false);
        final extra = loans.length - visible.length;
        return Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final l in visible)
              _LoanPill(
                code: (l['loanCode'] as String?) ?? '',
                status: (l['status'] as String?) ?? 'active',
                active: (l['id'] as String?) == loan.id,
                onTap: () {
                  final id = l['id'] as String?;
                  if (id != null && id != loan.id) {
                    context.go('/loans/$id');
                  }
                },
              ),
            if (extra > 0)
              _LoanPillMore(
                count: extra,
                onTap: () => context.push('/customers/${loan.customerId}'),
              ),
          ],
        );
      },
    );
  }
}

class _LoanPill extends StatelessWidget {
  const _LoanPill({
    required this.code,
    required this.status,
    required this.active,
    required this.onTap,
  });
  final String code;
  final String status;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dot = switch (status) {
      'overdue' => AppColors.danger,
      'closed' => AppColors.textLight,
      'pending_review' || 'pending' => AppColors.warning,
      _ => AppColors.success,
    };
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: active
              ? AppColors.primary.withValues(alpha: 0.10)
              : AppColors.surface,
          border: Border.all(
            color: active ? AppColors.primary : AppColors.border,
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            Text(
              code.isEmpty ? '—' : code,
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w700,
                color: active ? AppColors.primary : AppColors.textPrimary,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoanPillMore extends StatelessWidget {
  const _LoanPillMore({required this.count, required this.onTap});
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.background,
          border: Border.all(color: AppColors.border, width: 1.5),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '+$count more',
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right,
                size: 14, color: AppColors.textLight),
          ],
        ),
      ),
    );
  }
}

class _LoanBottomBar extends ConsumerWidget {
  const _LoanBottomBar({required this.loan});
  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isClosed = loan.status == 'closed';

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border)),
          boxShadow: AppTokens.shadowLg,
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _exportStatement(context, ref),
                icon: const Icon(Icons.picture_as_pdf_outlined),
                label: const Text('Statement'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                ),
              ),
            ),
            if (!isClosed) ...[
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _showActionSheet(context, ref),
                  icon: const Icon(Icons.tune_outlined),
                  label: const Text('Actions'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _exportStatement(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text('Downloading Loan Statement PDF...'),
        backgroundColor: AppColors.primary,
      ),
    );
    try {
      final bytes = await ref.read(loanServiceProvider).statementPdf(loan.id);
      if (bytes.isEmpty) throw Exception('Empty document');
      await Printing.layoutPdf(
        onLayout: (_) async => Uint8List.fromList(bytes),
        name: 'statement-${loan.loanCode}.pdf',
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('Failed to download statement: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  void _showActionSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.check_circle_outline,
                    color: AppColors.success),
                title: const Text('Mark as Closed'),
                subtitle: const Text('Settle all dues and close this loan'),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmAction(context, ref, 'close');
                },
              ),
              ListTile(
                leading:
                    Icon(Icons.autorenew_outlined, color: AppColors.primary),
                title: const Text('Renew Loan'),
                subtitle:
                    const Text('Create a renewal package for the customer'),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmAction(context, ref, 'renew');
                },
              ),
              ListTile(
                leading: const Icon(Icons.offline_pin_outlined,
                    color: AppColors.warning),
                title: const Text('Pre-close / Foreclosure'),
                subtitle:
                    const Text('Calculate pre-closure charges and settle'),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmAction(context, ref, 'preclose');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmAction(BuildContext context, WidgetRef ref, String action) {
    final fmt = ref.watch(currencyFmtProvider);
    final totalCollected = loan.totalCollected;
    final totalRepayable = loan.totalPayable;
    final outstanding = totalRepayable - totalCollected;

    if (action == 'close') {
      final hasActiveCheques =
          loan.customer?.securityCheques.any((c) => c.status == 'active') ??
              false;

      showDialog<void>(
        context: context,
        builder: (ctx) {
          bool markChequesReturned = false;
          return StatefulBuilder(
            builder: (context, setState) {
              return AlertDialog(
                title: const Text('Close Loan'),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                        'Are you sure you want to close this loan? All pending balances must be settled.'),
                    if (hasActiveCheques) ...[
                      const SizedBox(height: 16),
                      CheckboxListTile(
                        title: const Text(
                            'Mark active security cheques as returned'),
                        value: markChequesReturned,
                        onChanged: (val) {
                          setState(() {
                            markChequesReturned = val ?? false;
                          });
                        },
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                      ),
                    ],
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel'),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      try {
                        await ref.read(loanServiceProvider).performAction(
                          loan.id,
                          'close',
                          data: {'markChequesReturned': markChequesReturned},
                        );
                        ref.invalidate(loanDetailProvider(loan.id));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Loan closed successfully'),
                                backgroundColor: AppColors.success),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                                content: Text('Failed: $e'),
                                backgroundColor: AppColors.danger),
                          );
                        }
                      }
                    },
                    child: const Text('Confirm'),
                  ),
                ],
              );
            },
          );
        },
      );
    } else if (action == 'preclose') {
      showDialog<void>(
        context: context,
        builder: (ctx) {
          String paymentMode = 'cash';
          final amountController =
              TextEditingController(text: outstanding.toStringAsFixed(2));
          final remarksController =
              TextEditingController(text: 'Preclosure Full Settlement');
          final formKey = GlobalKey<FormState>();

          return StatefulBuilder(
            builder: (context, setState) {
              return AlertDialog(
                title: const Text('Preclose Loan'),
                content: SingleChildScrollView(
                  child: Form(
                    key: formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Preclosing will collect the payoff amount and close the loan. All other unpaid instalments will be waived.',
                          style: TextStyle(fontSize: 13),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: amountController,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          decoration: InputDecoration(
                            labelText: 'Payoff Amount (${fmt.currencySymbol})',
                            border: const OutlineInputBorder(),
                          ),
                          validator: (val) {
                            if (val == null || val.isEmpty) return 'Required';
                            final parsed = double.tryParse(val);
                            if (parsed == null || parsed <= 0)
                              return 'Enter a valid amount';
                            if (parsed < outstanding) {
                              return 'Must be at least the outstanding: ${fmt.format(outstanding)}';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String>(
                          initialValue: paymentMode,
                          decoration: const InputDecoration(
                            labelText: 'Payment Mode',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(
                                value: 'cash', child: Text('Cash')),
                            DropdownMenuItem(value: 'upi', child: Text('UPI')),
                            DropdownMenuItem(
                                value: 'bank', child: Text('Bank Transfer')),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                paymentMode = val;
                              });
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: remarksController,
                          decoration: const InputDecoration(
                            labelText: 'Remarks',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel'),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary),
                    onPressed: () async {
                      if (!formKey.currentState!.validate()) return;
                      Navigator.pop(ctx);
                      try {
                        await ref.read(loanServiceProvider).performAction(
                          loan.id,
                          'preclose',
                          data: {
                            'amount': double.parse(amountController.text),
                            'paymentMode': paymentMode,
                            'remarks': remarksController.text,
                          },
                        );
                        ref.invalidate(loanDetailProvider(loan.id));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Loan preclosed successfully'),
                                backgroundColor: AppColors.success),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                                content: Text('Failed: $e'),
                                backgroundColor: AppColors.danger),
                          );
                        }
                      }
                    },
                    child: const Text('Confirm'),
                  ),
                ],
              );
            },
          );
        },
      );
    } else {
      final title = action == 'renew' ? 'Renew Loan' : 'Confirm Action';
      final desc = action == 'renew'
          ? 'This will close the current loan and create a renewal package with the same terms starting today. Continue?'
          : 'Are you sure you want to perform this action?';

      showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(title),
          content: Text(desc),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await ref
                      .read(loanServiceProvider)
                      .performAction(loan.id, action);
                  ref.invalidate(loanDetailProvider(loan.id));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content:
                              Text('Action "$title" processed successfully'),
                          backgroundColor: AppColors.success),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text('Failed: $e'),
                          backgroundColor: AppColors.danger),
                    );
                  }
                }
              },
              child: const Text('Confirm'),
            ),
          ],
        ),
      );
    }
  }
}
