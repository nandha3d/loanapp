import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/loan_calc.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/data/services/gold_service.dart';
import 'package:loantrack/features/loans/loans_screen.dart' show loansProvider;
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

  // Gold loan fields (legacy single-field — kept for fallback)
  final _goldGrams = TextEditingController();
  final String _goldCarat = '22K';
  final _goldItems = TextEditingController();

  // Gold pledge: master data + multi-ornament rows.
  final _goldPacket = TextEditingController();
  List<Map<String, dynamic>> _ornTypes = [];
  List<Map<String, dynamic>> _ornSpecs = [];
  double? _goldRate;
  final List<Map<String, String>> _ornaments = [_blankOrnament()];

  static Map<String, String> _blankOrnament() => {
        'type': '',
        'spec': '',
        'qty': '1',
        'gross': '',
        'wastage': '',
        'net': '',
        'rate': '',
      };

  Future<void> _loadGoldMaster() async {
    try {
      final svc = ref.read(goldServiceProvider);
      final m = await svc.master();
      final cfg = await svc.config();
      if (!mounted) return;
      setState(() {
        _ornTypes = m.ornamentTypes;
        _ornSpecs = m.ornamentSpecs;
        final r = cfg['goldPureRatePerGram'];
        _goldRate = r is num ? r.toDouble() : null;
        if (_goldRate != null) {
          for (final o in _ornaments) {
            o['rate'] =
                o['rate']!.isEmpty ? _goldRate!.toStringAsFixed(0) : o['rate']!;
          }
        }
      });
    } catch (_) {/* tolerate pre-migration */}
  }

  double _ornValue(Map<String, String> o) {
    final gross = double.tryParse(o['gross'] ?? '') ?? 0;
    final wastage = double.tryParse(o['wastage'] ?? '') ?? 0;
    final netEntered = double.tryParse(o['net'] ?? '') ?? 0;
    final net = netEntered > 0
        ? netEntered
        : (gross - wastage > 0 ? gross - wastage : 0);
    final rate = double.tryParse(o['rate'] ?? '') ?? 0;
    return (net * rate).roundToDouble();
  }

  Map<String, dynamic> _goldCollateralMap() => {
        'packetNo':
            _goldPacket.text.trim().isEmpty ? null : _goldPacket.text.trim(),
        'marketRatePerGram': _goldRate,
        'items': [
          for (final o in _ornaments)
            if ((o['type'] ?? '').isNotEmpty || (o['gross'] ?? '').isNotEmpty)
              {
                'ornamentType': o['type'],
                'specification': (o['spec'] ?? '').isEmpty ? null : o['spec'],
                'quantity': int.tryParse(o['qty'] ?? '1') ?? 1,
                'grossWeightGrams': double.tryParse(o['gross'] ?? '') ?? 0,
                'wastageGrams': double.tryParse(o['wastage'] ?? '') ?? 0,
                if ((o['net'] ?? '').isNotEmpty)
                  'netWeightGrams': double.tryParse(o['net'] ?? ''),
                'ratePerGram': double.tryParse(o['rate'] ?? '') ?? 0,
              },
        ],
      };

  // Property loan fields
  String _propertyType = 'residential';
  final _propertyValue = TextEditingController();
  final _propertyAddress = TextEditingController();
  File? _propertyTitleDeedImage;
  File? _propertyEcImage;
  File? _propertyTaxReceiptImage;

  // Product finance fields
  final _productName = TextEditingController();
  final _productCategory = TextEditingController();
  final _productBrand = TextEditingController();
  final _productModelNo = TextEditingController();
  final _productSerialNo = TextEditingController();
  final _productDealerName = TextEditingController();
  final _productInvoiceNo = TextEditingController();
  final _productInvoiceAmount = TextEditingController();
  final _productDownPayment = TextEditingController();
  File? _productInvoiceImage;
  File? _productPhotoImage;

  Future<void> _pickPropertyDoc(String type) async {
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
      if (type == 'titleDeed') _propertyTitleDeedImage = File(x.path);
      if (type == 'ec') _propertyEcImage = File(x.path);
      if (type == 'tax') _propertyTaxReceiptImage = File(x.path);
    });
  }

  Future<void> _pickProductDoc(String type) async {
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
      if (type == 'invoice') _productInvoiceImage = File(x.path);
      if (type == 'photo') _productPhotoImage = File(x.path);
    });
  }

  Widget _buildDocUploadTile({
    required String label,
    required File? file,
    required VoidCallback onPick,
    required VoidCallback onClear,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppTypography.caption.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(
                  file != null ? file.path.split(Platform.isWindows ? '\\' : '/').last : 'No file selected',
                  style: AppTypography.caption.copyWith(color: AppColors.textLight),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (file != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Image.file(file, width: 40, height: 40, fit: BoxFit.cover),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.delete_outline, color: AppColors.danger),
              onPressed: onClear,
            ),
          ] else
            IconButton(
              icon: Icon(Icons.camera_alt_outlined, color: AppColors.primary),
              onPressed: onPick,
            ),
        ],
      ),
    );
  }

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
  String? _existingGuarantorPhotoUrl;
  String? _selectedExistingGuarantorId;
  final _voucherRef = TextEditingController();

  void _applyExistingGuarantor(Guarantor? g) {
    setState(() {
      _selectedExistingGuarantorId = g?.id;
      _gPhoto = null;
      if (g == null) {
        _gName.clear();
        _gPhone.clear();
        _gAadhar.clear();
        _gAddress.clear();
        _gRelation = null;
        _existingGuarantorPhotoUrl = null;
        return;
      }
      _gName.text = g.name;
      _gPhone.text = g.phone;
      _gAadhar.text = g.aadharNumber ?? '';
      _gAddress.text = g.address ?? '';
      _gRelation = g.relation;
      _existingGuarantorPhotoUrl = g.photoUrl;
    });
  }

  // Wizard / submit
  final _page = PageController();
  int _step = 0;
  LoanCalculation? _calc;
  bool _calculating = false;
  bool _submitting = false;
  String? _error;
  final _picker = ImagePicker();

  List<Widget> _buildOrnamentRows(T tr) {
    final rows = <Widget>[];
    for (var i = 0; i < _ornaments.length; i++) {
      final o = _ornaments[i];
      rows.add(
        Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(child: _ornTypeField(o)),
                  const SizedBox(width: 8),
                  Expanded(child: _ornSpecField(o)),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _ornNum(o, 'gross', 'Gross')),
                  const SizedBox(width: 8),
                  Expanded(child: _ornNum(o, 'wastage', 'Wastage')),
                  const SizedBox(width: 8),
                  Expanded(child: _ornNum(o, 'rate', 'Rate/g')),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Text(
                    'Value: ₹${_ornValue(o).toStringAsFixed(0)}',
                    style: AppTypography.bodyLarge.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryDark,
                    ),
                  ),
                  const Spacer(),
                  if (_ornaments.length > 1)
                    IconButton(
                      icon: const Icon(
                        Icons.delete_outline,
                        color: AppColors.danger,
                      ),
                      onPressed: () => setState(() => _ornaments.removeAt(i)),
                    ),
                ],
              ),
            ],
          ),
        ),
      );
    }
    rows.add(
      OutlinedButton.icon(
        onPressed: () => setState(
          () => _ornaments.add(
            _blankOrnament()..['rate'] = _goldRate?.toStringAsFixed(0) ?? '',
          ),
        ),
        icon: const Icon(Icons.add),
        label: const Text('Add ornament'),
      ),
    );
    return rows;
  }

  Widget _ornTypeField(Map<String, String> o) {
    if (_ornTypes.isEmpty) {
      return TextFormField(
        initialValue: o['type'],
        decoration: const InputDecoration(
          labelText: 'Ornament',
          isDense: true,
          border: OutlineInputBorder(),
        ),
        onChanged: (v) => o['type'] = v,
      );
    }
    return DropdownButtonFormField<String>(
      initialValue: (o['type'] ?? '').isEmpty ? null : o['type'],
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: 'Ornament',
        isDense: true,
        border: OutlineInputBorder(),
      ),
      items: [
        for (final t in _ornTypes)
          DropdownMenuItem(
            value: t['name'] as String,
            child: Text(t['name'] as String, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: (v) => setState(() => o['type'] = v ?? ''),
    );
  }

  Widget _ornSpecField(Map<String, String> o) {
    if (_ornSpecs.isEmpty) {
      return TextFormField(
        initialValue: o['spec'],
        decoration: const InputDecoration(
          labelText: 'Spec',
          isDense: true,
          border: OutlineInputBorder(),
        ),
        onChanged: (v) => o['spec'] = v,
      );
    }
    return DropdownButtonFormField<String>(
      initialValue: (o['spec'] ?? '').isEmpty ? null : o['spec'],
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: 'Spec',
        isDense: true,
        border: OutlineInputBorder(),
      ),
      items: [
        for (final s in _ornSpecs)
          DropdownMenuItem(
            value: s['name'] as String,
            child: Text(s['name'] as String, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: (v) => setState(() => o['spec'] = v ?? ''),
    );
  }

  Widget _ornNum(Map<String, String> o, String key, String label) =>
      TextFormField(
        initialValue: o[key],
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          border: const OutlineInputBorder(),
        ),
        onChanged: (v) => setState(() => o[key] = v),
      );

  @override
  void initState() {
    super.initState();
    _loanType = _defaultLoanTypeForApp(
      ref.read(authControllerProvider).user?.appType,
    );
    _loadGoldMaster();
  }

  @override
  void dispose() {
    _goldPacket.dispose();
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
    _productName.dispose();
    _productCategory.dispose();
    _productBrand.dispose();
    _productModelNo.dispose();
    _productSerialNo.dispose();
    _productDealerName.dispose();
    _productInvoiceNo.dispose();
    _productInvoiceAmount.dispose();
    _productDownPayment.dispose();
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

  String _defaultLoanTypeForApp(String? appType) {
    switch (AppType.normalize(appType ?? '')) {
      case AppType.goldloan:
        return 'gold';
      case AppType.property:
        return 'property';
      case AppType.productfinance:
        return 'other';
      default:
        return 'cheque';
    }
  }

  String _buildCollateralJson() {
    if (_loanType == 'cheque') {
      return jsonEncode({
        'bankName': _chequeBankName.text.trim(),
        'chequeNumber': _chequeNumber.text.trim(),
        'chequeAmount': double.tryParse(_chequeAmount.text) ?? 0,
      });
    } else if (_loanType == 'gold') {
      return jsonEncode({
        'grams': double.tryParse(_goldGrams.text) ?? 0,
        'carat': _goldCarat,
        'items': _goldItems.text.trim(),
      });
    } else if (_loanType == 'property') {
      return jsonEncode({
        'type': _propertyType,
        'value': double.tryParse(_propertyValue.text) ?? 0,
        'address': _propertyAddress.text.trim(),
      });
    }
    return '';
  }

  Map<String, dynamic> _propertyCollateralMap({
    String? titleDeedPath,
    String? ecPath,
    String? taxReceiptPath,
  }) => {
        'propertyType': _propertyType,
        'address': _propertyAddress.text.trim().isEmpty
            ? null
            : _propertyAddress.text.trim(),
        'marketValue': _propertyValue.text.trim().isEmpty
            ? null
            : double.tryParse(_propertyValue.text),
        'titleDeedPath': titleDeedPath,
        'ecPath': ecPath,
        'taxReceiptPath': taxReceiptPath,
      };

  Map<String, dynamic> _productItemMap({
    String? invoicePath,
    String? photoPath,
  }) => {
        'category': _productCategory.text.trim().isEmpty
            ? null
            : _productCategory.text.trim(),
        'productName':
            _productName.text.trim().isEmpty ? null : _productName.text.trim(),
        'brand': _productBrand.text.trim().isEmpty
            ? null
            : _productBrand.text.trim(),
        'modelNo': _productModelNo.text.trim().isEmpty
            ? null
            : _productModelNo.text.trim(),
        'serialNo': _productSerialNo.text.trim().isEmpty
            ? null
            : _productSerialNo.text.trim(),
        'dealerName': _productDealerName.text.trim().isEmpty
            ? null
            : _productDealerName.text.trim(),
        'invoiceNo': _productInvoiceNo.text.trim().isEmpty
            ? null
            : _productInvoiceNo.text.trim(),
        'invoiceAmount': _productInvoiceAmount.text.trim().isEmpty
            ? null
            : double.tryParse(_productInvoiceAmount.text),
        'downPayment': _productDownPayment.text.trim().isEmpty
            ? null
            : double.tryParse(_productDownPayment.text),
        'invoicePath': invoicePath,
        'photoPath': photoPath,
      };

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
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
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
          if (guarantorPhotoUrl != null)
            'photoUrl': guarantorPhotoUrl
          else if (_existingGuarantorPhotoUrl != null)
            'photoUrl': _existingGuarantorPhotoUrl,
        };
      }

      String? propertyTitleDeedUrl;
      if (_propertyTitleDeedImage != null) {
        final r = await uploader.uploadFile(_propertyTitleDeedImage!);
        propertyTitleDeedUrl = r.url;
      }
      String? propertyEcUrl;
      if (_propertyEcImage != null) {
        final r = await uploader.uploadFile(_propertyEcImage!);
        propertyEcUrl = r.url;
      }
      String? propertyTaxReceiptUrl;
      if (_propertyTaxReceiptImage != null) {
        final r = await uploader.uploadFile(_propertyTaxReceiptImage!);
        propertyTaxReceiptUrl = r.url;
      }

      String? productInvoiceUrl;
      if (_productInvoiceImage != null) {
        final r = await uploader.uploadFile(_productInvoiceImage!);
        productInvoiceUrl = r.url;
      }
      String? productPhotoUrl;
      if (_productPhotoImage != null) {
        final r = await uploader.uploadFile(_productPhotoImage!);
        productPhotoUrl = r.url;
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
            goldCollateral: _loanType == 'gold' ? _goldCollateralMap() : null,
            propertyCollateral: _loanType == 'property'
                ? _propertyCollateralMap(
                    titleDeedPath: propertyTitleDeedUrl,
                    ecPath: propertyEcUrl,
                    taxReceiptPath: propertyTaxReceiptUrl,
                  )
                : null,
            productItem: _loanType == 'other'
                ? _productItemMap(
                    invoicePath: productInvoiceUrl,
                    photoPath: productPhotoUrl,
                  )
                : null,
          );
      if (!mounted) return;
      ref.invalidate(loansProvider);
      final t = T.of(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${t.x('msg.created_prefix')} ${loan.loanCode}'),
        ),
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
            child: Text(
              '${t.x('step.label')} ${_step + 1}/5',
              style: AppTypography.caption,
            ),
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
                      color:
                          selected ? AppColors.primaryLight : AppColors.surface,
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
                                  style: const TextStyle(color: Colors.white),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      c.name,
                                      style: AppTypography.bodyLarge,
                                    ),
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
                                Icon(
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
    final result = await context.push<Object?>('/customers/new?returnTo=loan');
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
    final appType = AppType.normalize(
      ref.watch(authControllerProvider).user?.appType ?? '',
    );
    final loanTypes = <(String, String, IconData)>[
      if (appType == AppType.productfinance)
        ('other', tr.x('lt.product'), Icons.shopping_bag_outlined)
      else if (appType == AppType.property)
        ('property', tr.x('lt.property'), Icons.home_work_outlined)
      else if (appType == AppType.goldloan)
        ('gold', tr.x('lt.gold'), Icons.diamond_outlined)
      else ...[
        (
          'cheque',
          tr.x('lt.cheque'),
          Icons.account_balance_wallet_outlined,
        ),
        ('gold', tr.x('lt.gold'), Icons.diamond_outlined),
        ('property', tr.x('lt.property'), Icons.home_work_outlined),
      ],
    ];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(tr.x('sec.loan_type'), style: AppTypography.sectionTitle),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final lt in loanTypes)
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
            label: 'Packet No',
            controller: _goldPacket,
            hintText: 'e.g. P-001',
          ),
          const SizedBox(height: 12),
          ..._buildOrnamentRows(tr),
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
              DropdownMenuItem(
                value: 'residential',
                child: Text(tr.x('fld.property_type_residential')),
              ),
              DropdownMenuItem(
                value: 'commercial',
                child: Text(tr.x('fld.property_type_commercial')),
              ),
              DropdownMenuItem(
                value: 'land',
                child: Text(tr.x('fld.property_type_land')),
              ),
            ],
            onChanged: (v) =>
                setState(() => _propertyType = v ?? 'residential'),
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
          const SizedBox(height: 12),
          Text('Collateral Documents', style: AppTypography.sectionTitle),
          const SizedBox(height: 8),
          _buildDocUploadTile(
            label: 'Title Deed',
            file: _propertyTitleDeedImage,
            onPick: () => _pickPropertyDoc('titleDeed'),
            onClear: () => setState(() => _propertyTitleDeedImage = null),
          ),
          _buildDocUploadTile(
            label: 'Encumbrance Certificate (EC)',
            file: _propertyEcImage,
            onPick: () => _pickPropertyDoc('ec'),
            onClear: () => setState(() => _propertyEcImage = null),
          ),
          _buildDocUploadTile(
            label: 'Tax Receipt',
            file: _propertyTaxReceiptImage,
            onPick: () => _pickPropertyDoc('tax'),
            onClear: () => setState(() => _propertyTaxReceiptImage = null),
          ),
          const SizedBox(height: 16),
        ] else if (_loanType == 'other') ...[
          AppTextField(
            label: tr.x('fld.product_name'),
            controller: _productName,
            hintText: 'e.g. LED TV 55 inch',
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: tr.x('fld.product_category'),
            controller: _productCategory,
            hintText: 'Electronics',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  label: tr.x('fld.product_brand'),
                  controller: _productBrand,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppTextField(
                  label: tr.x('fld.product_model_no'),
                  controller: _productModelNo,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: tr.x('fld.product_serial_no'),
            controller: _productSerialNo,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  label: tr.x('fld.product_dealer'),
                  controller: _productDealerName,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppTextField(
                  label: tr.x('fld.product_invoice_no'),
                  controller: _productInvoiceNo,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  label: tr.x('fld.product_invoice_amount'),
                  controller: _productInvoiceAmount,
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppTextField(
                  label: tr.x('fld.product_down_payment'),
                  controller: _productDownPayment,
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Collateral Documents', style: AppTypography.sectionTitle),
          const SizedBox(height: 8),
          _buildDocUploadTile(
            label: 'Invoice / Bill',
            file: _productInvoiceImage,
            onPick: () => _pickProductDoc('invoice'),
            onClear: () => setState(() => _productInvoiceImage = null),
          ),
          _buildDocUploadTile(
            label: 'Product Verification Photo',
            file: _productPhotoImage,
            onPick: () => _pickProductDoc('photo'),
            onClear: () => setState(() => _productPhotoImage = null),
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
            ButtonSegment(
              value: 'upfront_fixed',
              label: Text(tr.x('plan.upfront')),
            ),
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
    final existing = _customer?.guarantors ?? const <Guarantor>[];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(tr.x('sec.guarantor'), style: AppTypography.sectionTitle),
        if (existing.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('Reuse an existing guarantor', style: AppTypography.label),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final g in existing)
                ChoiceChip(
                  label: Text('${g.name} (${g.phone})'),
                  selected: _selectedExistingGuarantorId == g.id,
                  onSelected: (_) => _applyExistingGuarantor(g),
                ),
              ChoiceChip(
                label: const Text('New guarantor'),
                selected: _selectedExistingGuarantorId == null,
                onSelected: (_) => _applyExistingGuarantor(null),
              ),
            ],
          ),
        ],
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
                  : (_existingGuarantorPhotoUrl != null
                      ? Image.network(
                          absoluteMediaUrl(ref.watch(mediaBaseUrlProvider),
                              _existingGuarantorPhotoUrl,),
                          fit: BoxFit.cover,)
                      : const Icon(
                          Icons.add_a_photo_outlined,
                          color: AppColors.textLight,
                        )),
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
              label: Text(
                _gPhoto == null
                    ? tr.x('btn.choose_photo')
                    : tr.x('btn.replace'),
              ),
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
              _kv(
                tr.x('rev.start'),
                DateFormat('dd MMM yyyy').format(_startDate),
              ),
              _kv(tr.x('rev.penalty'), _penaltyRate.text),
              if (_loanType == 'cheque') ...[
                if (_chequeBankName.text.isNotEmpty)
                  _kv(tr.x('fld.bank_name'), _chequeBankName.text),
                if (_chequeNumber.text.isNotEmpty)
                  _kv(tr.x('fld.cheque_no'), _chequeNumber.text),
                if (_chequeAmount.text.isNotEmpty)
                  _kv(tr.x('fld.amount'), '₹${_chequeAmount.text}'),
              ] else if (_loanType == 'gold') ...[
                _kv(tr.x('fld.gold_weight'), '${_goldGrams.text} g'),
                _kv(tr.x('fld.gold_purity'), _goldCarat),
                if (_goldItems.text.isNotEmpty)
                  _kv(tr.x('fld.gold_items'), _goldItems.text),
              ] else if (_loanType == 'property') ...[
                _kv(tr.x('fld.property_type'), _propertyType),
                if (_propertyValue.text.isNotEmpty)
                  _kv(tr.x('fld.property_value'), '₹${_propertyValue.text}'),
                if (_propertyAddress.text.isNotEmpty)
                  _kv(tr.x('fld.property_address'), _propertyAddress.text),
              ] else if (_loanType == 'other') ...[
                if (_productName.text.isNotEmpty)
                  _kv(tr.x('fld.product_name'), _productName.text),
                if (_productCategory.text.isNotEmpty)
                  _kv(tr.x('fld.product_category'), _productCategory.text),
                if (_productBrand.text.isNotEmpty)
                  _kv(tr.x('fld.product_brand'), _productBrand.text),
                if (_productModelNo.text.isNotEmpty)
                  _kv(tr.x('fld.product_model_no'), _productModelNo.text),
                if (_productSerialNo.text.isNotEmpty)
                  _kv(tr.x('fld.product_serial_no'), _productSerialNo.text),
                if (_productDealerName.text.isNotEmpty)
                  _kv(tr.x('fld.product_dealer'), _productDealerName.text),
                if (_productInvoiceNo.text.isNotEmpty)
                  _kv(tr.x('fld.product_invoice_no'), _productInvoiceNo.text),
                if (_productInvoiceAmount.text.isNotEmpty)
                  _kv(
                    tr.x('fld.product_invoice_amount'),
                    '₹${_productInvoiceAmount.text}',
                  ),
                if (_productDownPayment.text.isNotEmpty)
                  _kv(
                    tr.x('fld.product_down_payment'),
                    '₹${_productDownPayment.text}',
                  ),
              ],
              if (_calc != null) ...[
                const Divider(),
                _kv(
                  tr.x('rev.per_instalment'),
                  fmt.format(_calc!.perInstalment),
                ),
                _kv(
                  tr.x('rev.net_disbursed'),
                  fmt.format(_netDisbursed()),
                ),
                _kv(
                  tr.x('rev.total_payable'),
                  fmt.format(_calc!.totalRepayable),
                ),
                _kv(
                  tr.x('rev.end_date'),
                  DateFormat('dd MMM yyyy').format(_calc!.endDate),
                ),
              ],
              if (_cheques.isNotEmpty)
                _kv(
                  tr.x('rev.cheques'),
                  '${_cheques.length} ${tr.x('rev.cheques_attached_suffix')}',
                ),
              if (_gName.text.trim().isNotEmpty)
                _kv(
                  tr.x('rev.guarantor'),
                  '${_gName.text.trim()} • ${_gPhone.text.trim()}',
                ),
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
                label: Text(
                  entry.image == null ? t.x('btn.photo') : t.x('btn.change'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
