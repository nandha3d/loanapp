// ignore_for_file: require_trailing_commas

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/npa.dart';
import 'package:zolofund/data/services/npa_service.dart';
import 'package:zolofund/shared/widgets/app_button.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

const _categories = <String, String>{
  '': 'All',
  'sma_0': 'SMA 0',
  'sma_1': 'SMA 1',
  'sma_2': 'SMA 2',
  'sub_standard': 'Sub Standard',
  'doubtful_d1': 'Doubtful D1',
  'doubtful_d2': 'Doubtful D2',
  'doubtful_d3': 'Doubtful D3',
  'loss': 'Loss',
};

final _npaSummaryProvider = FutureProvider.autoDispose<NpaSummary>((ref) {
  return ref.watch(npaServiceProvider).fetchSummary();
});

final _npaCategoryProvider = StateProvider.autoDispose<String>((ref) => '');

final _npaLoansProvider = FutureProvider.autoDispose<NpaLoansPage>((ref) {
  final category = ref.watch(_npaCategoryProvider);
  return ref.watch(npaServiceProvider).fetchLoans(
        category: category.isEmpty ? null : category,
      );
});

final _npaHistoryProvider = FutureProvider.autoDispose
    .family<List<NpaHistoryItem>, String>((ref, loanId) {
  return ref.watch(npaServiceProvider).fetchHistory(loanId);
});

class NpaScreen extends ConsumerWidget {
  const NpaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(_npaSummaryProvider);
    final loans = ref.watch(_npaLoansProvider);
    final category = ref.watch(_npaCategoryProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('NPA Monitoring'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              ref.invalidate(_npaSummaryProvider);
              ref.invalidate(_npaLoansProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(_npaSummaryProvider);
          ref.invalidate(_npaLoansProvider);
          await ref.read(_npaSummaryProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            summary.when(
              loading: () => const Skeleton(height: 168),
              error: (e, _) => _ErrorCard(message: e.toString()),
              data: (s) => _SummaryCard(summary: s),
            ),
            const SizedBox(height: 16),
            _CategoryFilter(
              value: category,
              onChanged: (value) =>
                  ref.read(_npaCategoryProvider.notifier).state = value,
            ),
            const SizedBox(height: 12),
            loans.when(
              loading: () => const Skeleton(height: 280),
              error: (e, _) => _ErrorCard(message: e.toString()),
              data: (page) => _LoanList(page: page),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/npa'),
    );
  }
}

class _SummaryCard extends ConsumerWidget {
  const _SummaryCard({required this.summary});
  final NpaSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = ref.watch(currencyFmtProvider);
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child:
                    Text('Portfolio risk', style: AppTypography.sectionTitle),
              ),
              _Pill('${summary.grossNpaRatio.toStringAsFixed(2)}% GNPA'),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _BucketTile('Standard', summary.standard, fmt.format),
              _BucketTile('SMA', summary.sma, fmt.format),
              _BucketTile('Sub standard', summary.subStandard, fmt.format),
              _BucketTile('Doubtful', summary.doubtful, fmt.format),
              _BucketTile('Loss', summary.loss, fmt.format),
              _BucketTile('Total', summary.total, fmt.format),
            ],
          ),
        ],
      ),
    );
  }
}

class _BucketTile extends StatelessWidget {
  const _BucketTile(this.label, this.bucket, this.format);
  final String label;
  final NpaBucket bucket;
  final String Function(num) format;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 148,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTypography.caption),
            const SizedBox(height: 4),
            Text(
              format(bucket.outstanding),
              style: AppTypography.label,
              overflow: TextOverflow.ellipsis,
            ),
            Text('${bucket.count} loans', style: AppTypography.caption),
          ],
        ),
      ),
    );
  }
}

class _CategoryFilter extends StatelessWidget {
  const _CategoryFilter({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _categories.entries.map((entry) {
          final selected = value == entry.key;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(entry.value),
              selected: selected,
              onSelected: (_) => onChanged(entry.key),
              selectedColor: AppColors.primary.withValues(alpha: 0.14),
              labelStyle: AppTypography.caption.copyWith(
                color: selected ? AppColors.primary : AppColors.textSecondary,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _LoanList extends StatelessWidget {
  const _LoanList({required this.page});
  final NpaLoansPage page;

  @override
  Widget build(BuildContext context) {
    if (page.loans.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 48),
        child: EmptyState(
          icon: Icons.verified_outlined,
          title: 'No NPA loans found',
        ),
      );
    }
    return Column(
      children: [
        for (final loan in page.loans) ...[
          _LoanCard(loan: loan),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _LoanCard extends ConsumerStatefulWidget {
  const _LoanCard({required this.loan});
  final NpaLoan loan;

  @override
  ConsumerState<_LoanCard> createState() => _LoanCardState();
}

class _LoanCardState extends ConsumerState<_LoanCard> {
  bool _expanded = false;
  bool _upgrading = false;

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    final loan = widget.loan;
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  loan.customerName.isEmpty ? loan.loanCode : loan.customerName,
                  style: AppTypography.bodyLarge,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _Pill(_label(loan.npaStatus)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${loan.loanCode} - ${loan.daysOverdue} days overdue',
            style: AppTypography.caption,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                  child: _Metric(
                      'Outstanding', fmt.format(loan.outstandingAmount))),
              Expanded(
                  child: _Metric(
                      'Provision', fmt.format(loan.provisioningAmount))),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              AppButton(
                label: _expanded ? 'Hide history' : 'History',
                size: AppButtonSize.small,
                variant: AppButtonVariant.secondary,
                onPressed: () => setState(() => _expanded = !_expanded),
              ),
              const Spacer(),
              AppButton(
                label: 'Upgrade',
                size: AppButtonSize.small,
                loading: _upgrading,
                onPressed: loan.upgradeEligible ? _upgrade : null,
              ),
            ],
          ),
          if (_expanded) ...[
            const SizedBox(height: 12),
            _HistoryPanel(loanId: loan.id),
          ],
        ],
      ),
    );
  }

  Future<void> _upgrade() async {
    setState(() => _upgrading = true);
    try {
      await ref.read(npaServiceProvider).upgradeLoan(widget.loan.id);
      ref.invalidate(_npaSummaryProvider);
      ref.invalidate(_npaLoansProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Loan upgraded to standard')),
        );
      }
    } finally {
      if (mounted) setState(() => _upgrading = false);
    }
  }
}

class _HistoryPanel extends ConsumerWidget {
  const _HistoryPanel({required this.loanId});
  final String loanId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_npaHistoryProvider(loanId));
    return async.when(
      loading: () => const Skeleton(height: 88),
      error: (e, _) => _ErrorCard(message: e.toString()),
      data: (items) {
        if (items.isEmpty) {
          return Text('No history yet', style: AppTypography.caption);
        }
        return Column(
          children: items.take(4).map((item) {
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(
                  '${_label(item.fromCategory)} -> ${_label(item.toCategory)}'),
              subtitle: Text(
                '${item.daysOverdue} days overdue',
                style: AppTypography.caption,
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.caption),
        Text(value,
            style: AppTypography.label, overflow: TextOverflow.ellipsis),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: Border.all(color: AppColors.border),
        boxShadow: AppTokens.shadow,
      ),
      child: child,
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: AppColors.primary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Text(
        message,
        style: AppTypography.caption.copyWith(color: AppColors.danger),
      ),
    );
  }
}

String _label(String value) {
  return _categories[value] ?? value.replaceAll('_', ' ').toUpperCase();
}
