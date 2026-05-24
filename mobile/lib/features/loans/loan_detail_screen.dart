import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/instalment.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/features/collection/quick_collect_sheet.dart';
import 'package:loantrack/features/loans/widgets/loan_heatmap.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _loanDetailProvider =
    FutureProvider.autoDispose.family<Loan, String>((ref, id) {
  return ref.watch(loanServiceProvider).getById(id);
});

class LoanDetailScreen extends ConsumerWidget {
  const LoanDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_loanDetailProvider(id));
    final t = T.of(ref);

    return Scaffold(
      appBar: AppBar(title: Text(t.x('title.loan_details')), centerTitle: true),
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
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final paid = loan.instalments.where((i) => i.dynamicStatus == 'paid').length;
    final progress =
        loan.instalmentCount == 0 ? 0.0 : paid / loan.instalmentCount;

    final displayInstalments = _computeDisplayInstalments(loan);

    return ListView(
      controller: _scrollCtrl,
      padding: const EdgeInsets.all(16),
      children: [
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
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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
                          child: Text('#',
                              style: AppTypography.tiny
                                  .copyWith(fontWeight: FontWeight.w700)),
                        ),
                        Expanded(
                          flex: 3,
                          child: Text(t.x('loan.col_date'),
                              style: AppTypography.tiny
                                  .copyWith(fontWeight: FontWeight.w700)),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(t.x('loan.col_due'),
                              style: AppTypography.tiny.copyWith(
                                  fontWeight: FontWeight.w700),
                              textAlign: TextAlign.right),
                        ),
                        Expanded(
                          flex: 2,
                          child: Text(t.x('loan.col_received'),
                              style: AppTypography.tiny.copyWith(
                                  fontWeight: FontWeight.w700),
                              textAlign: TextAlign.right),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 70,
                          child: Text(t.x('loan.col_status'),
                              style: AppTypography.tiny
                                  .copyWith(fontWeight: FontWeight.w700),
                              textAlign: TextAlign.center),
                        ),
                        const SizedBox(width: 4),
                        SizedBox(
                          width: 48,
                          child: Text(t.x('loan.col_action'),
                              style: AppTypography.tiny
                                  .copyWith(fontWeight: FontWeight.w700),
                              textAlign: TextAlign.center),
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
    double remaining = loan.instalments.fold(0.0, (sum, i) => sum + i.receivedAmount);
    final today = DateTime.now();
    final todayStart = DateTime(today.year, today.month, today.day);

    for (var i = 0; i < dist.length; i++) {
      final due = dist[i].dueAmount;
      if (remaining >= due) {
        dist[i] = dist[i].copyWith(receivedAmount: due, status: 'paid');
        remaining -= due;
      } else if (remaining > 0) {
        dist[i] = dist[i].copyWith(receivedAmount: remaining, status: 'partial');
        remaining = 0;
      } else {
        final dDate = DateTime(dist[i].dueDate.year, dist[i].dueDate.month, dist[i].dueDate.day);
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
                onChanged: (v) => setState(() => _showRestructuredRates = v ?? false),
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
          color: active ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
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

  Widget _buildSummaryCards(Loan loan, NumberFormat fmt, double progress, int paid) {
    return Column(
      children: [
        SizedBox(
          height: 230,
          child: PageView(
            controller: _pageCtrl,
            onPageChanged: (i) => setState(() => _currentSummaryPage = i),
            children: [
              _SummaryCardOverview(loan: loan, fmt: fmt, progress: progress),
              _SummaryCardMetrics(loan: loan, fmt: fmt, progress: progress, paid: paid),
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
    final pct = (progress * 100).round();
    final totalCollected = loan.instalments.fold(0.0, (sum, i) => sum + i.receivedAmount);
    final totalRepayable = (loan.instalments.isNotEmpty ? loan.instalments.first.dueAmount : 0) * loan.instalmentCount;
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
              if (loan.customer?.photoUrl != null && loan.customer!.photoUrl!.isNotEmpty)
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
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                  ),
                ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      loan.customer?.name ?? '—',
                      style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
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
                      valueColor: const AlwaysStoppedAnimation(AppColors.primary),
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
                    Text('PRINCIPAL', style: AppTypography.tiny.copyWith(color: AppColors.textLight, fontWeight: FontWeight.w600)),
                    Text(fmt.format(loan.principalAmount), style: AppTypography.bodyLarge.copyWith(color: AppColors.textPrimary)),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('OUTSTANDING', style: AppTypography.tiny.copyWith(color: AppColors.textLight, fontWeight: FontWeight.w600)),
                    Text(fmt.format(outstanding), style: AppTypography.bodyLarge.copyWith(color: AppColors.danger)),
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
    final totalCollected = loan.instalments.fold(0.0, (sum, i) => sum + i.receivedAmount);
    final perInstalment = loan.instalments.isNotEmpty ? loan.instalments.first.dueAmount : 0.0;
    final totalRepayable = perInstalment * loan.instalmentCount;
    final outstanding = totalRepayable - totalCollected;

    final dynamicRemainingCount = perInstalment > 0 ? (outstanding / perInstalment).ceil() : 0;
    final dynamicPaidCount = (loan.instalmentCount - dynamicRemainingCount).clamp(0, loan.instalmentCount);

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
                    _StatBlock(t.x('loan.lbl_principal'), fmt.format(loan.principalAmount)),
                    _StatBlock(t.x('loan.lbl_repayable'), fmt.format(totalRepayable), valueColor: AppColors.primaryDark),
                    _StatBlock(t.x('loan.lbl_disbursed'), fmt.format(loan.disbursedAmount)),
                    _StatBlock(t.x('loan.lbl_frequency'), loan.frequency),
                    _StatBlock(t.x('loan.lbl_tenure'), '${loan.instalmentCount} ${t.x('loan.val_days')}'),
                    _StatBlock(t.x('loan.lbl_start_date'), DateFormat('dd MMM yyyy').format(loan.startDate)),
                    _StatBlock(t.x('loan.lbl_per_inst'), fmt.format(perInstalment)),
                    _StatBlock(t.x('loan.lbl_collected'), fmt.format(totalCollected), valueColor: AppColors.success),
                    _StatBlock(t.x('loan.lbl_outstanding'), fmt.format(outstanding), valueColor: AppColors.danger),
                    _StatBlock(t.x('loan.lbl_paid_period'), '$dynamicPaidCount ${t.x('loan.val_days')}', valueColor: AppColors.success),
                    _StatBlock(t.x('loan.lbl_remaining'), '$dynamicRemainingCount ${t.x('loan.val_days')}', valueColor: AppColors.danger),
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
      width: (MediaQuery.of(context).size.width - 32 - 16 - 70 - 16 - 16) / 2, // approximate half width minus paddings
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

class _InstalmentRow extends ConsumerWidget {
  const _InstalmentRow({
    super.key,
    required this.inst,
    required this.loan,
    required this.fmt,
    required this.highlighted,
    this.isRestructured = false,
  });
  final Instalment inst;
  final Loan loan;
  final NumberFormat fmt;
  final bool highlighted;
  final bool isRestructured;

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
    final collectedTime = inst.receivedAt != null
        ? timeFmt.format(inst.receivedAt!)
        : null;

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
            : (dynStatus == 'paid' ? AppColors.background.withAlpha(128) : Colors.transparent),
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
                Text(dateFmt.format(inst.dueDate),
                    style: AppTypography.body.copyWith(fontSize: 12.5)),
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
          // Due column
          Expanded(
            flex: 2,
            child: Text(
              fmt.format(inst.dueAmount),
              style: AppTypography.body.copyWith(fontSize: 12),
              textAlign: TextAlign.right,
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
                    onCompleted: () {
                      // Force rebuild by invalidating the provider
                      // This is handled by the parent refreshing
                    },
                  )
                : (isPaid
                    ? Icon(Icons.check_circle,
                        size: 20, color: AppColors.success.withAlpha(150))
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
    this.onCompleted,
  });
  final Instalment inst;
  final Loan loan;
  final bool isRestructured;
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
    if (isRestructured && inst.dynamicStatus != 'paid' && inst.dynamicStatus != 'partial') {
      final totalCollected = loan.instalments.fold(0.0, (sum, i) => sum + i.receivedAmount);
      final outstanding = (inst.dueAmount * loan.instalmentCount) - totalCollected;
      final dynamicRemainingCount = inst.dueAmount > 0 ? (outstanding / inst.dueAmount).ceil() : 1;
      defaultAmount = dynamicRemainingCount > 0 ? outstanding / dynamicRemainingCount : inst.dueAmount;
    }

    // Build a CollectionRow from the instalment data to reuse QuickCollectSheet
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
      builder: (_) => QuickCollectSheet(row: row),
    ).then((_) {
      // Invalidate the loan detail to refetch after payment
      ref.invalidate(_loanDetailProvider(loan.id));
      onCompleted?.call();
    });
  }
}
