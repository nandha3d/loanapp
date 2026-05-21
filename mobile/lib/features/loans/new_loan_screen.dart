import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/loan_calc.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/app_text_field.dart';

/// 5-step new-loan wizard per design.md Screen 6:
/// 1. Customer 2. Package/Principal 3. Terms 4. Disbursement 5. Review
class NewLoanScreen extends ConsumerStatefulWidget {
  const NewLoanScreen({super.key});

  @override
  ConsumerState<NewLoanScreen> createState() => _NewLoanScreenState();
}

class _NewLoanScreenState extends ConsumerState<NewLoanScreen> {
  final _principal = TextEditingController(text: '50000');
  final _interestRate = TextEditingController(text: '2');
  final _tenure = TextEditingController(text: '52');
  final _penaltyRate = TextEditingController(text: '1.5');

  final _page = PageController();
  int _step = 0;
  Customer? _customer;
  String _frequency = 'weekly';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  LoanCalculation? _calc;
  bool _calculating = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _principal.dispose();
    _interestRate.dispose();
    _tenure.dispose();
    _penaltyRate.dispose();
    _page.dispose();
    super.dispose();
  }

  void _go(int i) {
    setState(() => _step = i);
    _page.animateToPage(i,
        duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  }

  Future<void> _recalc() async {
    setState(() => _calculating = true);
    try {
      _calc = await ref.read(loanServiceProvider).calculate(
            principal: double.parse(_principal.text),
            interestRate: double.parse(_interestRate.text),
            interestType: 'upfront_fixed',
            tenure: int.parse(_tenure.text),
            frequency: _frequency,
            startDate: _startDate,
          );
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _calculating = false);
    }
  }

  Future<void> _submit() async {
    if (_customer == null) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final loan = await ref.read(loanServiceProvider).create(
            customerId: _customer!.id,
            principal: double.parse(_principal.text),
            interestRate: double.parse(_interestRate.text),
            interestType: 'upfront_fixed',
            tenure: int.parse(_tenure.text),
            frequency: _frequency,
            startDate: _startDate,
            penaltyRate: double.parse(_penaltyRate.text),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Created ${loan.loanCode}')),
      );
      context.go('/loans');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Loan'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/loans'),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
            child: Text('Step ${_step + 1}/5', style: AppTypography.caption),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: Row(
            children: List.generate(5, (i) {
              return Expanded(
                child: Container(
                  height: 4,
                  color: i <= _step ? AppColors.primary : AppColors.border,
                ),
              );
            }),
          ),
        ),
      ),
      body: PageView(
        controller: _page,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          _stepCustomer(),
          _stepPrincipal(),
          _stepTerms(),
          _stepDisbursement(),
          _stepReview(),
        ],
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            children: [
              if (_step > 0)
                Expanded(
                  child: AppButton(
                    label: 'Back',
                    variant: AppButtonVariant.secondary,
                    expand: true,
                    onPressed: _submitting ? null : () => _go(_step - 1),
                  ),
                ),
              if (_step > 0) const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: AppButton(
                  label: _step == 4 ? 'Submit' : 'Next',
                  expand: true,
                  loading: _submitting || _calculating,
                  onPressed: _onPrimary(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  VoidCallback? _onPrimary() {
    if (_submitting) return null;
    switch (_step) {
      case 0:
        return _customer == null ? null : () => _go(1);
      case 1:
        return _principal.text.isEmpty ? null : () => _go(2);
      case 2:
        return _tenure.text.isEmpty
            ? null
            : () async {
                await _recalc();
                if (mounted) _go(3);
              };
      case 3:
        return () => _go(4);
      case 4:
        return _submit;
    }
    return null;
  }

  Widget _stepCustomer() {
    final async = ref.watch(customerListProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(e.toString())),
      data: (customers) => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: customers.length,
        itemBuilder: (_, i) {
          final c = customers[i];
          final selected = _customer?.id == c.id;
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: selected ? AppColors.primaryLight : AppColors.surface,
              borderRadius: BorderRadius.circular(AppTokens.radius),
              child: InkWell(
                borderRadius: BorderRadius.circular(AppTokens.radius),
                onTap: () => setState(() => _customer = c),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppTokens.radius),
                    border: Border.all(
                      color: selected
                          ? AppColors.primary
                          : AppColors.border,
                    ),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppColors.primary,
                        child: Text(
                          c.initials,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(c.name, style: AppTypography.bodyLarge),
                            Text(c.customerCode,
                                style: AppTypography.caption.copyWith(
                                  fontFamily: 'monospace',
                                )),
                          ],
                        ),
                      ),
                      if (selected)
                        const Icon(Icons.check_circle,
                            color: AppColors.primary),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _stepPrincipal() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Principal', style: AppTypography.sectionTitle),
        const SizedBox(height: 12),
        AppTextField(
          label: 'Principal Amount (₹)',
          controller: _principal,
          keyboardType: TextInputType.number,
        ),
      ],
    );
  }

  Widget _stepTerms() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Loan Terms', style: AppTypography.sectionTitle),
        const SizedBox(height: 12),
        AppTextField(
          label: 'Interest Rate (%)',
          controller: _interestRate,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 12),
        Text('Repayment Frequency', style: AppTypography.label),
        const SizedBox(height: 6),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'daily', label: Text('Daily')),
            ButtonSegment(value: 'weekly', label: Text('Weekly')),
            ButtonSegment(value: 'monthly', label: Text('Monthly')),
          ],
          selected: {_frequency},
          onSelectionChanged: (s) => setState(() => _frequency = s.first),
        ),
        const SizedBox(height: 12),
        AppTextField(
          label: 'Number of Instalments',
          controller: _tenure,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 12),
        AppTextField(
          label: 'Penalty Rate (% per day)',
          controller: _penaltyRate,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 12),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Start Date', style: AppTypography.label),
          subtitle: Text(DateFormat('dd MMM yyyy').format(_startDate)),
          trailing: const Icon(Icons.calendar_today_outlined),
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _startDate,
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
            if (picked != null) setState(() => _startDate = picked);
          },
        ),
      ],
    );
  }

  Widget _stepDisbursement() {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    if (_calc == null) return const Center(child: CircularProgressIndicator());
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            border: const Border(
              left: BorderSide(color: AppColors.primary, width: 4),
            ),
            boxShadow: AppTokens.shadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(fmt.format(_calc!.perInstalment),
                  style: AppTypography.display
                      .copyWith(color: AppColors.primaryDark)),
              const SizedBox(height: 4),
              Text('per instalment', style: AppTypography.caption),
              const SizedBox(height: 12),
              _kv('Total Repayable', fmt.format(_calc!.totalRepayable)),
              _kv('Total Interest', fmt.format(_calc!.totalInterest)),
              _kv('End Date',
                  DateFormat('dd MMM yyyy').format(_calc!.endDate)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _stepReview() {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Review', style: AppTypography.sectionTitle),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTokens.radius),
            boxShadow: AppTokens.shadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _kv('Customer', _customer?.name ?? '—'),
              _kv('Principal', fmt.format(double.tryParse(_principal.text) ?? 0)),
              _kv('Interest', '${_interestRate.text}%'),
              _kv('Frequency', _frequency),
              _kv('Tenure', _tenure.text),
              _kv('Start', DateFormat('dd MMM yyyy').format(_startDate)),
              if (_calc != null)
                _kv('Per Instalment', fmt.format(_calc!.perInstalment)),
            ],
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.dangerBg,
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            ),
            child: Text(_error!,
                style: AppTypography.bodySmall
                    .copyWith(color: AppColors.dangerText)),
          ),
        ],
      ],
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            SizedBox(width: 130, child: Text(k, style: AppTypography.caption)),
            Expanded(child: Text(v, style: AppTypography.body)),
          ],
        ),
      );
}
