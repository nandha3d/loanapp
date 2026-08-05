import 'dart:typed_data';

import 'package:printing/printing.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/borrower.dart';
import 'package:zolofund/data/services/borrower_service.dart';
import 'package:zolofund/features/borrower/borrower_chit_live_screen.dart';
import 'package:zolofund/features/borrower/borrower_chit_contributions_screen.dart';

final _borrowerLoansProvider =
    FutureProvider.autoDispose<List<BorrowerLoan>>((ref) {
  return ref.watch(borrowerServiceProvider).getLoans();
});

/// Which modules this customer belongs to (loans / chits) — the dashboard
/// routes on this instead of assuming every customer is a loan borrower.
final _borrowerPortalProvider =
    FutureProvider.autoDispose<BorrowerPortal>((ref) {
  return ref.watch(borrowerServiceProvider).getPortal();
});

/// Borrower dashboard — mirrors the web BorrowerDashboardClient.tsx.
/// 5 tabs: Dashboard, Schedule, History, Details, Calculator.
class BorrowerDashboardScreen extends ConsumerStatefulWidget {
  const BorrowerDashboardScreen({super.key});

  @override
  ConsumerState<BorrowerDashboardScreen> createState() =>
      _BorrowerDashboardScreenState();
}

class _BorrowerDashboardScreenState
    extends ConsumerState<BorrowerDashboardScreen> {
  int _tabIndex = 0;
  int _selectedLoanIdx = 0;

  /// Which module view is showing when the customer has both loans and
  /// chits. Null = auto (loans if any, else chits).
  bool? _chitTab;

  // Calculator
  double _calcPrincipal = 50000;
  int _calcTenure = 24;
  double _calcRate = 12;
  String _calcFreq = 'monthly';

  Future<void> _logout() async {
    await ref.read(borrowerServiceProvider).logout();
    if (mounted) context.go('/borrower/login');
  }

  @override
  Widget build(BuildContext context) {
    final portal = ref.watch(_borrowerPortalProvider);
    final loans = ref.watch(_borrowerLoansProvider);
    final fmt = ref.watch(currencyFmtProvider);

    // Which module view to show. Auto: loans if the customer has any, else
    // chits. When both exist a switcher lets them flip. If the portal call
    // fails (older server), fall back to the loans-only behavior.
    final p = portal.valueOrNull;
    final showChits = p != null && p.hasChits && (_chitTab ?? !p.hasLoans);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(showChits ? 'My Chit Funds' : 'My Loans'),
        centerTitle: true,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: portal.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => _loansBody(loans, fmt),
        data: (portal) {
          if (!portal.hasLoans && !portal.hasChits) {
            return _emptyState(
              icon: Icons.person_off_outlined,
              message: 'No active loans or chit memberships for this login.',
            );
          }
          return Column(
            children: [
              if (portal.hasLoans && portal.hasChits)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(
                        value: false,
                        icon: Icon(Icons.account_balance_wallet_outlined),
                        label: Text('Loans'),
                      ),
                      ButtonSegment(
                        value: true,
                        icon: Icon(Icons.groups_outlined),
                        label: Text('Chit Funds'),
                      ),
                    ],
                    selected: {showChits},
                    onSelectionChanged: (s) =>
                        setState(() => _chitTab = s.first),
                  ),
                ),
              Expanded(
                child:
                    showChits ? _chitBody(portal, fmt) : _loansBody(loans, fmt),
              ),
            ],
          );
        },
      ),
      floatingActionButton: !showChits &&
              loans.valueOrNull != null &&
              loans.valueOrNull!.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/borrower/pay'),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.payment),
              label: const Text('Pay Now'),
            )
          : null,
    );
  }

  Widget _emptyState({required IconData icon, required String message}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _logout,
              child: const Text('Logout'),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Chit membership view ───────────────────────────

  Widget _chitBody(BorrowerPortal portal, NumberFormat fmt) {
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(_borrowerPortalProvider),
      child: portal.chitMemberships.isEmpty
          ? ListView(
              children: const [
                Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: Text('No chit memberships found')),
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: portal.chitMemberships.length,
              itemBuilder: (_, i) =>
                  _ChitMembershipCard(m: portal.chitMemberships[i], fmt: fmt),
            ),
    );
  }

  // ─── Loans view (previous whole-screen body) ────────

  Widget _loansBody(AsyncValue<List<BorrowerLoan>> loans, NumberFormat fmt) {
    return loans.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(e.toString())),
      data: (loanList) {
        if (loanList.isEmpty) {
          return _emptyState(
            icon: Icons.account_balance_wallet_outlined,
            message: 'No loans found',
          );
        }

        final loan = loanList[_selectedLoanIdx.clamp(0, loanList.length - 1)];

        return Column(
          children: [
            // Loan selector (if multiple)
            if (loanList.length > 1)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: DropdownButtonFormField<int>(
                  value: _selectedLoanIdx,
                  decoration: const InputDecoration(
                      labelText: 'Select Loan', isDense: true),
                  items: loanList.asMap().entries.map((e) {
                    return DropdownMenuItem(
                      value: e.key,
                      child: Text(
                          '${e.value.loanCode} — ${fmt.format(e.value.principalAmount)}'),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedLoanIdx = v ?? 0),
                ),
              ),
            // Tab bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _TabPill('Dashboard', 0),
                    _TabPill('Schedule', 1),
                    _TabPill('History', 2),
                    _TabPill('Details', 3),
                    _TabPill('Calculator', 4),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            // Tab content
            Expanded(
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async => ref.invalidate(_borrowerLoansProvider),
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_tabIndex == 0) _DashboardTab(loan: loan, fmt: fmt),
                    if (_tabIndex == 1) _ScheduleTab(loan: loan, fmt: fmt),
                    if (_tabIndex == 2) _HistoryTab(loan: loan, fmt: fmt),
                    if (_tabIndex == 3) _DetailsTab(loan: loan, fmt: fmt),
                    if (_tabIndex == 4)
                      _CalculatorTab(
                        principal: _calcPrincipal,
                        tenure: _calcTenure,
                        rate: _calcRate,
                        freq: _calcFreq,
                        fmt: fmt,
                        onChanged: (p, t, r, f) => setState(() {
                          _calcPrincipal = p;
                          _calcTenure = t;
                          _calcRate = r;
                          _calcFreq = f;
                        }),
                      ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _TabPill(String label, int idx) {
    final active = _tabIndex == idx;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: () => setState(() => _tabIndex = idx),
        child: AnimatedContainer(
          duration: AppTokens.transition,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: active ? AppColors.primary : AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
            border: Border.all(
                color: active ? AppColors.primary : AppColors.border),
          ),
          child: Text(label,
              style: AppTypography.label.copyWith(
                  color: active ? Colors.white : AppColors.textSecondary)),
        ),
      ),
    );
  }
}

// ─── Dashboard Tab ───────────────────────────────────

class _DashboardTab extends StatelessWidget {
  const _DashboardTab({required this.loan, required this.fmt});
  final BorrowerLoan loan;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final paidPct = loan.paidPercent;
    final nextDue = loan.nextDue;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Progress ring
        Center(
          child: SizedBox(
            width: 160,
            height: 160,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 160,
                  height: 160,
                  child: CircularProgressIndicator(
                    value: paidPct / 100,
                    strokeWidth: 12,
                    backgroundColor: AppColors.border,
                    valueColor: AlwaysStoppedAnimation(
                        paidPct >= 100 ? AppColors.success : AppColors.primary),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${paidPct.toStringAsFixed(0)}%',
                        style: AppTypography.display
                            .copyWith(color: AppColors.primary)),
                    Text('Repaid', style: AppTypography.caption),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        // KPIs
        Row(
          children: [
            Expanded(
              child: _BorrowerKpi(
                  label: 'Outstanding',
                  value: fmt.format(loan.outstandingBalance)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _BorrowerKpi(
                  label: 'Paid', value: fmt.format(loan.totalPaid)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _BorrowerKpi(
                label: 'Overdue',
                value: loan.overdueCount > 0
                    ? '${loan.overdueCount} (${fmt.format(loan.overdueAmount)})'
                    : 'None',
                isAlert: loan.overdueCount > 0,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _BorrowerKpi(
                label: 'Next Due',
                value: nextDue != null
                    ? '${DateFormat('dd MMM').format(nextDue.dueDate)}\n${fmt.format(nextDue.dueAmount)}'
                    : '—',
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Schedule Tab ────────────────────────────────────

class _ScheduleTab extends StatelessWidget {
  const _ScheduleTab({required this.loan, required this.fmt});
  final BorrowerLoan loan;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final instalments = List<BorrowerInstalment>.from(loan.instalments)
      ..sort((a, b) => a.dueDate.compareTo(b.dueDate));

    return Column(
      children: instalments.map((inst) {
        final isPaid = inst.isPaid;
        final isOverdue = inst.isOverdue;
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            border: Border.all(
              color: isPaid
                  ? AppColors.success.withValues(alpha: 0.3)
                  : isOverdue
                      ? AppColors.danger.withValues(alpha: 0.3)
                      : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isPaid
                      ? AppColors.successBg
                      : isOverdue
                          ? AppColors.dangerBg
                          : AppColors.background,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text('${inst.instNo}',
                      style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w700,
                          color: isPaid
                              ? AppColors.success
                              : isOverdue
                                  ? AppColors.danger
                                  : AppColors.textSecondary)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(DateFormat('dd MMM yyyy').format(inst.dueDate),
                        style: AppTypography.body
                            .copyWith(fontWeight: FontWeight.w600)),
                    Text(fmt.format(inst.dueAmount),
                        style: AppTypography.caption),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isPaid
                      ? AppColors.successBg
                      : isOverdue
                          ? AppColors.dangerBg
                          : AppColors.warningBg,
                  borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
                ),
                child: Text(
                  isPaid
                      ? 'Paid'
                      : isOverdue
                          ? 'Overdue'
                          : 'Pending',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w700,
                    color: isPaid
                        ? AppColors.success
                        : isOverdue
                            ? AppColors.danger
                            : AppColors.warning,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

// ─── History Tab ─────────────────────────────────────

class _HistoryTab extends StatelessWidget {
  const _HistoryTab({required this.loan, required this.fmt});
  final BorrowerLoan loan;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final paid = loan.instalments.where((i) => i.isPaid).toList()
      ..sort(
          (a, b) => (b.paidAt ?? b.dueDate).compareTo(a.paidAt ?? a.dueDate));

    if (paid.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('No payments yet'),
        ),
      );
    }

    return Column(
      children: paid.map((inst) {
        return ListTile(
          dense: true,
          leading: const Icon(Icons.check_circle, color: AppColors.success),
          title: Text(
              'EMI #${inst.instNo} — ${fmt.format(inst.receivedAmount)}',
              style: AppTypography.body),
          subtitle: Text(
            inst.paidAt != null
                ? DateFormat('dd MMM yyyy').format(inst.paidAt!)
                : DateFormat('dd MMM yyyy').format(inst.dueDate),
            style: AppTypography.caption,
          ),
        );
      }).toList(),
    );
  }
}

// ─── Details Tab ─────────────────────────────────────

class _DetailsTab extends ConsumerWidget {
  const _DetailsTab({required this.loan, required this.fmt});
  final BorrowerLoan loan;
  final NumberFormat fmt;

  Future<void> _downloadStatement(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final bytes =
          await ref.read(borrowerServiceProvider).statementPdf(loan.id);
      await Printing.sharePdf(
        bytes: Uint8List.fromList(bytes),
        filename: 'statement-${loan.loanCode}.pdf',
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Could not download statement: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        children: [
          _Row('Loan Code', loan.loanCode),
          _Row('Principal', fmt.format(loan.principalAmount)),
          _Row('Interest Rate', '${loan.interestRate}%'),
          _Row('Tenure', '${loan.tenure} ${loan.frequency}'),
          _Row('Total Payable', fmt.format(loan.totalPayable)),
          _Row('Frequency', loan.frequency),
          _Row('Status', loan.status),
          if (loan.disbursedAt != null)
            _Row('Disbursed',
                DateFormat('dd MMM yyyy').format(loan.disbursedAt!)),
          if (loan.collectionPoint != null)
            _Row('Collection Point', loan.collectionPoint!),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _downloadStatement(context, ref),
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
              label: const Text('Download statement (PDF)'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _Row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: AppTypography.caption
                  .copyWith(color: AppColors.textSecondary)),
          Text(value,
              style: AppTypography.body.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ─── Calculator Tab ──────────────────────────────────

class _CalculatorTab extends StatelessWidget {
  const _CalculatorTab({
    required this.principal,
    required this.tenure,
    required this.rate,
    required this.freq,
    required this.fmt,
    required this.onChanged,
  });
  final double principal;
  final int tenure;
  final double rate;
  final String freq;
  final NumberFormat fmt;
  final void Function(double p, int t, double r, String f) onChanged;

  @override
  Widget build(BuildContext context) {
    // Simple flat interest calculation
    final totalInterest = principal * rate / 100 * tenure / 12;
    final totalPayable = principal + totalInterest;
    int periods = tenure;
    if (freq == 'daily') periods = tenure * 30;
    if (freq == 'weekly') periods = tenure * 4;
    final emi = periods > 0 ? totalPayable / periods : 0;

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
          Text('EMI Calculator', style: AppTypography.sectionTitle),
          const SizedBox(height: 16),
          Text('Principal: ${fmt.format(principal)}',
              style: AppTypography.body),
          Slider(
            value: principal,
            min: 5000,
            max: 1000000,
            divisions: 199,
            activeColor: AppColors.primary,
            onChanged: (v) => onChanged(v, tenure, rate, freq),
          ),
          Text('Tenure: $tenure months', style: AppTypography.body),
          Slider(
            value: tenure.toDouble(),
            min: 1,
            max: 60,
            divisions: 59,
            activeColor: AppColors.primary,
            onChanged: (v) => onChanged(principal, v.round(), rate, freq),
          ),
          Text('Interest Rate: ${rate.toStringAsFixed(1)}%',
              style: AppTypography.body),
          Slider(
            value: rate,
            min: 1,
            max: 36,
            divisions: 70,
            activeColor: AppColors.primary,
            onChanged: (v) => onChanged(principal, tenure, v, freq),
          ),
          Row(
            children: [
              Text('Frequency: ', style: AppTypography.body),
              const SizedBox(width: 8),
              DropdownButton<String>(
                value: freq,
                items: const [
                  DropdownMenuItem(value: 'daily', child: Text('Daily')),
                  DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
                  DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                ],
                onChanged: (v) =>
                    onChanged(principal, tenure, rate, v ?? 'monthly'),
              ),
            ],
          ),
          const Divider(height: 24),
          _ResultRow('Total Interest', fmt.format(totalInterest)),
          _ResultRow('Total Payable', fmt.format(totalPayable)),
          _ResultRow('EMI ($freq)', fmt.format(emi)),
        ],
      ),
    );
  }

  Widget _ResultRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTypography.body),
          Text(value,
              style: AppTypography.body.copyWith(
                  fontWeight: FontWeight.w700, color: AppColors.primary)),
        ],
      ),
    );
  }
}

// ─── Chit membership card ────────────────────────────

class _ChitMembershipCard extends StatelessWidget {
  const _ChitMembershipCard({required this.m, required this.fmt});
  final BorrowerChitMembership m;
  final NumberFormat fmt;

  Color get _statusColor {
    if (m.groupStatus == 'active') return AppColors.success;
    if (m.groupStatus == 'completed') return AppColors.info;
    if (m.groupStatus == 'cancelled') return AppColors.danger;
    return AppColors.textSecondary;
  }

  Color get _statusBg {
    if (m.groupStatus == 'active') return AppColors.successBg;
    if (m.groupStatus == 'completed') return AppColors.infoBg;
    if (m.groupStatus == 'cancelled') return AppColors.dangerBg;
    return AppColors.background;
  }

  String get _statusLabel {
    if (m.groupStatus == 'active') return 'Active';
    if (m.groupStatus == 'completed') return 'Completed';
    if (m.groupStatus == 'cancelled') return 'Cancelled';
    return m.groupStatus.isEmpty
        ? 'Draft'
        : m.groupStatus[0].toUpperCase() + m.groupStatus.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    final roomLive = m.nextAuctionRoomStatus == 'open' ||
        m.nextAuctionRoomStatus == 'extended';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(m.groupName,
                        style: AppTypography.sectionTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    Text(
                      '${m.groupCode != null ? '${m.groupCode} · ' : ''}'
                      'Ticket ${m.ticketNo ?? '—'}',
                      style: AppTypography.caption
                          .copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: m.hasWon ? AppColors.successBg : _statusBg,
                  borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
                ),
                child: Text(
                  m.hasWon ? 'Prize won' : _statusLabel,
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w700,
                    color: m.hasWon ? AppColors.success : _statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _BorrowerKpi(
                    label: 'Chit Value', value: fmt.format(m.chitValue)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _BorrowerKpi(
                    label: 'Monthly', value: fmt.format(m.monthlyContrib)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _BorrowerKpi(
                  label: 'Next Due',
                  value: m.nextDueDate != null
                      ? '${DateFormat('dd MMM').format(m.nextDueDate!)}\n${fmt.format(m.nextDueOutstanding)}'
                      : 'Nothing due',
                  isAlert: m.nextDueStatus == 'missed',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _BorrowerKpi(
                  label: 'Next Auction',
                  value: m.nextAuctionPeriod != null
                      ? 'Period ${m.nextAuctionPeriod}'
                          '${m.nextAuctionDate != null ? '\n${DateFormat('dd MMM').format(m.nextAuctionDate!)}' : ''}'
                      : '—',
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => const BorrowerChitContributionsScreen(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.receipt_long, size: 16),
                  label: const Text('Contributions'),
                  style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                ),
              ),
              if (roomLive && m.nextAuctionId != null) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => BorrowerChitLiveScreen(
                            groupId: m.groupId,
                            auctionId: m.nextAuctionId!,
                            groupName: m.groupName,
                            fallbackChitValue: m.chitValue,
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.podcasts, size: 18),
                    label: const Text('Join Live'),
                    style: FilledButton.styleFrom(backgroundColor: AppColors.success),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Shared Widgets ──────────────────────────────────

class _BorrowerKpi extends StatelessWidget {
  const _BorrowerKpi(
      {required this.label, required this.value, this.isAlert = false});
  final String label, value;
  final bool isAlert;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: isAlert
            ? Border.all(color: AppColors.danger.withValues(alpha: 0.3))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTypography.caption),
          const SizedBox(height: 4),
          Text(value,
              style: AppTypography.body.copyWith(
                fontWeight: FontWeight.w700,
                color: isAlert ? AppColors.danger : AppColors.textPrimary,
              )),
        ],
      ),
    );
  }
}
