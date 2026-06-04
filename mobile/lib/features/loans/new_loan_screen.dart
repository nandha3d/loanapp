import 'package:loantrack/core/currency/currency_controller.dart';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/loan_calc.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/data/services/upload_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/app_text_field.dart';

class _ChequeEntry {
  _ChequeEntry()
      : bank = TextEditingController(),
        number = TextEditingController(),
        amount = TextEditingController();
  final TextEditingController bank;
  final TextEditingController number;
  final TextEditingController amount;
  File? image;
  String? uploadedUrl;
  void dispose() {
    bank.dispose();
    number.dispose();
    amount.dispose();
  }
}

const _relations = [
  ('father', 'Father'),
  ('mother', 'Mother'),
  ('spouse', 'Spouse'),
  ('sibling', 'Sibling'),
  ('friend', 'Friend'),
  ('other', 'Other'),
];

class NewLoanScreen extends ConsumerStatefulWidget {
  const NewLoanScreen({super.key});

  @override
  ConsumerState<NewLoanScreen> createState() => _NewLoanScreenState();
}

class _NewLoanScreenState extends ConsumerState<NewLoanScreen> {
  // Step 0 — customer
  Customer? _customer;
  final _searchCtrl = TextEditingController();

  // Step 1 — loan type & cheques
  String _loanType = 'cheque';
  final _cheques = <_ChequeEntry>[];

  // Cheque loan collateral fields
  final _chequeBankName = TextEditingController();
  final _chequeNumber = TextEditingController();
  final _chequeAmount = TextEditingController();

  // Gold loan fields
  final _goldGrams = TextEditingController();
  String _goldCarat = '22K';
  final _goldItems = TextEditingController();

  // Property loan fields
  String _propertyType = 'residential';
  final _propertyValue = TextEditingController();
  final _propertyAddress = TextEditingController();

  // Step 2 — principal/terms
  final _principal = TextEditingController(text: '30000');
  String _deductionType = 'upfront_fixed';
  final _deduction = TextEditingController(text: '3000');
  final _tenure = TextEditingController(text: '100');
  String _frequency = 'daily';
  int? _dueDay; // day-of-month (monthly) / day-of-week (weekly); null for daily
  DateTime _startDate = DateTime.now();
  final _penaltyRate = TextEditingController(text: '1.5');

  // Step 3 — guarantor
  final _gName = TextEditingController();
  final _gPhone = TextEditingController();
  final _gAadhar = TextEditingController();
  final _gAddress = TextEditingController();
  String? _gRelation;
  File? _gPhoto;
  final _voucherRef = TextEditingController();

  // Wizard / submit
  final _page = PageController();
  int _step = 0;
  LoanCalculation? _calc;
  bool _calculating = false;
  bool _submitting = false;
  String? _error;
  final _picker = ImagePicker();

  @override
  void dispose() {
    _searchCtrl.dispose();
    for (final c in _cheques) {
      c.dispose();
    }
    _chequeBankName.dispose();
    _chequeNumber.dispose();
    _chequeAmount.dispose();
    _principal.dispose();
    _deduction.dispose();
    _tenure.dispose();
    _penaltyRate.dispose();
    _gName.dispose();
    _gPhone.dispose();
    _gAadhar.dispose();
    _gAddress.dispose();
    _voucherRef.dispose();
    _goldGrams.dispose();
    _goldItems.dispose();
    _propertyValue.dispose();
    _propertyAddress.dispose();
    _page.dispose();
    super.dispose();
  }

  void _go(int i) {
    setState(() => _step = i);
    _page.animateToPage(
      i,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  // ── Calculation helpers ───────────────────────────────────────────────
  double get _principalNum => double.tryParse(_principal.text) ?? 0;
  double get _deductionNum => double.tryParse(_deduction.text) ?? 0;
  int get _tenureNum => int.tryParse(_tenure.text) ?? 0;

  String _buildCollateralJson() {
    if (_loanType == 'cheque') {
      return '{"bankName":"${_chequeBankName.text}","chequeNumber":"${_chequeNumber.text}","chequeAmount":${double.tryParse(_chequeAmount.text) ?? 0}}';
    } else if (_loanType == 'gold') {
      return '{"grams":${double.tryParse(_goldGrams.text) ?? 0},"carat":"$_goldCarat","items":"${_goldItems.text}"}';
    } else if (_loanType == 'property') {
      return '{"type":"$_propertyType","value":${double.tryParse(_propertyValue.text) ?? 0},"address":"${_propertyAddress.text}"}';
    }
    return '';
  }

  double _netDisbursed() {
    switch (_deductionType) {
      case 'upfront_fixed':
        return _principalNum - _deductionNum;
      case 'upfront_percentage':
        return _principalNum - (_principalNum * _deductionNum / 100);
      default:
        return _principalNum;
    }
  }

  static const _weekdays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ];
  String _weekdayLabel(int d) => _weekdays[(d - 1).clamp(0, 6)];

  Future<void> _recalc() async {
    if (_principalNum <= 0 || _tenureNum <= 0) return;
    setState(() => _calculating = true);
    try {
      _calc = await ref.read(loanServiceProvider).calculate(
            principal: _principalNum,
            interestRate: _deductionNum,
            interestType: _deductionType,
            tenure: _tenureNum,
            frequency: _frequency,
            startDate: _startDate,
            dueDay: _frequency == 'daily' ? null : _dueDay,
          );
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _calculating = false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────
  Future<void> _submit() async {
    if (_customer == null) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final uploader = ref.read(uploadServiceProvider);

      String? guarantorPhotoUrl;
      if (_gPhoto != null) {
        final r = await uploader.uploadFile(_gPhoto!);
        guarantorPhotoUrl = r.url;
      }

      final cheques = <Map<String, dynamic>>[];
      for (final c in _cheques) {
        if (c.bank.text.trim().isEmpty || c.number.text.trim().isEmpty) {
          continue;
        }
        String? url = c.uploadedUrl;
        if (c.image != null && url == null) {
          final r = await uploader.uploadFile(c.image!);
          url = r.url;
          c.uploadedUrl = url;
        }
        cheques.add({
          'bankName': c.bank.text.trim(),
          'chequeNumber': c.number.text.trim(),
          if (c.amount.text.isNotEmpty)
            'amount': double.tryParse(c.amount.text) ?? 0,
          if (url != null) 'imageUrl': url,
        });
      }

      Map<String, dynamic>? guarantorPayload;
      if (_gName.text.trim().isNotEmpty && _gPhone.text.trim().isNotEmpty) {
        guarantorPayload = {
          'name': _gName.text.trim(),
          'phone': _gPhone.text.trim(),
          if (_gAadhar.text.trim().isNotEmpty)
            'aadharNumber': _gAadhar.text.trim(),
          if (_gAddress.text.trim().isNotEmpty)
            'address': _gAddress.text.trim(),
          if (_gRelation != null) 'relation': _gRelation,
          if (guarantorPhotoUrl != null) 'photoUrl': guarantorPhotoUrl,
        };
      }

      final loan = await ref.read(loanServiceProvider).create(
            customerId: _customer!.id,
            principal: _principalNum,
            deduction: _deductionNum,
            deductionType: _deductionType,
            tenure: _tenureNum,
            frequency: _frequency,
            startDate: _startDate,
            dueDay: _frequency == 'daily' ? null : _dueDay,
            penaltyRate: double.tryParse(_penaltyRate.text) ?? 0,
            loanType: _loanType,
            collateralDetails: _buildCollateralJson(),
            voucherRef: _voucherRef.text.trim().isEmpty
                ? null
                : _voucherRef.text.trim(),
            guarantor: guarantorPayload,
            securityCheques: cheques.isEmpty ? null : cheques,
          );
      if (!mounted) return;
      final t = T.of(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${t.x('msg.created_prefix')} ${loan.loanCode}')),
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
    final t = T.of(ref);
    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('title.new_loan')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/loans'),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
            child: Text('${t.x('step.label')} ${_step + 1}/5', style: AppTypography.caption),
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
          _stepLoanType(),
          _stepTerms(),
          _stepGuarantor(),
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
                    label: t.x('btn.back'),
                    variant: AppButtonVariant.secondary,
                    expand: true,
                    onPressed: _submitting ? null : () => _go(_step - 1),
                  ),
                ),
              if (_step > 0) const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: AppButton(
                  label: _step == 4 ? t.x('btn.create_loan') : t.x('btn.next'),
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
        return () => _go(2);
      case 2:
        return _principalNum <= 0 || _tenureNum <= 0
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

  // ─────────────────────── Step 0: Customer ───────────────────────────
  Widget _stepCustomer() {
    final filter = ref.watch(customerFilterProvider);
    final async = ref.watch(customerListProvider);
    final t = T.of(ref);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: (v) {
                    ref.read(customerFilterProvider.notifier).state =
                        filter.copyWith(query: v);
                  },
                  decoration: InputDecoration(
                    hintText: t.x('fld.search_customer'),
                    prefixIcon: const Icon(Icons.search, size: 20),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    ),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 14,
                  ),
                ),
                onPressed: _openNewCustomer,
                icon: const Icon(Icons.person_add_alt_1, size: 18),
                label: Text(t.x('btn.new')),
              ),
            ],
          ),
        ),
        Expanded(
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text(e.toString())),
            data: (customers) {
              if (customers.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.person_search,
                          size: 56,
                          color: AppColors.textLight,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          t.x('empty.no_customers'),
                          style: AppTypography.bodyLarge,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          t.x('empty.tap_new'),
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                );
              }
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                itemCount: customers.length,
                itemBuilder: (_, i) {
                  final c = customers[i];
                  final selected = _customer?.id == c.id;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Material(
                      color: selected
                          ? AppColors.primaryLight
                          : AppColors.surface,
                      borderRadius: BorderRadius.circular(AppTokens.radius),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(AppTokens.radius),
                        onTap: () => setState(() => _customer = c),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            borderRadius:
                                BorderRadius.circular(AppTokens.radius),
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
                                  style:
                                      const TextStyle(color: Colors.white),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(c.name,
                                        style: AppTypography.bodyLarge,),
                                    Text(
                                      '${c.customerCode} • ${c.phone}',
                                      style: AppTypography.caption.copyWith(
                                        fontFamily: 'monospace',
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (selected)
                                const Icon(
                                  Icons.check_circle,
                                  color: AppColors.primary,
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _openNewCustomer() async {
    final result =
        await context.push<Object?>('/customers/new?returnTo=loan');
    if (!mounted) return;
    ref.invalidate(customerListProvider);
    if (result is Customer) {
      setState(() => _customer = result);
      _go(1);
    }
  }

  // ─────────────────────── Step 1: Loan Type & Cheques ─────────────────
  Widget _stepLoanType() {
    final tr = T.of(ref);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(tr.x('sec.loan_type'), style: AppTypography.sectionTitle),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final lt in [
              ('cheque', tr.x('lt.cheque'), Icons.account_balance_wallet_outlined),
              ('gold', tr.x('lt.gold'), Icons.diamond_outlined),
              ('property', tr.x('lt.property'), Icons.home_work_outlined),
            ])
              ChoiceChip(
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(lt.$3, size: 16),
                    const SizedBox(width: 6),
                    Text(lt.$2),
                  ],
                ),
                selected: _loanType == lt.$1,
                onSelected: (_) => setState(() => _loanType = lt.$1),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (_loanType == 'cheque') ...[
          AppTextField(
            label: tr.x('fld.bank_name'),
            controller: _chequeBankName,
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: tr.x('fld.cheque_no'),
            controller: _chequeNumber,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: tr.x('fld.amount'),
            controller: _chequeAmount,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),
        ] else if (_loanType == 'gold') ...[
          AppTextField(
            label: tr.x('fld.gold_weight'),
            controller: _goldGrams,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          Text(tr.x('fld.gold_purity'), style: AppTypography.label),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: _goldCarat,
            decoration: InputDecoration(
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
              isDense: true,
            ),
            items: [
              for (final c in ['18K', '20K', '22K', '24K'])
                DropdownMenuItem(value: c, child: Text(c)),
            ],
            onChanged: (v) => setState(() => _goldCarat = v ?? '22K'),
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: tr.x('fld.gold_items'),
            controller: _goldItems,
            hintText: 'e.g. 2 Bangles, 1 Chain',
          ),
          const SizedBox(height: 16),
        ] else if (_loanType == 'property') ...[
          Text(tr.x('fld.property_type'), style: AppTypography.label),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: _propertyType,
            decoration: InputDecoration(
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
              isDense: true,
            ),
            items: [
              DropdownMenuItem(value: 'residential', child: Text(tr.x('fld.property_type_residential'))),
              DropdownMenuItem(value: 'commercial', child: Text(tr.x('fld.property_type_commercial'))),
              DropdownMenuItem(value: 'land', child: Text(tr.x('fld.property_type_land'))),
            ],
            onChanged: (v) => setState(() => _propertyType = v ?? 'residential'),
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: tr.x('fld.property_value'),
            controller: _propertyValue,
            keyboardType: TextInputType.number,
            hintText: 'e.g. 500000',
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: tr.x('fld.property_address'),
            controller: _propertyAddress,
            hintText: tr.x('fld.address'),
          ),
          const SizedBox(height: 16),
        ],
        Text(tr.x('sec.security_cheques'), style: AppTypography.sectionTitle),
        const SizedBox(height: 8),
        for (int i = 0; i < _cheques.length; i++)
          _ChequeTile(
            key: ValueKey(_cheques[i]),
            entry: _cheques[i],
            index: i,
            onRemove: () => setState(() {
              _cheques[i].dispose();
              _cheques.removeAt(i);
            }),
            onPick: () => _pickChequeImage(i),
          ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => setState(() => _cheques.add(_ChequeEntry())),
          icon: const Icon(Icons.add),
          label: Text(tr.x('btn.add_cheque')),
        ),
      ],
    );
  }

  Future<void> _pickChequeImage(int i) async {
    final src = await _showImagePickerSheet();
    if (src == null) return;
    final x = await _picker.pickImage(
      source: src,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 80,
    );
    if (x == null) return;
    setState(() {
      _cheques[i].image = File(x.path);
      _cheques[i].uploadedUrl = null;
    });
  }

  Future<ImageSource?> _showImagePickerSheet() async {
    final tr = T.of(ref);
    ImageSource? src;
    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: Text(tr.x('btn.camera')),
              onTap: () {
                src = ImageSource.camera;
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(tr.x('btn.gallery')),
              onTap: () {
                src = ImageSource.gallery;
                Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
    return src;
  }

  // ─────────────────────── Step 2: Terms ───────────────────────────────
  Widget _stepTerms() {
    final tr = T.of(ref);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(tr.x('sec.principal_repay'), style: AppTypography.sectionTitle),
        const SizedBox(height: 12),
        AppTextField(
          label: tr.x('fld.principal_amount'),
          controller: _principal,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 12),
        Text(tr.x('plan.upfront'), style: AppTypography.label),
        const SizedBox(height: 6),
        SegmentedButton<String>(
          segments: [
            ButtonSegment(value: 'upfront_fixed', label: Text(tr.x('plan.upfront'))),
            ButtonSegment(value: 'emi_flat', label: Text(tr.x('plan.emi'))),
          ],
          selected: {
            _deductionType == 'upfront_percentage'
                ? 'upfront_fixed'
                : _deductionType == 'emi_floating'
                    ? 'emi_flat'
                    : _deductionType,
          },
          onSelectionChanged: (s) {
            setState(() {
              // preserve fixed vs % within same family
              if (s.first == 'upfront_fixed') {
                _deductionType = _deductionType == 'upfront_percentage'
                    ? 'upfront_percentage'
                    : 'upfront_fixed';
              } else {
                _deductionType = 'emi_flat';
              }
            });
          },
        ),
        if (_deductionType.startsWith('upfront')) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              // ignore: deprecated_member_use
              Radio<String>(
                value: 'upfront_fixed',
                // ignore: deprecated_member_use
                groupValue: _deductionType,
                // ignore: deprecated_member_use
                onChanged: (v) =>
                    setState(() => _deductionType = v ?? _deductionType),
              ),
              Text(tr.x('plan.fixed_amount')),
              const SizedBox(width: 12),
              // ignore: deprecated_member_use
              Radio<String>(
                value: 'upfront_percentage',
                // ignore: deprecated_member_use
                groupValue: _deductionType,
                // ignore: deprecated_member_use
                onChanged: (v) =>
                    setState(() => _deductionType = v ?? _deductionType),
              ),
              Text(tr.x('plan.percentage')),
            ],
          ),
        ],
        const SizedBox(height: 12),
        AppTextField(
          label: _deductionType == 'upfront_percentage'
              ? tr.x('fld.deduction_pct')
              : _deductionType == 'upfront_fixed'
                  ? tr.x('fld.deduction')
                  : tr.x('fld.interest_rate'),
          controller: _deduction,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 12),
        Text(tr.x('fld.frequency'), style: AppTypography.label),
        const SizedBox(height: 6),
        SegmentedButton<String>(
          segments: [
            ButtonSegment(value: 'daily', label: Text(tr.x('plan.daily'))),
            ButtonSegment(value: 'weekly', label: Text(tr.x('plan.weekly'))),
            ButtonSegment(value: 'monthly', label: Text(tr.x('plan.monthly'))),
          ],
          selected: {_frequency},
          onSelectionChanged: (s) => setState(() {
            _frequency = s.first;
            if (_frequency == 'daily') _dueDay = null;
          }),
        ),
        if (_frequency != 'daily') ...[
          const SizedBox(height: 12),
          Text(tr.x('fld.due_day'), style: AppTypography.label),
          const SizedBox(height: 6),
          DropdownButtonFormField<int>(
            initialValue: _dueDay,
            isExpanded: true,
            decoration: InputDecoration(
              isDense: true,
              hintText: tr.x('fld.due_day_hint'),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
            ),
            items: _frequency == 'weekly'
                ? [
                    for (var d = 1; d <= 7; d++)
                      DropdownMenuItem(
                        value: d,
                        child: Text(_weekdayLabel(d)),
                      ),
                  ]
                : [
                    for (var d = 1; d <= 31; d++)
                      DropdownMenuItem(value: d, child: Text('$d')),
                  ],
            onChanged: (v) {
              setState(() => _dueDay = v);
              _recalc();
            },
          ),
        ],
        const SizedBox(height: 12),
        AppTextField(
          label: tr.x('fld.tenure'),
          controller: _tenure,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 12),
        AppTextField(
          label: tr.x('fld.penalty_rate'),
          controller: _penaltyRate,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 12),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(tr.x('fld.start_date'), style: AppTypography.label),
          subtitle: Text(DateFormat('dd MMM yyyy').format(_startDate)),
          trailing: const Icon(Icons.calendar_today_outlined),
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _startDate,
              firstDate: DateTime.now().subtract(const Duration(days: 30)),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
            if (picked != null) setState(() => _startDate = picked);
          },
        ),
      ],
    );
  }

  // ─────────────────────── Step 3: Guarantor ───────────────────────────
  Widget _stepGuarantor() {
    final tr = T.of(ref);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(tr.x('sec.guarantor'), style: AppTypography.sectionTitle),
        const SizedBox(height: 12),
        AppTextField(label: '${tr.x('fld.full_name')} *', controller: _gName),
        const SizedBox(height: 12),
        AppTextField(
          label: '${tr.x('fld.phone')} *',
          controller: _gPhone,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 12),
        AppTextField(
          label: tr.x('fld.aadhar'),
          controller: _gAadhar,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 12),
        Text(tr.x('fld.relation'), style: AppTypography.label),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: _gRelation,
          decoration: InputDecoration(
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            ),
            isDense: true,
          ),
          hint: Text(tr.x('fld.relation')),
          items: [
            for (final r in _relations)
              DropdownMenuItem(value: r.$1, child: Text(tr.x('rel.${r.$1}'))),
          ],
          onChanged: (v) => setState(() => _gRelation = v),
        ),
        const SizedBox(height: 12),
        AppTextField(
          label: tr.x('fld.address'),
          controller: _gAddress,
        ),
        const SizedBox(height: 12),
        Text(tr.x('btn.choose_photo'), style: AppTypography.label),
        const SizedBox(height: 6),
        Row(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                border: Border.all(color: AppColors.border),
              ),
              clipBehavior: Clip.antiAlias,
              child: _gPhoto != null
                  ? Image.file(_gPhoto!, fit: BoxFit.cover)
                  : const Icon(
                      Icons.add_a_photo_outlined,
                      color: AppColors.textLight,
                    ),
            ),
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed: () async {
                final src = await _showImagePickerSheet();
                if (src == null) return;
                final x = await _picker.pickImage(
                  source: src,
                  maxWidth: 800,
                  maxHeight: 800,
                  imageQuality: 80,
                );
                if (x == null) return;
                setState(() => _gPhoto = File(x.path));
              },
              icon: const Icon(Icons.camera_alt_outlined, size: 16),
              label:
                  Text(_gPhoto == null ? tr.x('btn.choose_photo') : tr.x('btn.replace')),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text(tr.x('sec.voucher_ref'), style: AppTypography.sectionTitle),
        const SizedBox(height: 8),
        AppTextField(
          label: tr.x('fld.voucher_ref'),
          controller: _voucherRef,
        ),
      ],
    );
  }

  // ─────────────────────── Step 4: Review ──────────────────────────────
  Widget _stepReview() {
    final tr = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(tr.x('sec.review'), style: AppTypography.sectionTitle),
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
              _kv(tr.x('rev.customer'), _customer?.name ?? '—'),
              _kv(tr.x('rev.loan_type'), _loanType),
              _kv(tr.x('rev.principal'), fmt.format(_principalNum)),
              _kv(tr.x('rev.deduction_type'), _deductionType),
              _kv(tr.x('rev.deduction'), _deduction.text),
              _kv(tr.x('rev.tenure'), _tenure.text),
              _kv(tr.x('rev.frequency'), _frequency),
              _kv(tr.x('rev.start'), DateFormat('dd MMM yyyy').format(_startDate)),
              _kv(tr.x('rev.penalty'), _penaltyRate.text),
              if (_loanType == 'cheque')
                ...[
                  if (_chequeBankName.text.isNotEmpty)
                    _kv(tr.x('fld.bank_name'), _chequeBankName.text),
                  if (_chequeNumber.text.isNotEmpty)
                    _kv(tr.x('fld.cheque_no'), _chequeNumber.text),
                  if (_chequeAmount.text.isNotEmpty)
                    _kv(tr.x('fld.amount'), '₹${_chequeAmount.text}'),
                ]
              else if (_loanType == 'gold')
                ...[
                  _kv(tr.x('fld.gold_weight'), '${_goldGrams.text} g'),
                  _kv(tr.x('fld.gold_purity'), _goldCarat),
                  if (_goldItems.text.isNotEmpty)
                    _kv(tr.x('fld.gold_items'), _goldItems.text),
                ]
              else if (_loanType == 'property')
                ...[
                  _kv(tr.x('fld.property_type'), _propertyType),
                  if (_propertyValue.text.isNotEmpty)
                    _kv(tr.x('fld.property_value'), '₹${_propertyValue.text}'),
                  if (_propertyAddress.text.isNotEmpty)
                    _kv(tr.x('fld.property_address'), _propertyAddress.text),
                ],
              if (_calc != null) ...[
                const Divider(),
                _kv(tr.x('rev.per_instalment'), fmt.format(_calc!.perInstalment)),
                _kv(
                  tr.x('rev.net_disbursed'),
                  fmt.format(_netDisbursed()),
                ),
                _kv(tr.x('rev.total_payable'), fmt.format(_calc!.totalRepayable)),
                _kv(
                  tr.x('rev.end_date'),
                  DateFormat('dd MMM yyyy').format(_calc!.endDate),
                ),
              ],
              if (_cheques.isNotEmpty)
                _kv(tr.x('rev.cheques'), '${_cheques.length} ${tr.x('rev.cheques_attached_suffix')}'),
              if (_gName.text.trim().isNotEmpty)
                _kv(tr.x('rev.guarantor'),
                    '${_gName.text.trim()} • ${_gPhone.text.trim()}',),
              if (_voucherRef.text.trim().isNotEmpty)
                _kv(tr.x('rev.voucher'), _voucherRef.text.trim()),
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
            child: Text(
              _error!,
              style:
                  AppTypography.bodySmall.copyWith(color: AppColors.dangerText),
            ),
          ),
        ],
      ],
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            SizedBox(width: 140, child: Text(k, style: AppTypography.caption)),
            Expanded(child: Text(v, style: AppTypography.body)),
          ],
        ),
      );
}

// ───────────────────────── Cheque tile ─────────────────────────────────
class _ChequeTile extends ConsumerWidget {
  const _ChequeTile({
    super.key,
    required this.entry,
    required this.index,
    required this.onRemove,
    required this.onPick,
  });
  final _ChequeEntry entry;
  final int index;
  final VoidCallback onRemove;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Text(
                '${t.x('loan.cheque_n')} #${index + 1}',
                style: AppTypography.bodyLarge,
              ),
              const Spacer(),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(
                  Icons.delete_outline,
                  color: AppColors.danger,
                ),
                onPressed: onRemove,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  label: t.x('fld.bank_name'),
                  controller: entry.bank,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppTextField(
                  label: t.x('fld.cheque_no'),
                  controller: entry.number,
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: AppTextField(
                  label: t.x('fld.amount'),
                  controller: entry.amount,
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 64,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  border: Border.all(color: AppColors.border),
                ),
                clipBehavior: Clip.antiAlias,
                child: entry.image != null
                    ? Image.file(entry.image!, fit: BoxFit.cover)
                    : const Icon(
                        Icons.image_outlined,
                        color: AppColors.textLight,
                      ),
              ),
              const SizedBox(width: 6),
              OutlinedButton.icon(
                onPressed: onPick,
                icon: const Icon(Icons.camera_alt_outlined, size: 16),
                label: Text(entry.image == null ? t.x('btn.photo') : t.x('btn.change')),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
