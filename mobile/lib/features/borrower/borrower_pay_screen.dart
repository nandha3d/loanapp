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

final _borrowerLoansPayProvider =
    FutureProvider.autoDispose<List<BorrowerLoan>>((ref) {
  return ref.watch(borrowerServiceProvider).getLoans();
});

/// Borrower payment screen — select loan → amount → mode → submit.
class BorrowerPayScreen extends ConsumerStatefulWidget {
  const BorrowerPayScreen({super.key});

  @override
  ConsumerState<BorrowerPayScreen> createState() => _BorrowerPayScreenState();
}

class _BorrowerPayScreenState extends ConsumerState<BorrowerPayScreen> {
  String? _selectedLoanId;
  String _paymentMode = 'upi';
  String _amountType = 'next_emi';
  double? _customAmount;
  final _refCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _refCtrl.dispose();
    super.dispose();
  }

  double _computeAmount(BorrowerLoan loan) {
    if (_amountType == 'custom' && _customAmount != null) return _customAmount!;
    final next = loan.nextDue;
    if (_amountType == 'pre_close') return loan.outstandingBalance;
    return next?.outstanding ?? 0;
  }

  Future<void> _submit(BorrowerLoan loan) async {
    final amount = _computeAmount(loan);
    if (amount <= 0) {
      setState(() => _error = 'Amount must be > 0');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    try {
      await ref.read(borrowerServiceProvider).submitPayment(
            loanId: loan.id,
            amount: amount,
            paymentMode: _paymentMode,
            referenceNumber: _refCtrl.text.trim().isEmpty
                ? null
                : _refCtrl.text.trim(),
          );
      setState(() => _success = 'Payment submitted successfully!');
    } catch (e) {
      setState(() => _error = e.toString());
    }
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final loans = ref.watch(_borrowerLoansPayProvider);
    final fmt = ref.watch(currencyFmtProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Make Payment'), centerTitle: true),
      body: loans.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (loanList) {
          if (loanList.isEmpty) {
            return const Center(child: Text('No loans found'));
          }
          _selectedLoanId ??= loanList.first.id;
          final loan = loanList.firstWhere(
            (l) => l.id == _selectedLoanId,
            orElse: () => loanList.first,
          );
          final amount = _computeAmount(loan);

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_error != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: AppColors.dangerBg,
                      borderRadius: BorderRadius.circular(AppTokens.radius),
                    ),
                    child: Text(_error!,
                        style: AppTypography.caption
                            .copyWith(color: AppColors.danger)),
                  ),
                if (_success != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: AppColors.successBg,
                      borderRadius: BorderRadius.circular(AppTokens.radius),
                    ),
                    child: Text(_success!,
                        style: AppTypography.caption
                            .copyWith(color: AppColors.success)),
                  ),
                // Loan selector
                if (loanList.length > 1)
                  DropdownButtonFormField<String>(
                    value: _selectedLoanId,
                    decoration:
                        const InputDecoration(labelText: 'Select Loan'),
                    items: loanList
                        .map((l) => DropdownMenuItem(
                            value: l.id,
                            child: Text(
                                '${l.loanCode} — ${fmt.format(l.principalAmount)}')))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedLoanId = v),
                  ),
                const SizedBox(height: 16),
                // Amount type
                Text('Amount', style: AppTypography.sectionTitle),
                const SizedBox(height: 8),
                _ChoiceChips(
                  selected: _amountType,
                  options: {
                    'next_emi': 'Next EMI',
                    'pre_close': 'Pre-close',
                    'custom': 'Custom',
                  },
                  onChanged: (v) => setState(() => _amountType = v),
                ),
                if (_amountType == 'custom') ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    decoration:
                        const InputDecoration(labelText: 'Custom Amount'),
                    keyboardType: TextInputType.number,
                    onChanged: (v) =>
                        setState(() => _customAmount = double.tryParse(v)),
                  ),
                ],
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(AppTokens.radius),
                  ),
                  child: Text(
                    'Amount to pay: ${fmt.format(amount)}',
                    style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w700, color: AppColors.primary),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 16),
                // Payment mode
                Text('Payment Mode', style: AppTypography.sectionTitle),
                const SizedBox(height: 8),
                _ChoiceChips(
                  selected: _paymentMode,
                  options: {
                    'upi': 'UPI',
                    'card': 'Card',
                    'netbanking': 'Net Banking',
                    'cash': 'Cash',
                  },
                  onChanged: (v) => setState(() => _paymentMode = v),
                ),
                const SizedBox(height: 16),
                // Reference
                TextFormField(
                  controller: _refCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Reference / Transaction ID',
                    hintText: 'e.g. UPI transaction ref',
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : () => _submit(loan),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppTokens.radius),
                      ),
                    ),
                    child: Text(
                        _loading ? 'Submitting…' : 'Submit Payment'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ChoiceChips extends StatelessWidget {
  const _ChoiceChips({
    required this.selected,
    required this.options,
    required this.onChanged,
  });
  final String selected;
  final Map<String, String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 6,
      children: options.entries.map((e) {
        final active = selected == e.key;
        return GestureDetector(
          onTap: () => onChanged(e.key),
          child: AnimatedContainer(
            duration: AppTokens.transition,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: active ? AppColors.primary : AppColors.surface,
              borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
              border: Border.all(
                  color: active ? AppColors.primary : AppColors.border),
            ),
            child: Text(e.value,
                style: AppTypography.label.copyWith(
                    color: active ? Colors.white : AppColors.textSecondary)),
          ),
        );
      }).toList(),
    );
  }
}
