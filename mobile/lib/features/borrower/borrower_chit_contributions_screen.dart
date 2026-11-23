import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/chit_contribution.dart';
import 'package:zolofund/data/services/borrower_chit_service.dart';
import 'package:zolofund/features/chits/dividend_breakdown.dart';

final _contributionsProvider = FutureProvider.autoDispose<
    ({List<ChitContributionGroup> groups, List<ChitReceiptSummary> receipts})>((ref) {
  return ref.watch(borrowerChitServiceProvider).contributions();
});

final _myPaymentIntentsProvider =
    FutureProvider.autoDispose<List<ChitPaymentIntent>>((ref) {
  return ref.watch(borrowerChitServiceProvider).myPaymentIntents();
});

/// Doc 22b — current-period-first contributions view (mirrors
/// app/borrower/chits/page.tsx), plus doc 19's "I've paid" proof upload.
class BorrowerChitContributionsScreen extends ConsumerWidget {
  const BorrowerChitContributionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_contributionsProvider);
    final fmt = ref.watch(currencyFmtProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Contributions & Receipts'), centerTitle: true),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load: $e')),
        data: (d) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(_contributionsProvider);
            ref.invalidate(_myPaymentIntentsProvider);
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Contributions', style: AppTypography.sectionTitle),
              const SizedBox(height: 10),
              if (d.groups.isEmpty)
                const _EmptyCard(text: 'No contributions yet.')
              else
                ...d.groups.map((g) => _GroupCard(group: g, fmt: fmt)),
              const SizedBox(height: 24),
              Text('Receipts', style: AppTypography.sectionTitle),
              const SizedBox(height: 10),
              if (d.receipts.isEmpty)
                const _EmptyCard(text: 'No receipts yet.')
              else
                ...d.receipts.map((r) => _ReceiptRow(receipt: r, fmt: fmt)),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Text(text, style: AppTypography.body.copyWith(color: AppColors.textSecondary)),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({required this.receipt, required this.fmt});
  final ChitReceiptSummary receipt;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
                Text(receipt.receiptNo, style: AppTypography.body.copyWith(fontWeight: FontWeight.w700)),
                Text(
                  '${receipt.receiptType} · ${receipt.paymentMode} · ${DateFormat('dd MMM yyyy').format(receipt.issuedAt)}',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          Text(fmt.format(receipt.amount), style: AppTypography.body.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _GroupCard extends ConsumerWidget {
  const _GroupCard({required this.group, required this.fmt});
  final ChitContributionGroup group;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allCaughtUp = group.current == null && group.overdue.isEmpty && group.upcoming.isEmpty;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  group.groupName,
                  style: AppTypography.body.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              if (group.engineName.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    group.engineName,
                    style: AppTypography.tiny.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
            ],
          ),
          if (group.memberSummary != null) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    group.isCompleted
                        ? 'Final Chit & Dividend Summary (${group.completedPeriodsCount}/${group.totalPeriods} periods)'
                        : 'Dividend & Balance Summary (${group.completedPeriodsCount}/${group.totalPeriods} periods)',
                    style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 14,
                    runSpacing: 6,
                    children: [
                      _summaryStat('Dividend Earned', fmt.format(group.memberSummary!.totalDividendEarned), color: AppColors.success),
                      if (group.memberSummary!.totalDeferredDividend > 0)
                        _summaryStat('Deferred Bonus', fmt.format(group.memberSummary!.totalDeferredDividend)),
                      _summaryStat('Total Paid', fmt.format(group.memberSummary!.totalPaid)),
                      _summaryStat('Outstanding', fmt.format(group.memberSummary!.totalOutstanding)),
                      if (group.memberSummary!.totalPremiumCharged > 0)
                        _summaryStat('Premiums', fmt.format(group.memberSummary!.totalPremiumCharged)),
                      if (group.memberSummary!.totalWinnerInterest > 0)
                        _summaryStat('Winner Interest', fmt.format(group.memberSummary!.totalWinnerInterest)),
                      if (group.memberSummary!.goldTotalGrams > 0)
                        _summaryStat('Gold Credited', '${group.memberSummary!.goldTotalGrams.toStringAsFixed(3)} g'),
                      _summaryStat(
                        'Net Outcome',
                        fmt.format(group.memberSummary!.netFinancialOutcome),
                        color: group.memberSummary!.netFinancialOutcome >= 0 ? AppColors.success : AppColors.textPrimary,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          if (group.current != null)
            _PeriodTile(c: group.current!, fmt: fmt, showProofButton: true)
          else if (allCaughtUp)
            Text("You're all caught up.",
                style: AppTypography.body.copyWith(color: AppColors.success, fontWeight: FontWeight.w700),),
          if (group.overdue.isNotEmpty)
            _PeriodExpansion(title: 'Overdue', items: group.overdue, fmt: fmt, danger: true, showProofButton: true),
          if (group.upcoming.isNotEmpty)
            _PeriodExpansion(title: 'Upcoming', items: group.upcoming, fmt: fmt),
          if (group.history.isNotEmpty)
            _PeriodExpansion(title: 'History', items: group.history, fmt: fmt),
          if (group.completedPeriodBreakdowns.isNotEmpty)
            _CompletedPeriodBreakdownExpansion(group: group, fmt: fmt),
        ],
      ),
    );
  }

  Widget _summaryStat(String label, String value, {Color? color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.tiny.copyWith(color: AppColors.textSecondary)),
        Text(
          value,
          style: AppTypography.caption.copyWith(
            fontWeight: FontWeight.w700,
            color: color ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _CompletedPeriodBreakdownExpansion extends StatelessWidget {
  const _CompletedPeriodBreakdownExpansion({required this.group, required this.fmt});
  final ChitContributionGroup group;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Period Dividend Breakdown',
              style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${group.completedPeriodBreakdowns.length}',
                style: AppTypography.tiny.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
        children: group.completedPeriodBreakdowns.map((b) {
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Period ${b.periodNumber} · Winner Ticket ${b.winnerTicketNo ?? '—'}',
                      style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      'My Dividend: ${fmt.format(b.myDividend)}',
                      style: AppTypography.caption.copyWith(
                        fontWeight: FontWeight.w800,
                        color: b.forfeitedOnLate ? AppColors.danger : AppColors.success,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                DividendBreakdown(
                  chitValue: b.chitValue,
                  prizeAmount: b.prizeAmount,
                  bidDiscount: b.bidDiscount,
                  commissionPct: b.commissionPct,
                  commissionBasis: b.commissionBasis,
                  commission: b.commission,
                  gstPct: b.gstPct,
                  gstAmount: b.gstAmount,
                  distributableDividend: b.distributableDividend,
                  dividendEligibleMembers: b.dividendEligibleMembers,
                  dividend: b.dividendPerTicket,
                  roundingIncome: b.roundingIncome,
                  dividendPolicy: group.dividendPolicy,
                  dividendDistribution: group.dividendDistribution,
                  fmt: fmt,
                  engineType: group.chitEngineType,
                  reserveFloorAmount: b.reserveFloorAmount,
                  foremanCompensationMode: b.foremanCompensationMode,
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _PeriodExpansion extends StatelessWidget {
  const _PeriodExpansion({
    required this.title,
    required this.items,
    required this.fmt,
    this.danger = false,
    this.showProofButton = false,
  });
  final String title;
  final List<ChitContribution> items;
  final NumberFormat fmt;
  final bool danger;
  final bool showProofButton;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: AppTypography.body.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: danger ? AppColors.danger.withValues(alpha: 0.12) : AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('${items.length}',
                  style: AppTypography.tiny.copyWith(
                      fontWeight: FontWeight.w700, color: danger ? AppColors.danger : AppColors.textSecondary,),),
            ),
          ],
        ),
        children: items.map((c) => _PeriodTile(c: c, fmt: fmt, showProofButton: showProofButton)).toList(),
      ),
    );
  }
}

class _PeriodTile extends ConsumerWidget {
  const _PeriodTile({required this.c, required this.fmt, this.showProofButton = false});
  final ChitContribution c;
  final NumberFormat fmt;
  final bool showProofButton;

  Color _statusColor() {
    if (c.status == 'paid') return AppColors.success;
    if (c.status == 'missed') return AppColors.danger;
    return AppColors.warning;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Period ${c.periodNumber}', style: AppTypography.body.copyWith(fontWeight: FontWeight.w700)),
                  Text('Due ${DateFormat('dd MMM yyyy').format(c.dueDate)}',
                      style: AppTypography.tiny.copyWith(color: AppColors.textSecondary),),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: _statusColor().withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(c.status, style: AppTypography.tiny.copyWith(fontWeight: FontWeight.w700, color: _statusColor())),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 4,
            children: [
              _stat('Base', fmt.format(c.baseDueAmount)),
              _stat('Dividend', fmt.format(c.dividendAmount)),
              if (c.deferredDividendAmount > 0)
                _stat('Deferred Div', fmt.format(c.deferredDividendAmount)),
              if (c.premiumAmount > 0)
                _stat('Premium', fmt.format(c.premiumAmount)),
              if (c.interestAmount > 0)
                _stat('Interest', fmt.format(c.interestAmount)),
              _stat('Penalty', fmt.format(c.penaltyAmount)),
              if (c.goldGramsCredited > 0)
                _stat('Gold', '${c.goldGramsCredited.toStringAsFixed(3)} g'),
              _stat('Net Due', fmt.format(c.netDue)),
              _stat('Paid', fmt.format(c.paidAmount)),
              _stat('Outstanding', fmt.format(c.outstanding), bold: true),
            ],
          ),
          if (c.dividendForfeited) ...[
            const SizedBox(height: 4),
            Text(
              'Dividend forfeited due to late payment.',
              style: AppTypography.tiny.copyWith(color: AppColors.danger, fontWeight: FontWeight.w600),
            ),
          ],
          if (showProofButton && c.status != 'paid' && c.outstanding > 0) ...[
            const SizedBox(height: 10),
            _ProofButton(subscriptionId: c.subscriptionId, outstanding: c.outstanding),
          ],
        ],
      ),
    );
  }

  Widget _stat(String label, String value, {bool bold = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.tiny.copyWith(color: AppColors.textSecondary)),
        Text(value, style: AppTypography.caption.copyWith(fontWeight: bold ? FontWeight.w800 : FontWeight.w600)),
      ],
    );
  }
}

class _ProofButton extends ConsumerStatefulWidget {
  const _ProofButton({required this.subscriptionId, required this.outstanding});
  final String subscriptionId;
  final double outstanding;

  @override
  ConsumerState<_ProofButton> createState() => _ProofButtonState();
}

class _ProofButtonState extends ConsumerState<_ProofButton> {
  bool? _pending;

  @override
  void initState() {
    super.initState();
    _checkPending();
  }

  Future<void> _checkPending() async {
    try {
      final intents = await ref.read(borrowerChitServiceProvider).myPaymentIntents();
      final hasPending = intents.any((i) => i.subscriptionId == widget.subscriptionId && i.status == 'pending');
      if (mounted) setState(() => _pending = hasPending);
    } catch (_) {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_pending == null) return const SizedBox.shrink();
    if (_pending == true) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
        child: Text('Pending review',
            style: AppTypography.tiny.copyWith(fontWeight: FontWeight.w700, color: AppColors.warning),),
      );
    }
    return OutlinedButton.icon(
      onPressed: () => _openSheet(context),
      icon: const Icon(Icons.upload_file, size: 16),
      label: const Text("I've paid — upload proof"),
      style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
    );
  }

  void _openSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PaymentProofSheet(
        subscriptionId: widget.subscriptionId,
        outstanding: widget.outstanding,
        onSubmitted: () {
          setState(() => _pending = true);
        },
      ),
    );
  }
}

class _PaymentProofSheet extends ConsumerStatefulWidget {
  const _PaymentProofSheet({required this.subscriptionId, required this.outstanding, required this.onSubmitted});
  final String subscriptionId;
  final double outstanding;
  final VoidCallback onSubmitted;

  @override
  ConsumerState<_PaymentProofSheet> createState() => _PaymentProofSheetState();
}

class _PaymentProofSheetState extends ConsumerState<_PaymentProofSheet> {
  late final TextEditingController _amountCtrl =
      TextEditingController(text: widget.outstanding > 0 ? widget.outstanding.toStringAsFixed(0) : '');
  final TextEditingController _refCtrl = TextEditingController();
  String _mode = 'upi';
  File? _file;
  bool _busy = false;
  String? _error;

  Future<void> _pickFile() async {
    final picker = ImagePicker();
    final shot = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 80);
    if (shot != null && mounted) setState(() => _file = File(shot.path));
  }

  Future<void> _submit() async {
    if (_file == null) {
      setState(() => _error = 'Please attach a screenshot or photo of your payment.');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final svc = ref.read(borrowerChitServiceProvider);
      final upload = await svc.uploadProof(_file!, contentType: 'image/jpeg');
      await svc.submitPaymentIntent(
        subscriptionId: widget.subscriptionId,
        paymentMode: _mode,
        proofUrl: upload.url,
        proofFileName: upload.filename,
        amount: double.tryParse(_amountCtrl.text),
        referenceNo: _refCtrl.text,
        proofMimeType: 'image/jpeg',
        proofSizeBytes: upload.size,
      );
      widget.onSubmitted();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Submit payment proof', style: AppTypography.sectionTitle),
          const SizedBox(height: 14),
          TextField(
            controller: _amountCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Amount paid', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _mode,
            decoration: const InputDecoration(labelText: 'Payment mode', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'upi', child: Text('UPI')),
              DropdownMenuItem(value: 'bank_transfer', child: Text('Bank transfer')),
              DropdownMenuItem(value: 'cash', child: Text('Cash')),
              DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
            ],
            onChanged: (v) => setState(() => _mode = v ?? 'upi'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _refCtrl,
            decoration: const InputDecoration(labelText: 'Reference / UTR number (optional)', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _pickFile,
            icon: const Icon(Icons.attach_file),
            label: Text(_file == null ? 'Attach screenshot / photo' : 'Photo attached ✓'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.danger)),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _busy ? null : _submit,
              child: _busy ? const CircularProgressIndicator() : const Text('Submit'),
            ),
          ),
        ],
      ),
    );
  }
}
