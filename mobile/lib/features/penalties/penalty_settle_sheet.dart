import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/penalty.dart';
import 'package:loantrack/data/services/penalty_service.dart';
import 'package:loantrack/features/customers/widgets/filter_pill.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class PenaltySettleSheet extends ConsumerStatefulWidget {
  const PenaltySettleSheet({super.key, required this.penalty, required this.due});
  final Penalty penalty;
  final double due;

  @override
  ConsumerState<PenaltySettleSheet> createState() => _PenaltySettleSheetState();
}

class _PenaltySettleSheetState extends ConsumerState<PenaltySettleSheet> {
  late final TextEditingController _amount =
      TextEditingController(text: widget.due.toStringAsFixed(0));
  String _mode = 'cash';
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amt = double.tryParse(_amount.text.trim());
    if (amt == null || amt <= 0) return;
    setState(() => _busy = true);
    try {
      await ref.read(penaltyServiceProvider).settle(
            id: widget.penalty.id,
            amount: amt,
            paymentMode: _mode,
          );
      if (!mounted) return;
      Navigator.pop(context, true);
    } on Object catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppTokens.radius)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text('Settle Penalty', style: AppTypography.sectionTitle),
            const SizedBox(height: 2),
            Text(
              '${widget.penalty.customerName} • ${widget.penalty.loanCode}',
              style: AppTypography.bodySmall,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount',
                prefixText: '₹ ',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            Text('Payment Mode', style: AppTypography.label),
            const SizedBox(height: 8),
            Row(
              children: [
                FilterPill(
                  label: 'Cash',
                  selected: _mode == 'cash',
                  onTap: () => setState(() => _mode = 'cash'),
                ),
                const SizedBox(width: 8),
                FilterPill(
                  label: 'UPI',
                  selected: _mode == 'upi',
                  onTap: () => setState(() => _mode = 'upi'),
                ),
                const SizedBox(width: 8),
                FilterPill(
                  label: 'Bank',
                  selected: _mode == 'bank',
                  onTap: () => setState(() => _mode = 'bank'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            AppButton(
              label: 'Confirm Settlement',
              expand: true,
              loading: _busy,
              onPressed: _busy ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
