import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/loan.dart';
import 'package:zolofund/data/services/loan_service.dart';
import 'package:zolofund/features/loans/loan_detail_screen.dart';
import 'package:zolofund/shared/widgets/app_button.dart';
import 'package:zolofund/shared/widgets/app_text_field.dart';

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
  late final Map<String, TextEditingController> _col = () {
    Map<String, dynamic> parsed = const {};
    try {
      final d = jsonDecode(widget.loan.collateralDetails ?? '');
      if (d is Map<String, dynamic>) parsed = d;
    } catch (_) {}
    return {
      for (final k in const ['bankName', 'chequeNumber', 'chequeAmount', 'grams', 'carat', 'items', 'type', 'value', 'address'])
        k: TextEditingController(text: '${parsed[k] ?? ''}'),
    };
  }();
  List<String> get _collateralKeys => switch (_loanType) {
        'gold' => const ['grams', 'carat', 'items'],
        'property' => const ['type', 'value', 'address'],
        'other' => const [],
        _ => const ['bankName', 'chequeNumber', 'chequeAmount'],
      };
  String _collateralJson() {
    final storedRaw = widget.loan.collateralDetails ?? '';
    if (_collateralKeys.isEmpty) return _collateralDetails.text.trim();
    Map<String, dynamic> stored = const {};
    try {
      final d = jsonDecode(storedRaw);
      if (d is Map<String, dynamic>) stored = d;
    } catch (_) {}
    // Start from what is stored (keeps keys this form does not edit), then
    // apply the visible fields; an emptied field removes its key.
    final m = Map<String, dynamic>.of(stored);
    var changed = false;
    for (final k in _collateralKeys) {
      final text = _col[k]!.text.trim();
      final Object? next = text.isEmpty
          ? null
          : (const {'chequeAmount', 'grams', 'value'}.contains(k)
              ? (num.tryParse(text) ?? text)
              : text);
      if ('${stored[k] ?? ''}' == '${next ?? ''}') continue;
      changed = true;
      if (next == null) {
        m.remove(k);
      } else {
        m[k] = next;
      }
    }
    // Untouched form → the stored string, so no collateral change is filed.
    if (!changed) return storedRaw;
    return m.isEmpty ? '' : jsonEncode(m);
  }

  static const _weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  late int? _dueDay = widget.loan.dueDay;
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

      final newCollateral = _collateralJson();
      if (newCollateral != (widget.loan.collateralDetails ?? '')) {
        changes['collateralDetails'] = newCollateral;
      }

      if (_frequency == 'weekly' || _frequency == 'biweekly') {
        if (_dueDay == null || _dueDay! < 0 || _dueDay! > 6) {
          setState(() => _error = 'Due day (Sun–Sat) is required for ${_frequency} loans');
          return;
        }
      } else if (_frequency == 'monthly') {
        if (_dueDay == null || _dueDay! < 1 || _dueDay! > 28) {
          setState(() => _error = 'Due day (1–28) is required for monthly loans');
          return;
        }
      }

      if (_dueDay != widget.loan.dueDay) {
        changes['dueDay'] = _dueDay;
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
            // LOAN-03: every frequency (a biweekly / single-payment loan no
            // longer breaks the selector).
            DropdownButtonFormField<String>(
              initialValue: _frequency,
              isExpanded: true,
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                ),
                isDense: true,
              ),
              items: [
                for (final f in {
                  'daily', 'weekly', 'biweekly', 'monthly',
                  'single_payment', 'custom_duration', widget.loan.frequency,
                })
                  DropdownMenuItem(value: f, child: Text(t.x('plan.$f'))),
              ],
              onChanged: (v) => setState(() => _frequency = v ?? _frequency),
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
            if (_frequency == 'weekly' || _frequency == 'biweekly' || _frequency == 'monthly') ...[
              const SizedBox(height: 12),
              Text('${t.x('fld.due_day')} *', style: AppTypography.label),
              const SizedBox(height: 6),
              DropdownButtonFormField<int>(
                key: ValueKey('dueDay_${_frequency}_$_dueDay'),
                initialValue: _dueDay,
                isExpanded: true,
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                  isDense: true,
                  hintText: t.x('fld.due_day_hint'),
                ),
                items: (_frequency == 'weekly' || _frequency == 'biweekly')
                    ? [
                        for (var d = 0; d <= 6; d++)
                          DropdownMenuItem(
                            value: d,
                            child: Text(_weekdays[d.clamp(0, 6)]),
                          ),
                      ]
                    : [
                        for (var d = 1; d <= 28; d++)
                          DropdownMenuItem(value: d, child: Text('$d')),
                      ],
                onChanged: (v) => setState(() => _dueDay = v),
              ),
            ],
            const SizedBox(height: 12),
            // LOAN-03: structured collateral fields, same keys as the web form.
            if (_collateralKeys.isEmpty)
              AppTextField(
                label: t.x('loan.fld_collateral'),
                controller: _collateralDetails,
                maxLines: 2,
              )
            else
              for (final k in _collateralKeys) ...[
                AppTextField(
                  label: t.x('col.$k'),
                  controller: _col[k]!,
                  keyboardType: const {'chequeAmount', 'grams', 'value'}.contains(k)
                      ? TextInputType.number
                      : TextInputType.text,
                ),
                const SizedBox(height: 8),
              ],

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
