import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/reports.dart';
import 'package:loantrack/data/services/reports_service.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

import 'journal_entry_form.dart';
import 'bank_reconciliation_screen.dart';

// ── Providers ────────────────────────────────────────────────────────────────

final _accountingSummaryProvider =
    FutureProvider.autoDispose<AccountingSummary>((ref) {
  return ref.watch(reportsServiceProvider).fetchAccountingSummary();
});

final _overdueReportProvider =
    FutureProvider.autoDispose<List<OverdueItem>>((ref) {
  return ref.watch(reportsServiceProvider).fetchOverdueReport();
});

final _statementsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(reportsServiceProvider).fetchAccountingStatements();
});

// ── Screen ────────────────────────────────────────────────────────────────────

class AccountingScreen extends ConsumerWidget {
  const AccountingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text(t.x('title.accounting') ?? 'Accounting Suite'),
          centerTitle: true,
          bottom: const TabBar(
            isScrollable: true,
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textSecondary,
            tabs: [
              Tab(text: 'Overview', icon: Icon(Icons.dashboard_outlined)),
              Tab(text: 'Chart of Accounts', icon: Icon(Icons.account_tree_outlined)),
              Tab(text: 'Journal', icon: Icon(Icons.menu_book_outlined)),
              Tab(text: 'Actions & Audit', icon: Icon(Icons.settings_outlined)),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: () {
                ref.invalidate(_accountingSummaryProvider);
                ref.invalidate(_statementsProvider);
                ref.invalidate(_overdueReportProvider);
              },
            ),
            const SizedBox(width: 4),
          ],
        ),
        body: const TabBarView(
          children: [
            _OverviewTab(),
            _CoaTab(),
            _JournalTab(),
            _ActionsTab(),
          ],
        ),
        bottomNavigationBar: const AppBottomNav(currentRoute: '/accounting'),
      ),
    );
  }
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
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
          _StatementsSection(stmtAsync: ref.watch(_statementsProvider)),
          const SizedBox(height: 16),
          _OverdueSection(overdueAsync: ref.watch(_overdueReportProvider)),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ── COA Tab ──────────────────────────────────────────────────────────────────

class _CoaTab extends StatelessWidget {
  const _CoaTab();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _CoaCategoryCard(
          category: 'Assets',
          accounts: const ['1010 - Cash Account', '1020 - Bank Account', '1030 - Receivables'],
        ),
        const SizedBox(height: 12),
        _CoaCategoryCard(
          category: 'Liabilities',
          accounts: const ['2010 - Accounts Payable', '2020 - Loans Payable'],
        ),
        const SizedBox(height: 12),
        _CoaCategoryCard(
          category: 'Equity',
          accounts: const ['3010 - Capital Stock', '3020 - Retained Earnings'],
        ),
        const SizedBox(height: 12),
        _CoaCategoryCard(
          category: 'Revenue',
          accounts: const ['4010 - Interest Revenue', '4020 - Penalty Fees'],
        ),
      ],
    );
  }
}

class _CoaCategoryCard extends StatelessWidget {
  const _CoaCategoryCard({required this.category, required this.accounts});
  final String category;
  final List<String> accounts;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(category, style: AppTypography.sectionTitle.copyWith(color: AppColors.primary)),
          const Divider(height: 20),
          for (final a in accounts)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  const Icon(Icons.folder_open_outlined, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 8),
                  Text(a, style: AppTypography.body),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Journal Tab ──────────────────────────────────────────────────────────────

class _JournalTab extends StatelessWidget {
  const _JournalTab();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: AppButton(
            label: 'Add Journal Entry',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const JournalEntryForm()),
              );
            },
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: const [
              _JournalItemCard(id: 'JE-2026-004', narration: 'Collection entry distribution Salem', amount: '₹14,500', date: 'June 03, 2026'),
              _JournalItemCard(id: 'JE-2026-003', narration: 'Office Rent Payment Salem', amount: '₹8,000', date: 'June 01, 2026'),
              _JournalItemCard(id: 'JE-2026-002', narration: 'Capital injection Erode Main', amount: '₹2,50,000', date: 'May 28, 2026'),
            ],
          ),
        ),
      ],
    );
  }
}

class _JournalItemCard extends StatelessWidget {
  const _JournalItemCard({
    required this.id,
    required this.narration,
    required this.amount,
    required this.date,
  });

  final String id;
  final String narration;
  final String amount;
  final String date;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(id, style: AppTypography.nameLg.copyWith(fontSize: 14)),
                const SizedBox(height: 2),
                Text(narration, style: AppTypography.caption, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(date, style: AppTypography.caption),
              ],
            ),
          ),
          Text(amount, style: AppTypography.nameLg.copyWith(fontSize: 14, color: AppColors.primary)),
        ],
      ),
    );
  }
}

// ── Actions Tab ──────────────────────────────────────────────────────────────

class _ActionsTab extends StatefulWidget {
  const _ActionsTab();

  @override
  State<_ActionsTab> createState() => _ActionsTabState();
}

class _ActionsTabState extends State<_ActionsTab> {
  bool _periodLocked = false;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ListTile(
          leading: const Icon(Icons.account_balance_rounded, color: AppColors.primary),
          title: const Text('Bank Reconciliation'),
          subtitle: const Text('Reconcile bank accounts against general ledgers'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const BankReconciliationScreen()),
            );
          },
        ),
        const Divider(),
        SwitchListTile(
          title: const Text('Period Lock'),
          subtitle: const Text('Lock current accounting period from further entries'),
          secondary: const Icon(Icons.lock_outline, color: AppColors.warning),
          value: _periodLocked,
          activeColor: AppColors.primary,
          onChanged: (val) {
            setState(() {
              _periodLocked = val;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(_periodLocked ? 'Accounting period locked' : 'Period unlocked')),
            );
          },
        ),
      ],
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
      title: t.x('acc.today_summary') ?? 'Today\'s Summary',
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
    final fmt = ref.watch(currencyFmtProvider);
    final isProfitable = summary.netProfit >= 0;

    return Column(
      children: [
        _FinRow(
          icon: Icons.arrow_downward_rounded,
          iconColor: AppColors.success,
          iconBg: AppColors.successBg,
          label: t.x('acc.collected') ?? 'Collected',
          value: fmt.format(summary.totalCollected),
          valueColor: AppColors.success,
        ),
        const _Divider(),
        _FinRow(
          icon: Icons.arrow_upward_rounded,
          iconColor: AppColors.danger,
          iconBg: AppColors.dangerBg,
          label: t.x('acc.disbursed') ?? 'Disbursed',
          value: fmt.format(summary.totalDisbursed),
          valueColor: AppColors.danger,
        ),
        const _Divider(),
        _FinRow(
          icon: Icons.receipt_long_outlined,
          iconColor: AppColors.warning,
          iconBg: AppColors.warningBg,
          label: t.x('acc.expenses') ?? 'Expenses',
          value: fmt.format(summary.totalExpenses),
          valueColor: AppColors.textPrimary,
        ),
        const _Divider(),
        _FinRow(
          icon: Icons.account_balance_outlined,
          iconColor: AppColors.info,
          iconBg: AppColors.infoBg,
          label: t.x('acc.capital_balance') ?? 'Capital Balance',
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
                t.x('acc.net_pl') ?? 'Net Profit/Loss',
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
      title: t.x('acc.overdue_accounts') ?? 'Overdue Accounts',
      child: overdueAsync.when(
        loading: () => const Skeleton(height: 120),
        error: (e, _) => _InlineError(message: e.toString()),
        data: (list) => list.isEmpty
            ? SizedBox(
                height: 100,
                child: EmptyState(
                  icon: Icons.check_circle_outline_rounded,
                  title: t.x('acc.no_overdue') ?? 'No Overdue',
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
    final fmt = ref.watch(currencyFmtProvider);
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
                    '${item.overdueDays} ${t.x('acc.overdue_days_suffix') ?? 'days overdue'}',
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
              '+ ${items.length - 10} ${t.x('acc.n_more') ?? 'more'}',
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

class _StatementsSection extends ConsumerWidget {
  const _StatementsSection({required this.stmtAsync});
  final AsyncValue<Map<String, dynamic>> stmtAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    double n(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? 0}') ?? 0;

    return _Card(
      title: t.x('acc.statements') ?? 'Financial Statements',
      child: stmtAsync.when(
        loading: () => const Skeleton(height: 160),
        error: (e, _) => _InlineError(message: e.toString()),
        data: (s) {
          final topExpenses = (s['topExpenses'] as List<dynamic>? ?? const []);
          Widget row(String label, double value, Color color) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(label, style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
                    Text(fmt.format(value),
                        style: AppTypography.bodyLarge.copyWith(color: color, fontWeight: FontWeight.w700),),
                  ],
                ),
              );
          final netProfit = n(s['netProfit']);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${s['from'] ?? ''} → ${s['to'] ?? ''}',
                  style: AppTypography.tiny.copyWith(color: AppColors.textLight),),
              const SizedBox(height: 6),
              row(t.x('acc.net_profit') ?? 'Net Profit', netProfit, netProfit >= 0 ? AppColors.success : AppColors.danger),
              row(t.x('acc.cash_bank') ?? 'Cash / Bank Balance', n(s['cashBankBalance']), AppColors.textPrimary),
              row(t.x('acc.inflow') ?? 'Inflow', n(s['totalInflow']), AppColors.success),
              row(t.x('acc.outflow') ?? 'Outflow', n(s['totalOutflow']), AppColors.danger),
              if (topExpenses.isNotEmpty) ...[
                const Divider(height: 18, color: AppColors.border),
                Text(t.x('acc.top_expenses') ?? 'Top Expenses',
                    style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),),
                const SizedBox(height: 6),
                ...topExpenses.take(5).map((e) {
                  final m = e as Map<String, dynamic>;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text('${m['name'] ?? '—'}',
                            style: AppTypography.caption, overflow: TextOverflow.ellipsis,),),
                        Text(fmt.format(n(m['total'])), style: AppTypography.caption),
                      ],
                    ),
                  );
                }),
              ],
            ],
          );
        },
      ),
    );
  }
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
