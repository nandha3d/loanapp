// ignore_for_file: require_trailing_commas

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/npa.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/npa_service.dart';
import 'package:zolofund/features/billing/widgets/addon_purchase_sheet.dart';
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
    final user = ref.watch(authControllerProvider).user;
    final isDeveloper = user?.role == UserRole.developer;
    final isSubscribed = user?.npaEnabled == true || isDeveloper;

    final summary = ref.watch(_npaSummaryProvider);
    final loans = ref.watch(_npaLoansProvider);
    final category = ref.watch(_npaCategoryProvider);

    final isSummary403 = summary.hasError &&
        (summary.error.toString().contains('403') ||
            summary.error.toString().contains('not enabled'));
    final isLoans403 = loans.hasError &&
        (loans.error.toString().contains('403') ||
            loans.error.toString().contains('not enabled'));

    if (!isSubscribed || isSummary403 || isLoans403) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('NPA Monitoring'),
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () =>
                context.canPop() ? context.pop() : context.go('/dashboard'),
          ),
        ),
        body: _NpaLockedView(ref: ref),
        bottomNavigationBar: const AppBottomNav(currentRoute: '/npa'),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('NPA Monitoring'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
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

class _NpaLockedView extends StatelessWidget {
  const _NpaLockedView({required this.ref});
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final canPurchase = user?.role == UserRole.superadmin ||
        user?.role == UserRole.admin ||
        user?.role == UserRole.developer;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 10),
        // Hero Icon Card
        Center(
          child: Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.warning.withAlpha(40),
                  AppColors.warningBg,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.warning.withAlpha(120), width: 2),
              boxShadow: [
                BoxShadow(
                  color: AppColors.warning.withAlpha(40),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Center(
              child: Icon(
                Icons.lock_rounded,
                size: 42,
                color: AppColors.warning,
              ),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.warningBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.warning.withAlpha(100)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.star_rounded, size: 14, color: AppColors.warning),
                SizedBox(width: 4),
                Text(
                  'PREMIUM ADD-ON',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.warning,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            'NPA Monitoring is Locked',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              'Automated RBI delinquency tracking, loss provisioning calculations, and portfolio health analytics for compliant lending.',
              textAlign: TextAlign.center,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),

        // Feature list container
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
            boxShadow: AppTokens.shadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'WHAT IS INCLUDED IN THIS ADD-ON',
                style: AppTypography.tiny.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 14),
              _buildFeatureItem(
                icon: Icons.rule_folder_outlined,
                color: AppColors.warning,
                title: 'RBI Norms Delinquency Tracking',
                subtitle:
                    'Automated classification: SMA-0 (1-30d), SMA-1 (31-60d), SMA-2 (61-90d), Sub-standard, Doubtful & Loss.',
              ),
              const Divider(height: 20),
              _buildFeatureItem(
                icon: Icons.calculate_outlined,
                color: AppColors.info,
                title: 'Real-time Risk Provisioning',
                subtitle:
                    'Dynamic capital provisioning reserves across secured and unsecured loans to satisfy RBI compliance.',
              ),
              const Divider(height: 20),
              _buildFeatureItem(
                icon: Icons.insights_rounded,
                color: AppColors.purple,
                title: 'Portfolio GNPA / NNPA Metrics',
                subtitle:
                    'Real-time Gross NPA ratio calculation and risk bucket breakdown for lenders and audits.',
              ),
              const Divider(height: 20),
              _buildFeatureItem(
                icon: Icons.upgrade_rounded,
                color: AppColors.success,
                title: 'Automated Loan Regularisation Upgrades',
                subtitle:
                    'Instant 1-tap regularisation back to standard asset category once overdue arrears are cleared.',
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Action CTA
        if (canPurchase) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withAlpha(20),
                  AppColors.primaryLight,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withAlpha(80)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '₹499 / month',
                          style: AppTypography.nameLg.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Billed monthly · Cancel anytime',
                          style: AppTypography.extraTiny.copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'ORGANIZATION ADD-ON',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    icon: const Icon(Icons.flash_on_rounded, size: 18),
                    label: const Text(
                      'Purchase Add-on · Subscribe via Razorpay',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                      ),
                    ),
                    onPressed: () => showAddonPurchaseSheet(
                      context,
                      ref,
                      addonKey: 'npa',
                      onActivated: () {
                        ref.invalidate(_npaSummaryProvider);
                        ref.invalidate(_npaLoansProvider);
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.verified_user_outlined, size: 12, color: AppColors.textLight),
                    const SizedBox(width: 4),
                    Text(
                      'Powered by Razorpay Payment Gateway',
                      style: AppTypography.extraTiny.copyWith(color: AppColors.textLight),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ] else ...[
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.warningBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.warning.withAlpha(100)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppColors.warning, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'NPA Classification is an organization add-on. Please contact your workspace administrator to purchase.',
                    style: AppTypography.caption.copyWith(color: AppColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 30),
      ],
    );
  }

  Widget _buildFeatureItem({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withAlpha(35),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary, height: 1.3),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
