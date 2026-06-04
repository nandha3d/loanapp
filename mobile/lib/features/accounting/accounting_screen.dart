import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/reports.dart';
import 'package:loantrack/data/services/reports_service.dart';
import 'package:loantrack/data/services/accounting_service.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _accountingSummaryProvider = FutureProvider.autoDispose<AccountingSummary>((ref) {
  return ref.watch(reportsServiceProvider).fetchAccountingSummary();
});

class AccountingScreen extends ConsumerStatefulWidget {
  const AccountingScreen({super.key});

  @override
  ConsumerState<AccountingScreen> createState() => _AccountingScreenState();
}

class _AccountingScreenState extends ConsumerState<AccountingScreen> {
  // Navigation sub-view: 'dashboard', 'coa', 'journal', 'periods', 'statements'
  String _activeView = 'dashboard';

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_activeView == 'dashboard'
            ? t.x('title.accounting')
            : _activeView == 'coa'
                ? 'Chart of Accounts'
                : _activeView == 'journal'
                    ? 'Journal Entries'
                    : _activeView == 'periods'
                        ? 'Fiscal Periods'
                        : 'Financial Statements',),
        centerTitle: true,
        leading: _activeView != 'dashboard'
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _activeView = 'dashboard'),
              )
            : null,
        actions: [
          if (_activeView == 'dashboard')
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: () {
                ref.invalidate(_accountingSummaryProvider);
              },
            ),
        ],
      ),
      body: SafeArea(
        child: _activeView == 'coa'
            ? const _CoAView()
            : _activeView == 'journal'
                ? const _JournalView()
                : _activeView == 'periods'
                    ? const _PeriodsView()
                    : _activeView == 'statements'
                        ? const _StatementsView()
                        : _buildDashboardView(context),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/accounting'),
    );
  }

  Widget _buildDashboardView(BuildContext context) {
    final summaryAsync = ref.watch(_accountingSummaryProvider);

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async {
        ref.invalidate(_accountingSummaryProvider);
        await ref.read(_accountingSummaryProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Metrics Summary
          _SummarySection(summaryAsync: summaryAsync),
          const SizedBox(height: 16),

          // Premium Operations Menu
          Text('Premium Accounting Operations', style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: [
              _MenuTile(
                title: 'Chart of Accounts',
                icon: Icons.account_tree_outlined,
                color: Colors.blue,
                onTap: () => setState(() => _activeView = 'coa'),
              ),
              _MenuTile(
                title: 'Manual Journals',
                icon: Icons.edit_note_outlined,
                color: Colors.amber,
                onTap: () => setState(() => _activeView = 'journal'),
              ),
              _MenuTile(
                title: 'Bank Rec',
                icon: Icons.account_balance_outlined,
                color: Colors.green,
                onTap: () => context.go('/accounting/bank-rec'),
              ),
              _MenuTile(
                title: 'Fiscal Periods',
                icon: Icons.lock_clock_outlined,
                color: Colors.red,
                onTap: () => setState(() => _activeView = 'periods'),
              ),
              _MenuTile(
                title: 'Financial Reports',
                icon: Icons.trending_up_outlined,
                color: Colors.purple,
                onTap: () => setState(() => _activeView = 'statements'),
              ),
            ],
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ── Menu Tile Widget ──────────────────────────────────────────────────────────

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.title, required this.icon, required this.color, required this.onTap});
  final String title;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.1),
              child: Icon(icon, color: color),
            ),
            Text(
              title,
              style: AppTypography.nameLg.copyWith(fontSize: 13),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
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
    final fmt = ref.watch(currencyFmtProvider);
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

// ── Chart of Accounts View (CoA) ──────────────────────────────────────────────

class _CoAView extends ConsumerStatefulWidget {
  const _CoAView();

  @override
  ConsumerState<_CoAView> createState() => _CoAViewState();
}

class _CoAViewState extends ConsumerState<_CoAView> {
  bool _loading = true;
  List<Map<String, dynamic>> _accounts = [];
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetchAccounts();
  }

  Future<void> _fetchAccounts() async {
    setState(() => _loading = true);
    try {
      final list = await ref.read(accountingServiceProvider).listCoA(showInactive: true);
      setState(() {
        _accounts = list;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _toggleAccount(String id) async {
    setState(() => _loading = true);
    try {
      await ref.read(accountingServiceProvider).toggleCoAAccount(id);
      await _fetchAccounts();
    } catch (e) {
      setState(() => _loading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e')),
      );
    }
  }

  Future<void> _reseedCoA() async {
    setState(() => _loading = true);
    try {
      await ref.read(accountingServiceProvider).reseedCoA();
      await _fetchAccounts();
    } catch (e) {
      setState(() => _loading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reseed failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error.isNotEmpty) return Center(child: Text('Error: $_error'));

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${_accounts.length} Accounts in Ledger', style: AppTypography.caption),
              TextButton.icon(
                icon: const Icon(Icons.refresh_outlined, size: 16),
                label: const Text('Reseed CoA'),
                onPressed: _reseedCoA,
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _accounts.length,
            itemBuilder: (context, index) {
              final a = _accounts[index];
              final code = a['code'] as String;
              final name = a['name'] as String;
              final classType = a['classType'] as String? ?? 'asset';
              final isActive = a['isActive'] as bool? ?? true;
              final balance = a['balance'];
              double balAmt = 0.0;
              if (balance != null) {
                final dr = double.tryParse('${balance['closingDr']}') ?? 0.0;
                final cr = double.tryParse('${balance['closingCr']}') ?? 0.0;
                balAmt = a['normalSide'] == 'debit' ? dr - cr : cr - dr;
              }

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('[$code] $name', style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.bold)),
                          Text('${classType.toUpperCase()} · Normal: ${a['normalSide']}', style: AppTypography.caption),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('₹${balAmt.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Switch(
                          value: isActive,
                          onChanged: (v) => _toggleAccount(a['id'] as String),
                          activeThumbColor: AppColors.success,
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ── Manual Journals View ──────────────────────────────────────────────────────

class _JournalView extends ConsumerStatefulWidget {
  const _JournalView();

  @override
  ConsumerState<_JournalView> createState() => _JournalViewState();
}

class _JournalViewState extends ConsumerState<_JournalView> {
  bool _loading = true;
  List<dynamic> _journals = [];
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetchJournals();
  }

  Future<void> _fetchJournals() async {
    setState(() => _loading = true);
    try {
      final res = await ref.read(accountingServiceProvider).listJournals();
      setState(() {
        _journals = res['rows'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _showJournalDetails(Map<String, dynamic> je) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Journal Entry: ${je['entryNo'] ?? 'Draft'}', style: AppTypography.sectionTitle),
              const SizedBox(height: 8),
              Text('Date: ${je['entryDate']?.split('T')[0]}', style: AppTypography.caption),
              Text('Narration: ${je['narration'] ?? 'None'}', style: AppTypography.body),
              Text('Status: ${je['status']?.toUpperCase()}', style: AppTypography.caption.copyWith(fontWeight: FontWeight.bold, color: AppColors.primary)),
              const Divider(height: 24),
              const Text('Transaction splits not shown in summary. Use Web for full double-entry details.', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic)),
              const SizedBox(height: 16),
              if (je['status'] == 'pending_approval') ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      child: const Text('Reject', style: TextStyle(color: AppColors.danger)),
                      onPressed: () async {
                        Navigator.pop(context);
                        setState(() => _loading = true);
                        try {
                          await ref.read(accountingServiceProvider).rejectJournal(je['id'] as String, 'Rejected from mobile');
                          await _fetchJournals();
                        } catch (e) {
                          setState(() => _loading = false);
                        }
                      },
                    ),
                    const SizedBox(width: 8),
                    AppButton(
                      size: AppButtonSize.small,
                      label: 'Approve',
                      onPressed: () async {
                        Navigator.pop(context);
                        setState(() => _loading = true);
                        try {
                          await ref.read(accountingServiceProvider).approveJournal(je['id'] as String);
                          await _fetchJournals();
                        } catch (e) {
                          setState(() => _loading = false);
                        }
                      },
                    ),
                  ],
                ),
              ],
              if (je['status'] == 'posted') ...[
                AppButton(
                  label: 'Reverse Journal Entry',
                  onPressed: () async {
                    Navigator.pop(context);
                    _showReversalReasonDialog(je['id'] as String);
                  },
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  void _showReversalReasonDialog(String jeId) {
    final ctrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Reverse Journal Entry'),
          content: TextField(
            controller: ctrl,
            decoration: const InputDecoration(labelText: 'Reason for reversal *', border: OutlineInputBorder()),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () async {
                final r = ctrl.text.trim();
                if (r.isEmpty) return;
                Navigator.pop(context);
                setState(() => _loading = true);
                try {
                  await ref.read(accountingServiceProvider).reverseJournal(jeId, r);
                  await _fetchJournals();
                } catch (e) {
                  setState(() => _loading = false);
                }
              },
              child: const Text('Reverse', style: TextStyle(color: AppColors.danger)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error.isNotEmpty) return Center(child: Text('Error: $_error'));

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${_journals.length} Journal Entries found', style: AppTypography.caption),
              IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchJournals),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _journals.length,
            itemBuilder: (context, index) {
              final je = Map<String, dynamic>.from(_journals[index] as Map);
              final no = je['entryNo'] as String? ?? 'Draft';
              final narration = je['narration'] as String? ?? '';
              final date = (je['entryDate'] as String).split('T')[0];
              final total = je['totalDebit'] as num? ?? 0;
              final status = je['status'] as String? ?? 'posted';
              final isPosted = status == 'posted';

              return InkWell(
                onTap: () => _showJournalDetails(je),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('$no ($date)', style: AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.bold)),
                            Text(narration, style: AppTypography.caption, maxLines: 1, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('₹${total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isPosted ? AppColors.successBg : AppColors.warningBg,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                fontSize: 8,
                                color: isPosted ? AppColors.success : AppColors.warning,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ── Periods & Locks View ──────────────────────────────────────────────────────

class _PeriodsView extends ConsumerStatefulWidget {
  const _PeriodsView();

  @override
  ConsumerState<_PeriodsView> createState() => _PeriodsViewState();
}

class _PeriodsViewState extends ConsumerState<_PeriodsView> {
  bool _loading = true;
  List<Map<String, dynamic>> _periods = [];
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetchPeriods();
  }

  Future<void> _fetchPeriods() async {
    setState(() => _loading = true);
    try {
      final list = await ref.read(accountingServiceProvider).listPeriods();
      setState(() {
        _periods = list;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _updatePeriod(String action, String periodId, [String? reason]) async {
    setState(() => _loading = true);
    try {
      final service = ref.read(accountingServiceProvider);
      if (action == 'soft_lock') {
        await service.softLockPeriod(periodId, reason);
      } else if (action == 'lock') {
        await service.lockPeriod(periodId, reason);
      } else if (action == 'close') {
        await service.closePeriod(periodId);
      } else if (action == 'unlock') {
        await service.unlockPeriod(periodId, reason!);
      } else if (action == 'reopen') {
        await service.reopenPeriod(periodId, reason!);
      }
      await _fetchPeriods();
    } catch (e) {
      setState(() => _loading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Action failed: $e')),
      );
    }
  }

  void _showPeriodActions(Map<String, dynamic> period) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final status = period['status'] as String? ?? 'open';
        final periodId = period['id'] as String;
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Manage Period: ${period['periodKey']}', style: AppTypography.sectionTitle),
              const SizedBox(height: 16),
              if (status == 'open') ...[
                ListTile(
                  leading: const Icon(Icons.lock_open, color: AppColors.warning),
                  title: const Text('Soft Lock Period (Admins Blocked)'),
                  onTap: () {
                    Navigator.pop(context);
                    _promptReason('soft_lock', periodId);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.lock, color: AppColors.danger),
                  title: const Text('Hard Lock Period (Everyone Blocked)'),
                  onTap: () {
                    Navigator.pop(context);
                    _promptReason('lock', periodId);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.check_circle_outline, color: AppColors.success),
                  title: const Text('Close Period & Transfer Profit'),
                  onTap: () {
                    Navigator.pop(context);
                    _updatePeriod('close', periodId);
                  },
                ),
              ],
              if (status == 'locked' || status == 'soft_locked') ...[
                ListTile(
                  leading: const Icon(Icons.lock_open, color: AppColors.primary),
                  title: const Text('Unlock Period'),
                  onTap: () {
                    Navigator.pop(context);
                    _promptReason('unlock', periodId);
                  },
                ),
              ],
              if (status == 'closed') ...[
                ListTile(
                  leading: const Icon(Icons.replay_outlined, color: AppColors.danger),
                  title: const Text('Reopen & Reverse Closing JE'),
                  onTap: () {
                    Navigator.pop(context);
                    _promptReason('reopen', periodId);
                  },
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  void _promptReason(String action, String periodId) {
    final ctrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('${action.replaceAll('_', ' ').toUpperCase()} Reason'),
          content: TextField(
            controller: ctrl,
            decoration: const InputDecoration(
              labelText: 'Enter justification (min 10 chars) *',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                final r = ctrl.text.trim();
                if (r.length < 10) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Justification must be at least 10 characters long')),
                  );
                  return;
                }
                Navigator.pop(context);
                _updatePeriod(action, periodId, r);
              },
              child: const Text('Submit'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error.isNotEmpty) return Center(child: Text('Error: $_error'));

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _periods.length,
      itemBuilder: (context, index) {
        final p = _periods[index];
        final status = p['status'] as String? ?? 'open';
        final isClosed = status == 'closed';
        final profit = p['netProfit'] as num? ?? 0.0;

        return InkWell(
          onTap: () => _showPeriodActions(p),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppTokens.radius),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Key: ${p['periodKey']} (${p['fiscalYear']})', style: AppTypography.nameLg.copyWith(fontSize: 14)),
                    Text('Net P&L: ₹${profit.toStringAsFixed(2)}', style: AppTypography.caption),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isClosed
                        ? AppColors.successBg
                        : status.contains('lock')
                            ? AppColors.dangerBg
                            : AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: AppTypography.tiny.copyWith(
                      color: isClosed
                          ? AppColors.success
                          : status.contains('lock')
                              ? AppColors.danger
                              : AppColors.primaryDark,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Financial Statements View ─────────────────────────────────────────────────

class _StatementsView extends ConsumerStatefulWidget {
  const _StatementsView();

  @override
  ConsumerState<_StatementsView> createState() => _StatementsViewState();
}

class _StatementsViewState extends ConsumerState<_StatementsView> {
  String _statementType = 'pnl'; // 'pnl', 'balance', 'trial'
  bool _loading = false;
  Map<String, dynamic>? _pnlData;
  Map<String, dynamic>? _balanceData;
  Map<String, dynamic>? _trialData;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  Future<void> _loadReport() async {
    setState(() => _loading = true);
    try {
      final service = ref.read(accountingServiceProvider);
      if (_statementType == 'pnl') {
        final data = await service.getPnL();
        setState(() => _pnlData = data);
      } else if (_statementType == 'balance') {
        final data = await service.getBalanceSheet();
        setState(() => _balanceData = data);
      } else {
        final data = await service.getTrialBalance();
        setState(() => _trialData = data);
      }
      setState(() => _loading = false);
    } catch (e) {
      setState(() => _loading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load statement: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Dropdown Selector
        Padding(
          padding: const EdgeInsets.all(16),
          child: DropdownButtonFormField<String>(
            initialValue: _statementType,
            decoration: const InputDecoration(labelText: 'Statement Type', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'pnl', child: Text('Profit & Loss (P&L)')),
              DropdownMenuItem(value: 'balance', child: Text('Balance Sheet')),
              DropdownMenuItem(value: 'trial', child: Text('Trial Balance')),
            ],
            onChanged: (val) {
              if (val != null) {
                setState(() => _statementType = val);
                _loadReport();
              }
            },
          ),
        ),

        // Display report content
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _statementType == 'pnl'
                  ? _buildPnLReport()
                  : _statementType == 'balance'
                      ? _buildBalanceReport()
                      : _buildTrialReport(),
        ),
      ],
    );
  }

  Widget _buildPnLReport() {
    if (_pnlData == null) return const SizedBox();
    final income = _pnlData!['incomeAccounts'] as List<dynamic>? ?? [];
    final expenses = _pnlData!['expenseAccounts'] as List<dynamic>? ?? [];
    final totalIn = _pnlData!['totalIncome'] as num? ?? 0.0;
    final totalEx = _pnlData!['totalExpense'] as num? ?? 0.0;
    final net = _pnlData!['netProfit'] as num? ?? 0.0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Revenue (Credit Accounts)', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.success, fontSize: 15)),
        const Divider(),
        ...income.map((i) => _ReportRow(name: i['name'] as String, code: i['code'] as String, amount: i['amount'] as num)),
        _ReportRow(name: 'TOTAL REVENUE', code: '', amount: totalIn, isBold: true),
        const SizedBox(height: 20),
        const Text('Expenses (Debit Accounts)', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.danger, fontSize: 15)),
        const Divider(),
        ...expenses.map((e) => _ReportRow(name: e['name'] as String, code: e['code'] as String, amount: e['amount'] as num)),
        _ReportRow(name: 'TOTAL EXPENSES', code: '', amount: totalEx, isBold: true),
        const Divider(height: 32, thickness: 2),
        _ReportRow(name: 'NET PROFIT / LOSS', code: '', amount: net, isBold: true, color: net >= 0 ? AppColors.success : AppColors.danger),
      ],
    );
  }

  Widget _buildBalanceReport() {
    if (_balanceData == null) return const SizedBox();
    final groups = _balanceData!['groups'] as Map<String, dynamic>? ?? {};
    final assets = groups['asset'] as List<dynamic>? ?? [];
    final liabilities = groups['liability'] as List<dynamic>? ?? [];
    final equity = groups['equity'] as List<dynamic>? ?? [];

    final totA = _balanceData!['totalAssets'] as num? ?? 0.0;
    final totL = _balanceData!['totalLiabilities'] as num? ?? 0.0;
    final totE = _balanceData!['totalEquity'] as num? ?? 0.0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Assets', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const Divider(),
        ...assets.map((a) => _ReportRow(name: a['name'] as String, code: a['code'] as String, amount: a['amount'] as num)),
        _ReportRow(name: 'TOTAL ASSETS', code: '', amount: totA, isBold: true),
        const SizedBox(height: 20),
        const Text('Liabilities', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const Divider(),
        ...liabilities.map((l) => _ReportRow(name: l['name'] as String, code: l['code'] as String, amount: l['amount'] as num)),
        _ReportRow(name: 'TOTAL LIABILITIES', code: '', amount: totL, isBold: true),
        const SizedBox(height: 20),
        const Text('Equity', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const Divider(),
        ...equity.map((eq) => _ReportRow(name: eq['name'] as String, code: eq['code'] as String, amount: eq['amount'] as num)),
        _ReportRow(name: 'TOTAL EQUITY', code: '', amount: totE, isBold: true),
      ],
    );
  }

  Widget _buildTrialReport() {
    if (_trialData == null) return const SizedBox();
    final rows = _trialData!['rows'] as List<dynamic>? ?? [];
    final totDr = _trialData!['totalDebit'] as num? ?? 0.0;
    final totCr = _trialData!['totalCredit'] as num? ?? 0.0;

    return Column(
      children: [
        // Table Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: AppColors.border,
          child: const Row(
            children: [
              Expanded(child: Text('Account', style: TextStyle(fontWeight: FontWeight.bold))),
              SizedBox(width: 80, child: Text('Debit', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold))),
              SizedBox(width: 80, child: Text('Credit', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold))),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...rows.map((r) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(child: Text('[${r['code']}] ${r['name']}')),
                        SizedBox(width: 80, child: Text('₹${r['debit']}', textAlign: TextAlign.right)),
                        SizedBox(width: 80, child: Text('₹${r['credit']}', textAlign: TextAlign.right)),
                      ],
                    ),
                  ),),
              const Divider(height: 24, thickness: 2),
              Row(
                children: [
                  const Expanded(child: Text('TOTALS', style: TextStyle(fontWeight: FontWeight.bold))),
                  SizedBox(width: 80, child: Text('₹${totDr.toStringAsFixed(2)}', textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.bold))),
                  SizedBox(width: 80, child: Text('₹${totCr.toStringAsFixed(2)}', textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.bold))),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({required this.name, required this.code, required this.amount, this.isBold = false, this.color});
  final String name;
  final String code;
  final num amount;
  final bool isBold;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              code.isNotEmpty ? '[$code] $name' : name,
              style: TextStyle(
                fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
                color: color ?? AppColors.textPrimary,
              ),
            ),
          ),
          Text(
            '₹${amount.toStringAsFixed(2)}',
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: color ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
