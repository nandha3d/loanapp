import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/features/loans/loan_detail_screen.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/app_text_field.dart';

class EditLoanScreen extends ConsumerStatefulWidget {
  const EditLoanScreen({super.key, required this.loan});

  final Loan loan;

  @override
  ConsumerState<EditLoanScreen> createState() => _EditLoanScreenState();
}

class _EditLoanScreenState extends ConsumerState<EditLoanScreen> {
  // Scalar fields
  late final _penaltyRate = TextEditingController(
    text: widget.loan.penaltyRate == 0 ? '' : widget.loan.penaltyRate.toString(),
  );
  late final _voucherRef = TextEditingController(text: widget.loan.voucherRef ?? '');
  late final _collateralDetails = TextEditingController(text: widget.loan.collateralDetails ?? '');
  late final _dueDay = TextEditingController(
    text: widget.loan.dueDay == null ? '' : widget.loan.dueDay.toString(),
  );
  late String _loanType = widget.loan.loanType ?? 'cheque';

  // Core fields
  late final _principal = TextEditingController(text: widget.loan.principalAmount.toString());
  late final _tenure = TextEditingController(text: widget.loan.instalmentCount.toString());
  late String _frequency = widget.loan.frequency;
  late DateTime _startDate = widget.loan.startDate;

  // Reason
  final _reason = TextEditingController();

  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _penaltyRate.dispose();
    _voucherRef.dispose();
    _collateralDetails.dispose();
    _dueDay.dispose();
    _principal.dispose();
    _tenure.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null && picked != _startDate) {
      setState(() => _startDate = picked);
    }
  }

  Future<void> _submit() async {
    final t = T.of(ref);
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = t.x('loan.edit_reason'));
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final changes = <String, dynamic>{};

      // Scalar diff
      final newPenalty = double.tryParse(_penaltyRate.text.trim()) ?? 0;
      if (newPenalty != widget.loan.penaltyRate) {
        changes['penaltyRate'] = newPenalty;
      }

      final newVoucher = _voucherRef.text.trim();
      if (newVoucher != (widget.loan.voucherRef ?? '')) {
        changes['voucherRef'] = newVoucher;
      }

      if (_loanType != widget.loan.loanType) {
        changes['loanType'] = _loanType;
      }

      final newCollateral = _collateralDetails.text.trim();
      if (newCollateral != (widget.loan.collateralDetails ?? '')) {
        changes['collateralDetails'] = newCollateral;
      }

      final newDueDayText = _dueDay.text.trim();
      final newDueDay = newDueDayText.isEmpty ? null : int.tryParse(newDueDayText);
      if (newDueDay != widget.loan.dueDay) {
        changes['dueDay'] = newDueDay;
      }

      // Core diff
      final newPrincipal = double.tryParse(_principal.text.trim()) ?? 0;
      if (newPrincipal != widget.loan.principalAmount) {
        changes['principal'] = newPrincipal;
      }

      final newTenure = int.tryParse(_tenure.text.trim()) ?? 0;
      if (newTenure != widget.loan.instalmentCount) {
        changes['tenure'] = newTenure;
      }

      if (_frequency != widget.loan.frequency) {
        changes['frequency'] = _frequency;
      }

      final currentStartStr = DateFormat('yyyy-MM-dd').format(widget.loan.startDate);
      final newStartStr = DateFormat('yyyy-MM-dd').format(_startDate);
      if (newStartStr != currentStartStr) {
        changes['startDate'] = newStartStr;
      }

      changes['reason'] = _reason.text.trim();

      await ref.read(loanServiceProvider).requestEdit(widget.loan.id, changes);

      if (!mounted) return;
      ref.invalidate(loanDetailProvider(widget.loan.id));
      context.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(t.x('loan.edit_submitted')),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('loan.edit_title')),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.danger.withAlpha(25),
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  border: Border.all(color: AppColors.danger),
                ),
                child: Text(
                  _error!,
                  style: AppTypography.body.copyWith(color: AppColors.danger),
                ),
              ),
              const SizedBox(height: 16),
            ],

            Text('Core Schedule Fields', style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            AppTextField(
              label: t.x('fld.principal_amount'),
              controller: _principal,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            AppTextField(
              label: t.x('fld.tenure'),
              controller: _tenure,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            Text(t.x('fld.frequency'), style: AppTypography.label),
            const SizedBox(height: 6),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'daily', label: Text(t.x('plan.daily'))),
                ButtonSegment(value: 'weekly', label: Text(t.x('plan.weekly'))),
                ButtonSegment(value: 'monthly', label: Text(t.x('plan.monthly'))),
              ],
              selected: {_frequency},
              onSelectionChanged: (s) => setState(() => _frequency = s.first),
            ),
            const SizedBox(height: 12),
            Text(t.x('loan.lbl_start_date'), style: AppTypography.label),
            const SizedBox(height: 6),
            InkWell(
              onTap: _pickDate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, size: 20, color: AppColors.textLight),
                    const SizedBox(width: 8),
                    Text(
                      DateFormat('dd MMM yyyy').format(_startDate),
                      style: AppTypography.body,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),
            Text('Scalar Fields', style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            AppTextField(
              label: t.x('loan.fld_penalty_rate'),
              controller: _penaltyRate,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            AppTextField(
              label: t.x('loan.fld_voucher'),
              controller: _voucherRef,
            ),
            const SizedBox(height: 12),
            Text(t.x('loan.fld_loan_type'), style: AppTypography.label),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _loanType,
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                ),
                isDense: true,
              ),
              items: const [
                DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
                DropdownMenuItem(value: 'gold', child: Text('Gold')),
                DropdownMenuItem(value: 'property', child: Text('Property')),
                DropdownMenuItem(value: 'other', child: Text('Other')),
              ],
              onChanged: (v) => setState(() => _loanType = v ?? 'cheque'),
            ),
            const SizedBox(height: 12),
            AppTextField(
              label: 'Due Day (Optional)',
              controller: _dueDay,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            AppTextField(
              label: t.x('loan.fld_collateral'),
              controller: _collateralDetails,
              maxLines: 2,
            ),

            const SizedBox(height: 24),
            Text('Approval Request', style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            AppTextField(
              label: '${t.x('loan.edit_reason')} *',
              controller: _reason,
              maxLines: 2,
            ),

            const SizedBox(height: 32),
            AppButton(
              label: t.x('loan.edit_submit'),
              loading: _submitting,
              onPressed: _submit,
              expand: true,
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
