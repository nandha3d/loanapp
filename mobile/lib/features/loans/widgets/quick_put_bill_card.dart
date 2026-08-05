import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/collection_entry.dart';
import 'package:zolofund/data/models/loan.dart';
import 'package:zolofund/features/collection/quick_collect_sheet.dart';

/// Auto Finance "Put Bill" card.
///
/// At a traffic signal an agent needs three things on the customer's profile
/// without scrolling: the phone, WhatsApp, and a box to type the cash they
/// just took. This card sits at the top of the loan detail and does exactly
/// that, handing off to the existing QuickCollectSheet for the actual write so
/// offline queueing and receipt generation stay in one place.
class QuickPutBillCard extends ConsumerStatefulWidget {
  const QuickPutBillCard({
    super.key,
    required this.loan,
    required this.dueNow,
    this.onCompleted,
  });

  final Loan loan;

  /// Overdue + today's dues, already computed by the caller.
  final double dueNow;
  final VoidCallback? onCompleted;

  @override
  ConsumerState<QuickPutBillCard> createState() => _QuickPutBillCardState();
}

class _QuickPutBillCardState extends ConsumerState<QuickPutBillCard> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _phone => widget.loan.customer?.phone ?? '';

  /// WhatsApp needs a country-coded number with no separators.
  String get _waNumber {
    final digits = _phone.replaceAll(RegExp(r'\D'), '');
    return digits.length == 10 ? '91$digits' : digits;
  }

  Future<void> _launch(Uri uri) async {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cannot open ${uri.scheme}')),
      );
    }
  }

  /// Opens the shared collect sheet seeded with the typed amount.
  void _putBill() {
    final loan = widget.loan;
    final typed = double.tryParse(_controller.text.trim());

    // Target the oldest unpaid instalment — that is what the money settles.
    final pending = loan.instalments
        .where((i) => i.dynamicStatus != 'paid')
        .toList()
      ..sort((a, b) => a.dueDate.compareTo(b.dueDate));

    if (pending.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nothing outstanding on this account.')),
      );
      return;
    }

    final target = pending.first;
    final row = CollectionRow(
      instalmentId: target.id,
      loanId: target.loanId,
      loanCode: loan.loanCode,
      customerId: loan.customerId,
      customerName: loan.customer?.name ?? '—',
      customerCode: loan.customer?.customerCode ?? '',
      customerPhone: _phone,
      routeName: null,
      dueAmount: typed != null && typed > 0 ? typed : widget.dueNow,
      receivedAmount: target.receivedAmount,
      dueDate: target.dueDate,
      status: target.dynamicStatus,
    );

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuickCollectSheet(row: row, scopeRows: [row]),
    ).then((_) {
      _controller.clear();
      widget.onCompleted?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    final loan = widget.loan;
    final customer = loan.customer;

    final lastPaid = loan.instalments
        .where((i) => i.receivedAt != null)
        .fold<DateTime?>(null, (latest, i) {
      final at = i.receivedAt!;
      return latest == null || at.isAfter(latest) ? at : latest;
    });

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                child: Text(
                  (customer?.name ?? '?').trim().isEmpty
                      ? '?'
                      : (customer!.name).trim()[0].toUpperCase(),
                  style: AppTypography.bodyLarge,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      customer?.name ?? '—',
                      style: AppTypography.bodyLarge,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      lastPaid == null
                          ? 'No payment yet'
                          : 'Last paid ${DateFormat('dd MMM yyyy').format(lastPaid)}',
                      style: AppTypography.bodySmall,
                    ),
                  ],
                ),
              ),
              if (_phone.isNotEmpty) ...[
                IconButton(
                  tooltip: 'Call',
                  icon: Icon(Icons.call, color: AppColors.primary),
                  onPressed: () => _launch(Uri.parse('tel:$_phone')),
                ),
                IconButton(
                  tooltip: 'WhatsApp',
                  icon: const Icon(Icons.chat, color: Color(0xFF25D366)),
                  onPressed: () =>
                      _launch(Uri.parse('https://wa.me/$_waNumber')),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text('Due now', style: AppTypography.bodySmall),
              const SizedBox(width: 6),
              Text(
                fmt.format(widget.dueNow),
                style: AppTypography.bodyLarge.copyWith(
                  color: widget.dueNow > 0 ? AppColors.danger : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Cash collected',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => _putBill(),
                ),
              ),
              const SizedBox(width: 10),
              FilledButton.icon(
                onPressed: _putBill,
                icon: const Icon(Icons.receipt_long, size: 18),
                label: const Text('Put Bill'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
