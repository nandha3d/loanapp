import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/instalment.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/data/services/loan_service.dart';
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

    return Scaffold(
      appBar: AppBar(title: const Text('Loan Details'), centerTitle: true),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Skeleton(height: 200, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: 'Could not load loan',
          subtitle: e.toString(),
        ),
        data: (loan) => _LoanBody(loan: loan),
      ),
    );
  }
}

class _LoanBody extends StatefulWidget {
  const _LoanBody({required this.loan});
  final Loan loan;

  @override
  State<_LoanBody> createState() => _LoanBodyState();
}

class _LoanBodyState extends State<_LoanBody> {
  final _scrollCtrl = ScrollController();
  final _rowKeys = <int, GlobalKey>{};
  int? _highlight;

  @override
  void dispose() {
    _scrollCtrl.dispose();
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
    final paid = loan.instalments.where((i) => i.status == 'paid').length;
    final progress =
        loan.instalmentCount == 0 ? 0.0 : paid / loan.instalmentCount;

    return ListView(
      controller: _scrollCtrl,
      padding: const EdgeInsets.all(16),
      children: [
        _SummaryCard(loan: loan, fmt: fmt, progress: progress, paid: paid),
        const SizedBox(height: 14),
        LoanHeatmap(
          instalments: loan.instalments,
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
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Payment Schedule',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
              for (final inst in loan.instalments)
                _InstalmentRow(
                  key: _rowKeys.putIfAbsent(
                    inst.instalmentNo,
                    () => GlobalKey(),
                  ),
                  inst: inst,
                  fmt: fmt,
                  highlighted: _highlight == inst.instalmentNo,
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.loan,
    required this.fmt,
    required this.progress,
    required this.paid,
  });
  final Loan loan;
  final NumberFormat fmt;
  final double progress;
  final int paid;

  BadgeKind _badge(String s) => switch (s) {
        'active' => BadgeKind.active,
        'overdue' => BadgeKind.overdue,
        'closed' => BadgeKind.closed,
        'pending_review' || 'pending' => BadgeKind.pending,
        _ => BadgeKind.info,
      };

  @override
  Widget build(BuildContext context) {
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
          const SizedBox(height: 4),
          Text(
            fmt.format(loan.principalAmount),
            style: AppTypography.heroNumber.copyWith(
              color: AppColors.primaryDark,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _pill('${loan.instalmentCount} Inst'),
              const SizedBox(width: 8),
              _pill('$paid Paid'),
              const SizedBox(width: 8),
              _pill('${loan.instalmentCount - paid} Left'),
            ],
          ),
          const SizedBox(height: 16),
          Stack(
            children: [
              Container(
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              FractionallySizedBox(
                widthFactor: progress.clamp(0.0, 1.0),
                child: Container(
                  height: 8,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [
                        AppColors.primary,
                        AppColors.primaryDark,
                      ],
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${(progress * 100).toStringAsFixed(0)}% repaid',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }

  Widget _pill(String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
        ),
        child:
            Text(label, style: AppTypography.caption.copyWith(fontSize: 11.5)),
      );
}

class _InstalmentRow extends StatelessWidget {
  const _InstalmentRow({
    super.key,
    required this.inst,
    required this.fmt,
    required this.highlighted,
  });
  final Instalment inst;
  final NumberFormat fmt;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final kind = switch (inst.status) {
      'paid' => BadgeKind.active,
      'partial' => BadgeKind.partial,
      'missed' => BadgeKind.overdue,
      _ => BadgeKind.upcoming,
    };
    final dateFmt = DateFormat('dd MMM');

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: highlighted ? AppColors.primaryLight : Colors.transparent,
        border: const Border(
          bottom: BorderSide(color: AppColors.border),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: AppColors.background,
            child: Text(
              '#${inst.instalmentNo}',
              style: AppTypography.caption.copyWith(
                color: AppColors.textLight,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(dateFmt.format(inst.dueDate), style: AppTypography.body),
                Text(
                  fmt.format(inst.dueAmount),
                  style: AppTypography.bodyLarge,
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmt.format(inst.receivedAmount),
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.success,
                ),
              ),
              const SizedBox(height: 4),
              AppBadge(label: inst.status, kind: kind),
            ],
          ),
        ],
      ),
    );
  }
}
