import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/reports.dart';
import 'package:loantrack/data/services/reports_service.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

// ── Providers ────────────────────────────────────────────────────────────────

final _accountingSummaryProvider =
    FutureProvider.autoDispose<AccountingSummary>((ref) {
  return ref.watch(reportsServiceProvider).fetchAccountingSummary();
});

final _overdueReportProvider =
    FutureProvider.autoDispose<List<OverdueItem>>((ref) {
  return ref.watch(reportsServiceProvider).fetchOverdueReport();
});

// ── Screen ────────────────────────────────────────────────────────────────────

class AccountingScreen extends ConsumerWidget {
  const AccountingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('title.accounting')),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              ref.invalidate(_accountingSummaryProvider);
              ref.invalidate(_overdueReportProvider);
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(_accountingSummaryProvider);
          ref.invalidate(_overdueReportProvider);
          await Future.wait([
            ref.read(_accountingSummaryProvider.future),
            ref.read(_overdueReportProvider.future),
          ]);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _SummarySection(summaryAsync: ref.watch(_accountingSummaryProvider)),
            const SizedBox(height: 16),
            _OverdueSection(overdueAsync: ref.watch(_overdueReportProvider)),
            const SizedBox(height: 24),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/accounting'),
    );
  }
}

// ── Summary Section ───────────────────────────────────────────────────────────

class _SummarySection extends ConsumerWidget {
  const _SummarySection({required this.summaryAsync});
  final AsyncValue<AccountingSummary> summaryAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return _Card(
      title: t.x('acc.today_summary'),
      child: summaryAsync.when(
        loading: () => const Skeleton(height: 160),
        error: (e, _) => _InlineError(message: e.toString()),
        data: (s) => _SummaryBody(summary: s),
      ),
    );
  }
}

class _SummaryBody extends ConsumerWidget {
  const _SummaryBody({required this.summary});
  final AccountingSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = NumberFormat.currency(
      locale: 'en_IN', symbol: '₹', decimalDigits: 0,
    );
    final isProfitable = summary.netProfit >= 0;

    return Column(
      children: [
        _FinRow(
          icon: Icons.arrow_downward_rounded,
          iconColor: AppColors.success,
          iconBg: AppColors.successBg,
          label: t.x('acc.collected'),
          value: fmt.format(summary.totalCollected),
          valueColor: AppColors.success,
        ),
        const _Divider(),
        _FinRow(
          icon: Icons.arrow_upward_rounded,
          iconColor: AppColors.danger,
          iconBg: AppColors.dangerBg,
          label: t.x('acc.disbursed'),
          value: fmt.format(summary.totalDisbursed),
          valueColor: AppColors.danger,
        ),
        const _Divider(),
        _FinRow(
          icon: Icons.receipt_long_outlined,
          iconColor: AppColors.warning,
          iconBg: AppColors.warningBg,
          label: t.x('acc.expenses'),
          value: fmt.format(summary.totalExpenses),
          valueColor: AppColors.textPrimary,
        ),
        const _Divider(),
        _FinRow(
          icon: Icons.account_balance_outlined,
          iconColor: AppColors.info,
          iconBg: AppColors.infoBg,
          label: t.x('acc.capital_balance'),
          value: fmt.format(summary.currentCapital),
          valueColor: AppColors.info,
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isProfitable ? AppColors.successBg : AppColors.dangerBg,
            borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          ),
          child: Row(
            children: [
              Icon(
                isProfitable
                    ? Icons.trending_up_rounded
                    : Icons.trending_down_rounded,
                color: isProfitable ? AppColors.success : AppColors.danger,
                size: 20,
              ),
              const SizedBox(width: 10),
              Text(
                t.x('acc.net_pl'),
                style: AppTypography.bodyLarge.copyWith(
                  color: isProfitable
                      ? AppColors.successText
                      : AppColors.dangerText,
                ),
              ),
              const Spacer(),
              Text(
                fmt.format(summary.netProfit),
                style: AppTypography.sectionTitle.copyWith(
                  color: isProfitable ? AppColors.success : AppColors.danger,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Overdue Section ───────────────────────────────────────────────────────────

class _OverdueSection extends ConsumerWidget {
  const _OverdueSection({required this.overdueAsync});
  final AsyncValue<List<OverdueItem>> overdueAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return _Card(
      title: t.x('acc.overdue_accounts'),
      child: overdueAsync.when(
        loading: () => const Skeleton(height: 120),
        error: (e, _) => _InlineError(message: e.toString()),
        data: (list) => list.isEmpty
            ? SizedBox(
                height: 100,
                child: EmptyState(
                  icon: Icons.check_circle_outline_rounded,
                  title: t.x('acc.no_overdue'),
                ),
              )
            : _OverdueList(items: list),
      ),
    );
  }
}

class _OverdueList extends ConsumerWidget {
  const _OverdueList({required this.items});
  final List<OverdueItem> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = NumberFormat.currency(
      locale: 'en_IN', symbol: '₹', decimalDigits: 0,
    );
    final shown = items.length > 10 ? items.sublist(0, 10) : items;

    return Column(
      children: [
        ...shown.map((item) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                ),
                child: const Icon(
                  Icons.warning_amber_rounded,
                  color: AppColors.danger,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.customerName, style: AppTypography.bodyLarge),
                    Text(item.loanCode, style: AppTypography.caption),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    fmt.format(item.overdueAmount),
                    style: AppTypography.bodyLarge
                        .copyWith(color: AppColors.danger),
                  ),
                  Text(
                    '${item.overdueDays} ${t.x('acc.overdue_days_suffix')}',
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ],
          ),
        ),),
        if (items.length > 10)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              '+ ${items.length - 10} ${t.x('acc.n_more')}',
              style: AppTypography.caption,
            ),
          ),
      ],
    );
  }
}

// ── Shared Widgets ────────────────────────────────────────────────────────────

class _FinRow extends StatelessWidget {
  const _FinRow({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.label,
    required this.value,
    required this.valueColor,
  });
  final IconData icon;
  final Color iconColor, iconBg, valueColor;
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: AppTypography.bodyLarge)),
          Text(
            value,
            style: AppTypography.bodyLarge.copyWith(color: valueColor),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) =>
      const Divider(color: AppColors.border, height: 1);
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child});
  final String title;
  final Widget child;

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
          Text(title, style: AppTypography.sectionTitle),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.danger, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: AppTypography.body.copyWith(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
  }
}
