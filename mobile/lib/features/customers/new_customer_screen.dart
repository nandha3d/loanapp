import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:loantrack/core/network/api_exception.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/analytics.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/route_model.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/data/services/analytics_service.dart';
import 'package:loantrack/data/services/customer_service.dart';
import 'package:loantrack/data/services/settings_service.dart';
import 'package:loantrack/core/gps/gps_service.dart';
import 'package:loantrack/data/services/upload_service.dart';

// ── Providers ──────────────────────────────────────────────────────────────

final _routeListProvider = FutureProvider.autoDispose<List<AppRoute>>((ref) {
  return ref.watch(settingsServiceProvider).routes();
});

final _agentListProvider =
    FutureProvider.autoDispose<List<AgentPerformance>>((ref) {
  return ref.watch(analyticsServiceProvider).agents();
});

// ── Local models ───────────────────────────────────────────────────────────

class _DocEntry {
  _DocEntry({required this.file});
  final File file;
  String type = 'aadhar';
}

class _CollectionPointEntry {
  _CollectionPointEntry()
      : name = TextEditingController(),
        address = TextEditingController();
  final TextEditingController name;
  final TextEditingController address;
  double? lat;
  double? lng;
  bool isPrimary = false;
  void dispose() {
    name.dispose();
    address.dispose();
  }
}

class _GuarantorEntry {
  _GuarantorEntry()
      : name = TextEditingController(),
        phone = TextEditingController(),
        address = TextEditingController();
  final TextEditingController name;
  final TextEditingController phone;
  final TextEditingController address;
  String? relation;
  File? photo;
  String? photoUrl;
  void dispose() {
    name.dispose();
    phone.dispose();
    address.dispose();
  }
}

// ── Screen ─────────────────────────────────────────────────────────────────

class NewCustomerScreen extends ConsumerStatefulWidget {
  const NewCustomerScreen({super.key, this.returnTo, this.editCustomer});
  final String? returnTo;
  /// When non-null the screen runs in EDIT mode: basic fields are prefilled and
  /// the form PATCHes the existing customer instead of creating a new one.
  final Customer? editCustomer;

  @override
  ConsumerState<NewCustomerScreen> createState() => _NewCustomerScreenState();
}

class _NewCustomerScreenState extends ConsumerState<NewCustomerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _aadharCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _panCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  // Company / business section (web parity)
  final _companyNameCtrl = TextEditingController();
  final _designationCtrl = TextEditingController();
  final _gstCtrl = TextEditingController();
  final _companyPanCtrl = TextEditingController();
  final _companyRegNoCtrl = TextEditingController();
  final _occupationCtrl = TextEditingController();
  final _companyPhoneCtrl = TextEditingController();
  final _companyEmailCtrl = TextEditingController();
  final _monthlyIncomeCtrl = TextEditingController();
  final _companyAddressCtrl = TextEditingController();
  String? _businessType;
  String? _companyType;
  File? _companyLogo;
  bool _showCompany = false;
  final _picker = ImagePicker();
  String? _kycStatus;

  bool get _isEdit => widget.editCustomer != null;

  @override
  void initState() {
    super.initState();
    final c = widget.editCustomer;
    if (c != null) {
      _nameCtrl.text = c.name;
      _phoneCtrl.text = c.phone;
      _addressCtrl.text = c.address ?? '';
      _routeId = c.routeId;
      _agentId = c.agentId;
      _panCtrl.text = c.pan ?? '';
      _emailCtrl.text = c.email ?? '';
      _companyNameCtrl.text = c.companyName ?? '';
      _designationCtrl.text = c.designation ?? '';
      _gstCtrl.text = c.gstNumber ?? '';
      _companyPanCtrl.text = c.companyPan ?? '';
      _companyRegNoCtrl.text = c.companyRegNo ?? '';
      _occupationCtrl.text = c.occupation ?? '';
      _companyPhoneCtrl.text = c.companyPhone ?? '';
      _companyEmailCtrl.text = c.companyEmail ?? '';
      _monthlyIncomeCtrl.text =
          c.monthlyIncome == null ? '' : c.monthlyIncome!.toStringAsFixed(0);
      _companyAddressCtrl.text = c.companyAddress ?? '';
      _businessType = c.businessType;
      _companyType = c.companyType;
      // Auto-expand the company section if any company data exists.
      _showCompany = (c.companyName ?? '').isNotEmpty ||
          (c.gstNumber ?? '').isNotEmpty ||
          (c.companyPan ?? '').isNotEmpty ||
          c.businessType != null ||
          c.companyType != null;
      _kycStatus = c.kycStatus;
      // Prefill guarantors
      for (final g in c.guarantors) {
        final entry = _GuarantorEntry()
          ..name.text = g.name
          ..phone.text = g.phone
          ..address.text = g.address ?? ''
          ..relation = g.relation
          ..photoUrl = g.photoUrl;
        _guarantors.add(entry);
      }
      // Prefill collection points from existing customer.
      for (final cp in c.collectionPoints) {
        final entry = _CollectionPointEntry()
          ..name.text = cp.name
          ..address.text = cp.address
          ..lat = cp.latitude
          ..lng = cp.longitude
          ..isPrimary = cp.isPrimary;
        _collectionPoints.add(entry);
      }
    }
  }

  File? _photo;
  final List<_DocEntry> _docs = [];
  final List<_GuarantorEntry> _guarantors = [];
  final List<_CollectionPointEntry> _collectionPoints = [];
  String? _routeId;
  String? _agentId;
  bool _submitting = false;
  String? _error;
  final Map<String, String?> _fieldErrors = {};

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _aadharCtrl.dispose();
    _addressCtrl.dispose();
    _panCtrl.dispose();
    _emailCtrl.dispose();
    _companyNameCtrl.dispose();
    _designationCtrl.dispose();
    _gstCtrl.dispose();
    _companyPanCtrl.dispose();
    _companyRegNoCtrl.dispose();
    _occupationCtrl.dispose();
    _companyPhoneCtrl.dispose();
    _companyEmailCtrl.dispose();
    _monthlyIncomeCtrl.dispose();
    _companyAddressCtrl.dispose();
    for (final g in _guarantors) {
      g.dispose();
    }
    for (final cp in _collectionPoints) {
      cp.dispose();
    }
    super.dispose();
  }

  // ── Photo picking ─────────────────────────────────────────────────────

  void _showPhotoSourcePicker() {
    final t = T.of(ref);
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: Icon(Icons.camera_alt_outlined,
                    color: AppColors.primary,),
                title: Text(t.x('btn.take_photo')),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera, isPhoto: true);
                },
              ),
              ListTile(
                leading: Icon(Icons.photo_library_outlined,
                    color: AppColors.primary,),
                title: Text(t.x('btn.choose_gallery')),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.gallery, isPhoto: true);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDocSourcePicker() {
    final t = T.of(ref);
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: Icon(Icons.camera_alt_outlined,
                    color: AppColors.primary,),
                title: Text(t.x('btn.scan_doc')),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera, isPhoto: false);
                },
              ),
              ListTile(
                leading: Icon(Icons.photo_library_outlined,
                    color: AppColors.primary,),
                title: Text(t.x('btn.choose_gallery')),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.gallery, isPhoto: false);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickGuarantorPhoto(int index) async {
    final t = T.of(ref);
    ImageSource? source;
    await showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: Icon(Icons.camera_alt_outlined,
                    color: AppColors.primary,),
                title: Text(t.x('btn.take_photo')),
                onTap: () {
                  source = ImageSource.camera;
                  Navigator.pop(ctx);
                },
              ),
              ListTile(
                leading: Icon(Icons.photo_library_outlined,
                    color: AppColors.primary,),
                title: Text(t.x('btn.choose_gallery')),
                onTap: () {
                  source = ImageSource.gallery;
                  Navigator.pop(ctx);
                },
              ),
            ],
          ),
        ),
      ),
    );
    if (source == null) return;
    final x = await _picker.pickImage(
      source: source!,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 80,
    );
    if (x == null) return;
    setState(() => _guarantors[index].photo = File(x.path));
  }

  Future<void> _pickImage(ImageSource source, {required bool isPhoto}) async {
    final x = await _picker.pickImage(
      source: source,
      // Compress on pick: 800px / quality 80 keeps images well under 1 MB
      maxWidth: isPhoto ? 800 : 1200,
      maxHeight: isPhoto ? 800 : 1600,
      imageQuality: isPhoto ? 80 : 75,
    );
    if (x == null) return;
    final file = File(x.path);
    if (isPhoto) {
      setState(() => _photo = file);
    } else {
      setState(() => _docs.add(_DocEntry(file: file)));
    }
  }

  // ── Validation ────────────────────────────────────────────────────────

  bool _validate() {
    final t = T.of(ref);
    final errs = <String, String?>{};
    if (_nameCtrl.text.trim().isEmpty) errs['name'] = t.x('err.name_required');
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      errs['phone'] = t.x('err.phone_required');
    } else if (!RegExp(r'^\d{10}$').hasMatch(phone)) {
      errs['phone'] = t.x('err.phone_invalid');
    }
    final aadhar = _aadharCtrl.text.trim();
    if (aadhar.isNotEmpty && !RegExp(r'^\d{12}$').hasMatch(aadhar)) {
      errs['aadhar'] = t.x('err.aadhar_invalid');
    }
    if (!_isEdit && _routeId == null) errs['route'] = t.x('err.route_required');
    setState(() => _fieldErrors
      ..clear()
      ..addAll(errs),);
    return errs.isEmpty;
  }

  // Assembles the extended PAN/email/company fields. Only non-empty values
  // are sent so the API doesn't overwrite with blanks. `logoUrl` is the
  // already-uploaded company logo URL (null when unchanged/unset).
  Map<String, dynamic> _extendedFields(String? logoUrl, List<Map<String, dynamic>> guarantorPayloads) {
    final m = <String, dynamic>{};
    void put(String key, String value) {
      final v = value.trim();
      if (v.isNotEmpty) m[key] = v;
    }

    put('pan', _panCtrl.text);
    put('email', _emailCtrl.text);
    put('companyName', _companyNameCtrl.text);
    put('designation', _designationCtrl.text);
    put('gstNumber', _gstCtrl.text);
    put('companyPan', _companyPanCtrl.text);
    put('companyRegNo', _companyRegNoCtrl.text);
    put('occupation', _occupationCtrl.text);
    put('companyPhone', _companyPhoneCtrl.text);
    put('companyEmail', _companyEmailCtrl.text);
    put('companyAddress', _companyAddressCtrl.text);
    if (_businessType != null) m['businessType'] = _businessType;
    if (_companyType != null) m['companyType'] = _companyType;
    final income = _monthlyIncomeCtrl.text.trim();
    if (income.isNotEmpty) {
      final n = double.tryParse(income);
      if (n != null) m['monthlyIncome'] = n;
    }
    if (logoUrl != null) m['companyLogo'] = logoUrl;
    final cps = _collectionPoints
        .where((cp) =>
            cp.name.text.trim().isNotEmpty && cp.address.text.trim().isNotEmpty,)
        .map((cp) => <String, dynamic>{
              'name': cp.name.text.trim(),
              'address': cp.address.text.trim(),
              if (cp.lat != null) 'latitude': cp.lat,
              if (cp.lng != null) 'longitude': cp.lng,
              'isPrimary': cp.isPrimary,
            },)
        .toList();
    if (cps.isNotEmpty) m['collectionPoints'] = cps;
    if (guarantorPayloads.isNotEmpty) m['guarantors'] = guarantorPayloads;
    if (_kycStatus != null) m['kycStatus'] = _kycStatus;
    if (_routeId != null) m['routeId'] = _routeId;
    if (_agentId != null) m['agentId'] = _agentId;
    return m;
  }

  // ── Submit ────────────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!_validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final uploader = ref.read(uploadServiceProvider);

      // Upload guarantor photos
      final guarantorPayloads = <Map<String, dynamic>>[];
      for (final g in _guarantors) {
        if (g.name.text.trim().isEmpty || g.phone.text.trim().isEmpty) continue;
        String? gPhotoUrl;
        if (g.photo != null) {
          final r = await uploader.uploadFile(g.photo!, contentType: 'image/jpeg');
          gPhotoUrl = r.url;
        }
        guarantorPayloads.add({
          'name': g.name.text.trim(),
          'phone': g.phone.text.trim(),
          if (g.address.text.trim().isNotEmpty) 'address': g.address.text.trim(),
          if (g.relation != null) 'relation': g.relation,
          if (gPhotoUrl != null || g.photoUrl != null) 'photo': gPhotoUrl ?? g.photoUrl,
        });
      }

      // ── EDIT mode: PATCH the supported basic fields ──────────────────────
      if (_isEdit) {
        String? logoUrl;
        if (_companyLogo != null) {
          final r = await uploader.uploadFile(_companyLogo!, contentType: 'image/jpeg');
          logoUrl = r.url;
        }
        final patch = <String, dynamic>{
          'name': _nameCtrl.text.trim(),
          'phone': _phoneCtrl.text.trim(),
          'address': _addressCtrl.text.trim().isEmpty
              ? null
              : _addressCtrl.text.trim(),
          ..._extendedFields(logoUrl, guarantorPayloads),
        };
        if (_aadharCtrl.text.trim().isNotEmpty) {
          patch['aadharNumber'] = _aadharCtrl.text.trim();
        }
        final updated = await ref
            .read(customerRepositoryProvider)
            .update(widget.editCustomer!.id, patch);
        if (!mounted) return;
        ref.invalidate(customerListProvider);
        ref.invalidate(customerDetailProvider(updated.id));
        final t = T.of(ref);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(t.x('msg.customer_updated')),
            backgroundColor: AppColors.success,
          ),
        );
        if (context.canPop()) {
          context.pop(updated);
        } else {
          context.go('/customers/${updated.id}');
        }
        return;
      }

      String? photoUrl;
      if (_photo != null) {
        final r = await uploader.uploadFile(_photo!, contentType: 'image/jpeg');
        photoUrl = r.url;
      }
      final kycInputs = <KycDocInput>[];
      for (final d in _docs) {
        final r = await uploader.uploadFile(d.file, contentType: 'image/jpeg');
        kycInputs.add(KycDocInput(type: d.type, url: r.url));
      }
      String? logoUrl;
      if (_companyLogo != null) {
        final r =
            await uploader.uploadFile(_companyLogo!, contentType: 'image/jpeg');
        logoUrl = r.url;
      }
      final created = await ref.read(customerRepositoryProvider).create(
            name: _nameCtrl.text.trim(),
            phone: _phoneCtrl.text.trim(),
            address: _addressCtrl.text.trim().isEmpty
                ? null
                : _addressCtrl.text.trim(),
            aadharNumber: _aadharCtrl.text.trim().isEmpty
                ? null
                : _aadharCtrl.text.trim(),
            routeId: _routeId,
            agentId: _agentId,
            photoUrl: photoUrl,
            kycDocs: kycInputs,
            extra: _extendedFields(logoUrl, guarantorPayloads),
          );
      if (!mounted) return;
      ref.invalidate(customerListProvider);
      final t = T.of(ref);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${t.x('msg.customer_created_code')} ${created.customerCode} ${t.x('msg.created')}'),
          backgroundColor: AppColors.success,
        ),
      );
      if (widget.returnTo == 'loan' && context.canPop()) {
        context.pop(created);
      } else {
        context.go('/customers');
      }
    } on ApiException catch (e) {
      if (e.code == 'CUSTOMER_ALREADY_EXISTS' && e.data != null) {
        final custMap = e.data['customer'] as Map<String, dynamic>?;
        if (custMap != null) {
          final existingCust = Customer.fromJson(custMap);
          final select = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Customer Already Exists'),
              content: Text('Customer "${existingCust.name}" (${existingCust.customerCode}) is already created with this phone number. Do you want to select that customer?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('No'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Yes, Select'),
                ),
              ],
            ),
          );
          if (select == true) {
            if (!mounted) return;
            if (widget.returnTo == 'loan' && context.canPop()) {
              context.pop(existingCust);
            } else {
              context.go('/customers/${existingCust.id}');
            }
            return;
          }
        }
      }
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // ── New agent dialog ──────────────────────────────────────────────────

  Future<void> _showNewAgentDialog() async {
    final t = T.of(ref);
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();

    final created = await showDialog<AgentPerformance>(
      context: context,
      builder: (ctx) {
        String? err;
        bool creating = false;
        bool obscurePassword = true;
        return StatefulBuilder(
          builder: (ctx, setLocal) => AlertDialog(
            title: Text(t.x('dlg.add_agent')),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (err != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.dangerBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(err!,
                          style: const TextStyle(
                              color: AppColors.danger, fontSize: 13,),),
                    ),
                    const SizedBox(height: 10),
                  ],
                  TextField(
                    controller: nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(labelText: t.x('fld.agent_name')),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(labelText: t.x('fld.phone')),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(labelText: t.x('fld.email')),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: passCtrl,
                    obscureText: obscurePassword,
                    decoration: InputDecoration(
                      labelText: t.x('fld.password_label'),
                      suffixIcon: IconButton(
                        tooltip: obscurePassword ? 'Show password' : 'Hide password',
                        icon: Icon(obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setLocal(() => obscurePassword = !obscurePassword),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text(t.x('common.cancel')),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,),
                onPressed: creating
                    ? null
                    : () async {
                        if (nameCtrl.text.trim().isEmpty ||
                            phoneCtrl.text.trim().isEmpty ||
                            emailCtrl.text.trim().isEmpty ||
                            passCtrl.text.isEmpty) {
                          setLocal(() => err = t.x('err.all_fields_required'));
                          return;
                        }
                        setLocal(() {
                          creating = true;
                          err = null;
                        });
                        try {
                          final agent = await ref
                              .read(settingsServiceProvider)
                              .createAgent(
                                name: nameCtrl.text.trim(),
                                email: emailCtrl.text.trim(),
                                phone: phoneCtrl.text.trim(),
                                password: passCtrl.text,
                              );
                          if (ctx.mounted) Navigator.pop(ctx, agent);
                        } catch (e) {
                          setLocal(() {
                            creating = false;
                            err = e
                                .toString()
                                .replaceFirst('Exception: ', '');
                          });
                        }
                      },
                child: creating
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2,),
                      )
                    : Text(t.x('btn.create_agent')),
              ),
            ],
          ),
        );
      },
    );

    nameCtrl.dispose();
    phoneCtrl.dispose();
    emailCtrl.dispose();
    passCtrl.dispose();

    if (created != null) {
      ref.invalidate(_agentListProvider);
      setState(() => _agentId = created.id);
    }
  }

  // ── New route dialog ──────────────────────────────────────────────────

  Future<void> _showNewRouteDialog() async {
    final t = T.of(ref);
    final ctrl = TextEditingController();
    final created = await showDialog<AppRoute>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.x('dlg.new_route')),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(labelText: t.x('fld.route_name')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(t.x('common.cancel')),
          ),
          FilledButton(
            onPressed: () async {
              if (ctrl.text.trim().isEmpty) return;
              try {
                final route = await ref
                    .read(settingsServiceProvider)
                    .createRoute(name: ctrl.text.trim());
                if (ctx.mounted) Navigator.pop(ctx, route);
              } catch (e) {
                if (ctx.mounted) Navigator.pop(ctx);
              }
            },
            child: Text(t.x('btn.create')),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (created != null) {
      ref.invalidate(_routeListProvider);
      setState(() => _routeId = created.id);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final routesAsync = ref.watch(_routeListProvider);
    final agentsAsync = ref.watch(_agentListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_isEdit ? t.x('cust.edit_profile') : t.x('cust.register_title')),
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/customers'),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
          children: [
            // ── Card wrapper ──────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppTokens.radius),
                boxShadow: AppTokens.shadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Photo + Name / Phone row ──────────────────────
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!_isEdit) ...[
                        _PhotoAvatar(
                          photo: _photo,
                          label: t.x('btn.add_photo'),
                          onTap: _showPhotoSourcePicker,
                        ),
                        const SizedBox(width: 16),
                      ],
                      Expanded(
                        child: Column(
                          children: [
                            _LabeledField(
                              label: t.x('fld.full_name'),
                              required: true,
                              child: TextField(
                                controller: _nameCtrl,
                                textCapitalization:
                                    TextCapitalization.words,
                                onChanged: (_) => setState(
                                    () => _fieldErrors.remove('name'),),
                                style: AppTypography.body,
                                decoration: _inputDec(
                                  t.x('fld.enter_full_name'),
                                  error: _fieldErrors['name'],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            _LabeledField(
                              label: t.x('fld.phone'),
                              required: true,
                              child: TextField(
                                controller: _phoneCtrl,
                                keyboardType: TextInputType.phone,
                                onChanged: (_) => setState(
                                    () => _fieldErrors.remove('phone'),),
                                style: AppTypography.body,
                                decoration: _inputDec(
                                  t.x('fld.enter_phone'),
                                  error: _fieldErrors['phone'],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // ── Aadhar ───────────────────────────────────────
                  _LabeledField(
                    label: t.x('fld.aadhar'),
                    child: TextField(
                      controller: _aadharCtrl,
                      keyboardType: TextInputType.number,
                      maxLength: 12,
                      onChanged: (_) =>
                          setState(() => _fieldErrors.remove('aadhar')),
                      style: AppTypography.body,
                      decoration: _inputDec(
                        t.x('fld.aadhar_hint'),
                        error: _fieldErrors['aadhar'],
                        counter: false,
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // ── PAN + Email ──────────────────────────────────
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _LabeledField(
                          label: t.x('fld.pan'),
                          child: TextField(
                            controller: _panCtrl,
                            textCapitalization: TextCapitalization.characters,
                            maxLength: 10,
                            style: AppTypography.body,
                            decoration: _inputDec('ABCDE1234F', counter: false),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _LabeledField(
                          label: t.x('fld.email'),
                          child: TextField(
                            controller: _emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            style: AppTypography.body,
                            decoration: _inputDec('name@example.com'),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // ── Address ──────────────────────────────────────
                  _LabeledField(
                    label: t.x('fld.address'),
                    child: TextField(
                      controller: _addressCtrl,
                      maxLines: 3,
                      style: AppTypography.body,
                      decoration: _inputDec(t.x('fld.address_postal')),
                    ),
                  ),

                  if (_isEdit) ...[
                    const SizedBox(height: 16),
                    _LabeledField(
                      label: t.x('fld.kyc'),
                      child: _AppDropdown<String>(
                        value: _kycStatus,
                        hint: 'Select KYC Status',
                        items: const [
                          DropdownMenuItem(value: 'pending', child: Text('PENDING')),
                          DropdownMenuItem(value: 'verified', child: Text('VERIFIED')),
                          DropdownMenuItem(value: 'rejected', child: Text('REJECTED')),
                        ],
                        onChanged: (v) => setState(() => _kycStatus = v),
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),

                  // ── Route + Agent ──────────────────────────────────────────
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _LabeledField(
                          label: t.x('fld.route_line'),
                          required: true,
                          trailing: TextButton(
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            onPressed: _showNewRouteDialog,
                            child: Text(
                              t.x('btn.new_route'),
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.primary),
                            ),
                          ),
                          child: routesAsync.when(
                            loading: () => _dropdownSkeleton(),
                            error: (_, __) => _dropdownError(t.x('err.routes_unavail')),
                            data: (routes) => _AppDropdown<String>(
                              value: _routeId,
                              hint: t.x('fld.select_route'),
                              error: _fieldErrors['route'],
                              items: routes
                                  .map(
                                    (r) => DropdownMenuItem(
                                      value: r.id,
                                      child: Text(
                                        r.name,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) => setState(() {
                                _routeId = v;
                                _fieldErrors.remove('route');
                              }),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _LabeledField(
                          label: t.x('fld.assigned_agent'),
                          trailing: TextButton(
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            onPressed: _showNewAgentDialog,
                            child: Text(
                              t.x('btn.new_agent'),
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.primary),
                            ),
                          ),
                          child: agentsAsync.when(
                            loading: () => _dropdownSkeleton(),
                            error: (_, __) => _dropdownError(t.x('err.agents_unavail')),
                            data: (agents) => _AppDropdown<String>(
                              value: _agentId,
                              hint: t.x('fld.select_agent'),
                              items: agents
                                  .map(
                                    (a) => DropdownMenuItem(
                                      value: a.id,
                                      child: Text(
                                        a.name,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) =>
                                  setState(() => _agentId = v),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── Company / Business section (collapsible) ───────────────
            _buildCompanySection(t),

            const SizedBox(height: 16),

            // ── Collection Points section ──────────────────────────────
            _buildCollectionPointsSection(t),

            if (!_isEdit) const SizedBox(height: 16),

            // ── Documents section ──────────────────────────────────────
            _SectionCard(
              icon: Icons.attachment_rounded,
              title: t.x('sec.documents_label'),
              child: Column(
                children: [
                  for (int i = 0; i < _docs.length; i++) ...[
                    _DocTile(
                      entry: _docs[i],
                      onRemove: () => setState(() => _docs.removeAt(i)),
                      onTypeChange: (type) =>
                          setState(() => _docs[i].type = type),
                    ),
                    const SizedBox(height: 8),
                  ],
                  _UploadButton(
                    label: t.x('btn.upload_docs'),
                    onTap: _showDocSourcePicker,
                  ),
                ],
              ),
            ),

            if (!_isEdit) const SizedBox(height: 16),

            // ── Guarantors section ─────────────────────────────────────
            _SectionCard(
              icon: Icons.people_alt_outlined,
              iconColor: AppColors.warning,
              title: t.x('sec.guarantors_surety'),
              child: Column(
                children: [
                  for (int i = 0; i < _guarantors.length; i++) ...[
                    _GuarantorTile(
                      entry: _guarantors[i],
                      index: i + 1,
                      onRemove: () {
                        final g = _guarantors.removeAt(i);
                        g.dispose();
                        setState(() {});
                      },
                      onChanged: () => setState(() {}),
                      onPickPhoto: () => _pickGuarantorPhoto(i),
                    ),
                    const SizedBox(height: 8),
                  ],
                  OutlinedButton.icon(
                    onPressed: () =>
                        setState(() => _guarantors.add(_GuarantorEntry())),
                    icon: const Icon(Icons.person_add_outlined, size: 18),
                    label: Text(t.x('btn.add_guarantor')),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: BorderSide(color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),

            // ── Error ──────────────────────────────────────────────────
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: AppColors.danger, size: 18,),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: AppTypography.bodySmall
                            .copyWith(color: AppColors.dangerText),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : Text(
                      t.x('btn.submit'),
                      style: AppTypography.body.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _fillGpsForPoint(_CollectionPointEntry cp) async {
    final pos = await ref.read(gpsServiceProvider).currentPosition();
    if (pos == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(T.of(ref).x('coll.location_off'))),
        );
      }
      return;
    }
    setState(() {
      cp.lat = pos.latitude;
      cp.lng = pos.longitude;
    });
  }

  Widget _buildCollectionPointsSection(T t) {
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
          Row(
            children: [
              Icon(Icons.place_outlined, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(t.x('sec.collection_points'), style: AppTypography.sectionTitle),
            ],
          ),
          const SizedBox(height: 14),
          for (int i = 0; i < _collectionPoints.length; i++) ...[
            _CollectionPointTile(
              entry: _collectionPoints[i],
              index: i + 1,
              onRemove: () {
                final cp = _collectionPoints.removeAt(i);
                cp.dispose();
                setState(() {});
              },
              onChanged: () => setState(() {}),
              onMarkPrimary: () => setState(() {
                for (int j = 0; j < _collectionPoints.length; j++) {
                  _collectionPoints[j].isPrimary = (j == i);
                }
              }),
              onUseGps: () => _fillGpsForPoint(_collectionPoints[i]),
            ),
            const SizedBox(height: 10),
          ],
          OutlinedButton.icon(
            onPressed: () =>
                setState(() => _collectionPoints.add(_CollectionPointEntry())),
            icon: const Icon(Icons.add_location_alt_outlined, size: 18),
            label: Text(t.x('btn.add_collection_point')),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: BorderSide(color: AppColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickCompanyLogo() async {
    final x = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 80,
    );
    if (x == null) return;
    setState(() => _companyLogo = File(x.path));
  }

  Widget _companyField(
    String label,
    TextEditingController ctrl, {
    String? hint,
    TextInputType? keyboardType,
    int? maxLength,
    TextCapitalization capitalization = TextCapitalization.none,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _LabeledField(
        label: label,
        child: TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          maxLength: maxLength,
          textCapitalization: capitalization,
          style: AppTypography.body,
          decoration: _inputDec(hint ?? '', counter: false),
        ),
      ),
    );
  }

  Widget _companyDropdown(
    String label,
    String? value,
    List<(String, String)> options,
    ValueChanged<String?> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _LabeledField(
        label: label,
        child: _AppDropdown<String>(
          value: value,
          hint: '—',
          items: options
              .map((o) => DropdownMenuItem(value: o.$1, child: Text(o.$2)))
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildCompanySection(T t) {
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
          // Header with toggle
          InkWell(
            onTap: () => setState(() => _showCompany = !_showCompany),
            child: Row(
              children: [
                Icon(Icons.business_center_outlined,
                    size: 18, color: AppColors.primary,),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(t.x('sec.company_details'),
                      style: AppTypography.sectionTitle,),
                ),
                Icon(
                  _showCompany ? Icons.expand_less : Icons.expand_more,
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
          if (_showCompany) ...[
            const SizedBox(height: 14),
            // Logo + company name
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: _pickCompanyLogo,
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                      border: Border.all(color: AppColors.border),
                      color: AppColors.background,
                      image: _companyLogo != null
                          ? DecorationImage(
                              image: FileImage(_companyLogo!),
                              fit: BoxFit.cover,)
                          : null,
                    ),
                    child: _companyLogo == null
                        ? const Icon(Icons.add_photo_alternate_outlined,
                            color: AppColors.textSecondary,)
                        : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _companyField(
                    t.x('fld.company_name'),
                    _companyNameCtrl,
                    hint: t.x('fld.company_name_hint'),
                    capitalization: TextCapitalization.words,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _companyDropdown(
              t.x('fld.business_type'),
              _businessType,
              [
                ('proprietorship', t.x('biz.proprietorship')),
                ('partnership', t.x('biz.partnership')),
                ('pvt_ltd', t.x('biz.pvt_ltd')),
                ('public_ltd', t.x('biz.public_ltd')),
                ('llp', t.x('biz.llp')),
                ('other', t.x('biz.other')),
              ],
              (v) => setState(() => _businessType = v),
            ),
            _companyDropdown(
              t.x('fld.employment_type'),
              _companyType,
              [
                ('salaried', t.x('emp.salaried')),
                ('self_employed', t.x('emp.self_employed')),
                ('business', t.x('emp.business')),
                ('unemployed', t.x('emp.unemployed')),
              ],
              (v) => setState(() => _companyType = v),
            ),
            _companyField(t.x('fld.designation'), _designationCtrl,
                hint: t.x('fld.designation_hint'),
                capitalization: TextCapitalization.words,),
            _companyField(t.x('fld.gst'), _gstCtrl,
                hint: '22ABCDE1234F1Z5',
                maxLength: 15,
                capitalization: TextCapitalization.characters,),
            _companyField(t.x('fld.company_pan'), _companyPanCtrl,
                hint: 'ABCDE1234F',
                maxLength: 10,
                capitalization: TextCapitalization.characters,),
            _companyField(t.x('fld.company_reg_no'), _companyRegNoCtrl,
                hint: t.x('fld.company_reg_hint'),),
            _companyField(t.x('fld.occupation'), _occupationCtrl,
                hint: t.x('fld.occupation_hint'),),
            _companyField(t.x('fld.company_phone'), _companyPhoneCtrl,
                keyboardType: TextInputType.phone,),
            _companyField(t.x('fld.company_email'), _companyEmailCtrl,
                hint: 'office@company.com',
                keyboardType: TextInputType.emailAddress,),
            _companyField(t.x('fld.monthly_income'), _monthlyIncomeCtrl,
                hint: '0', keyboardType: TextInputType.number,),
            _companyField(t.x('fld.company_address'), _companyAddressCtrl,
                hint: t.x('fld.company_address_hint'),),
          ],
        ],
      ),
    );
  }

  InputDecoration _inputDec(String hint,
      {String? error, bool counter = true,}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: AppTypography.body.copyWith(color: AppColors.textLight),
      errorText: error,
      errorStyle: AppTypography.caption.copyWith(color: AppColors.danger),
      counterText: counter ? null : '',
      isDense: true,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        borderSide: BorderSide(color: AppColors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        borderSide: const BorderSide(color: AppColors.danger),
      ),
    );
  }

  Widget _dropdownSkeleton() {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      alignment: Alignment.center,
      child: const SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }

  Widget _dropdownError(String msg) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      alignment: Alignment.centerLeft,
      child: Text(msg,
          style:
              AppTypography.caption.copyWith(color: AppColors.textSecondary),),
    );
  }
}

// ── Photo avatar ────────────────────────────────────────────────────────────

class _PhotoAvatar extends StatelessWidget {
  const _PhotoAvatar({required this.photo, required this.label, required this.onTap});
  final File? photo;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.background,
              border: Border.all(color: AppColors.border, width: 1.5),
              image: photo != null
                  ? DecorationImage(
                      image: FileImage(photo!),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: photo == null
                ? const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_a_photo_outlined,
                          size: 26, color: AppColors.textSecondary,),
                    ],
                  )
                : null,
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: AppTypography.tiny.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

// ── Labeled field wrapper ────────────────────────────────────────────────────

class _LabeledField extends StatelessWidget {
  const _LabeledField({
    required this.label,
    required this.child,
    this.required = false,
    this.trailing,
  });
  final String label;
  final Widget child;
  final bool required;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            RichText(
              text: TextSpan(
                style: AppTypography.label,
                children: [
                  TextSpan(text: label),
                  if (required)
                    const TextSpan(
                      text: ' *',
                      style: TextStyle(color: AppColors.danger),
                    ),
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}

// ── Dropdown ────────────────────────────────────────────────────────────────

class _AppDropdown<V> extends StatelessWidget {
  const _AppDropdown({
    required this.value,
    required this.hint,
    required this.items,
    required this.onChanged,
    this.error,
  });
  final V? value;
  final String hint;
  final List<DropdownMenuItem<V>> items;
  final ValueChanged<V?> onChanged;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            border: Border.all(
              color: error != null ? AppColors.danger : AppColors.border,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<V>(
              value: value,
              hint: Text(
                hint,
                style:
                    AppTypography.body.copyWith(color: AppColors.textLight),
              ),
              isExpanded: true,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              items: items,
              onChanged: onChanged,
              style: AppTypography.body,
            ),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 4),
          Text(
            error!,
            style: AppTypography.caption.copyWith(color: AppColors.danger),
          ),
        ],
      ],
    );
  }
}

// ── Section card ─────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  _SectionCard({
    required this.icon,
    required this.title,
    required this.child,
    Color? iconColor,
  }) : iconColor = iconColor ?? AppColors.primary;
  final IconData icon;
  final String title;
  final Widget child;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
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
          Row(
            children: [
              Icon(icon, size: 18, color: iconColor),
              const SizedBox(width: 8),
              Text(title, style: AppTypography.sectionTitle),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

// ── Upload button ────────────────────────────────────────────────────────────

class _UploadButton extends StatelessWidget {
  const _UploadButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          border: Border.all(
            color: AppColors.border,
            style: BorderStyle.solid,
          ),
          color: AppColors.background,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_upload_outlined,
                color: AppColors.primary, size: 20,),
            const SizedBox(width: 8),
            Text(
              label,
              style:
                  AppTypography.body.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Document tile ────────────────────────────────────────────────────────────

class _DocTile extends ConsumerWidget {
  const _DocTile({
    required this.entry,
    required this.onRemove,
    required this.onTypeChange,
  });
  final _DocEntry entry;
  final VoidCallback onRemove;
  final ValueChanged<String> onTypeChange;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final types = [
      ('aadhar', t.x('doc.aadhar')),
      ('pan', t.x('doc.pan')),
      ('passport', t.x('doc.passport')),
      ('other', t.x('doc.other')),
    ];
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.horizontal(
              left: Radius.circular(AppTokens.radiusSm),
            ),
            child: Image.file(
              entry.file,
              width: 64,
              height: 64,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 64,
                height: 64,
                color: AppColors.background,
                child: const Icon(Icons.description_outlined,
                    color: AppColors.textSecondary,),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: entry.type,
                isDense: true,
                style: AppTypography.bodySmall,
                items: types
                    .map(
                      (tp) => DropdownMenuItem(
                        value: tp.$1,
                        child: Text(tp.$2),
                      ),
                    )
                    .toList(),
                onChanged: (v) {
                  if (v != null) onTypeChange(v);
                },
              ),
            ),
          ),
          IconButton(
            icon:
                const Icon(Icons.close, color: AppColors.danger, size: 18),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}

// ── Guarantor tile ────────────────────────────────────────────────────────────

class _CollectionPointTile extends ConsumerWidget {
  const _CollectionPointTile({
    required this.entry,
    required this.index,
    required this.onRemove,
    required this.onChanged,
    required this.onMarkPrimary,
    required this.onUseGps,
  });

  final _CollectionPointEntry entry;
  final int index;
  final VoidCallback onRemove;
  final VoidCallback onChanged;
  final VoidCallback onMarkPrimary;
  final VoidCallback onUseGps;

  static InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: AppTypography.body.copyWith(color: AppColors.textLight),
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final latLngLabel = entry.lat != null
        ? '${entry.lat!.toStringAsFixed(5)}, ${entry.lng!.toStringAsFixed(5)}'
        : '—';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(
          color: entry.isPrimary ? AppColors.primary : AppColors.border,
        ),
        color: entry.isPrimary
            ? AppColors.primary.withAlpha(12)
            : AppColors.background,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Text(
                '${t.x('sec.collection_points')} $index',
                style: AppTypography.label
                    .copyWith(color: AppColors.textSecondary),
              ),
              const Spacer(),
              if (entry.isPrimary)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(24),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    t.x('fld.point_primary'),
                    style: AppTypography.tiny
                        .copyWith(color: AppColors.primary),
                  ),
                )
              else
                TextButton(
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: onMarkPrimary,
                  child: Text(
                    t.x('fld.point_primary'),
                    style: AppTypography.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onRemove,
                child: const Icon(Icons.delete_outline,
                    size: 18, color: AppColors.danger,),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Name
          Text(t.x('fld.point_label'), style: AppTypography.label),
          const SizedBox(height: 6),
          TextField(
            controller: entry.name,
            textCapitalization: TextCapitalization.words,
            style: AppTypography.body,
            onChanged: (_) => onChanged(),
            decoration: _dec(t.x('fld.point_label_hint')),
          ),
          const SizedBox(height: 10),
          // Address
          Text(t.x('fld.address'), style: AppTypography.label),
          const SizedBox(height: 6),
          TextField(
            controller: entry.address,
            maxLines: 2,
            style: AppTypography.body,
            onChanged: (_) => onChanged(),
            decoration: _dec(t.x('fld.address_postal')),
          ),
          const SizedBox(height: 10),
          // GPS row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.x('fld.latitude'), style: AppTypography.label),
                    const SizedBox(height: 4),
                    Text(latLngLabel,
                        style: AppTypography.caption
                            .copyWith(color: AppColors.textSecondary),),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: onUseGps,
                icon: const Icon(Icons.my_location, size: 16),
                label: Text(t.x('btn.use_my_gps')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: BorderSide(color: AppColors.primary),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GuarantorTile extends ConsumerWidget {
  const _GuarantorTile({
    required this.entry,
    required this.index,
    required this.onRemove,
    required this.onChanged,
    required this.onPickPhoto,
  });
  final _GuarantorEntry entry;
  final int index;
  final VoidCallback onRemove;
  final VoidCallback onChanged;
  final VoidCallback onPickPhoto;

  static InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: AppTypography.body.copyWith(color: AppColors.textLight),
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final relations = [
      ('father', t.x('rel.father')),
      ('mother', t.x('rel.mother')),
      ('spouse', t.x('rel.spouse')),
      ('sibling', t.x('rel.sibling')),
      ('friend', t.x('rel.friend')),
      ('other', t.x('rel.other')),
    ];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border),
        color: AppColors.background,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Text(
                '${t.x('guar.title')} $index',
                style: AppTypography.label
                    .copyWith(color: AppColors.textSecondary),
              ),
              const Spacer(),
              GestureDetector(
                onTap: onRemove,
                child: const Icon(Icons.delete_outline,
                    size: 18, color: AppColors.danger,),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Row 1: Name + Phone
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RichText(
                      text: TextSpan(
                        style: AppTypography.label,
                        children: [
                          TextSpan(text: t.x('fld.full_name')),
                          const TextSpan(
                              text: ' *',
                              style: TextStyle(color: AppColors.danger),),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: entry.name,
                      textCapitalization: TextCapitalization.words,
                      style: AppTypography.body,
                      decoration: _dec(t.x('guar.name_hint')),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RichText(
                      text: TextSpan(
                        style: AppTypography.label,
                        children: [
                          TextSpan(text: t.x('fld.phone')),
                          const TextSpan(
                              text: ' *',
                              style: TextStyle(color: AppColors.danger),),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: entry.phone,
                      keyboardType: TextInputType.phone,
                      style: AppTypography.body,
                      decoration: _dec(t.x('guar.phone_hint')),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Row 2: Relation + Photo
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.x('fld.relation'), style: AppTypography.label),
                    const SizedBox(height: 6),
                    Container(
                      decoration: BoxDecoration(
                        borderRadius:
                            BorderRadius.circular(AppTokens.radiusSm),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: entry.relation,
                          hint: Text(
                            t.x('fld.select_relation'),
                            style: AppTypography.body
                                .copyWith(color: AppColors.textLight),
                          ),
                          isExpanded: true,
                          isDense: true,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 4,),
                          borderRadius:
                              BorderRadius.circular(AppTokens.radiusSm),
                          style: AppTypography.body,
                          items: relations
                              .map((r) => DropdownMenuItem(
                                    value: r.$1,
                                    child: Text(r.$2),
                                  ),)
                              .toList(),
                          onChanged: (v) {
                            entry.relation = v;
                            onChanged();
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.x('fld.photo'), style: AppTypography.label),
                    const SizedBox(height: 6),
                    GestureDetector(
                      onTap: onPickPhoto,
                      child: Container(
                        height: 42,
                        decoration: BoxDecoration(
                          borderRadius:
                              BorderRadius.circular(AppTokens.radiusSm),
                          border: Border.all(color: AppColors.border),
                          color: AppColors.surface,
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: entry.photo != null
                            ? Image.file(entry.photo!,
                                fit: BoxFit.cover,
                                width: double.infinity,)
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.add_a_photo_outlined,
                                      size: 16, color: AppColors.primary,),
                                  const SizedBox(width: 6),
                                  Text(
                                    t.x('btn.upload_photo'),
                                    style: AppTypography.bodySmall
                                        .copyWith(color: AppColors.primary),
                                  ),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Address
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t.x('fld.address'), style: AppTypography.label),
              const SizedBox(height: 6),
              TextField(
                controller: entry.address,
                style: AppTypography.body,
                decoration: _dec(t.x('guar.address_hint')),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
