import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/analytics.dart';
import 'package:loantrack/data/models/route_model.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/data/services/analytics_service.dart';
import 'package:loantrack/data/services/customer_service.dart';
import 'package:loantrack/data/services/settings_service.dart';
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
  void dispose() {
    name.dispose();
    phone.dispose();
    address.dispose();
  }
}

// ── Screen ─────────────────────────────────────────────────────────────────

class NewCustomerScreen extends ConsumerStatefulWidget {
  const NewCustomerScreen({super.key, this.returnTo});
  final String? returnTo;

  @override
  ConsumerState<NewCustomerScreen> createState() => _NewCustomerScreenState();
}

class _NewCustomerScreenState extends ConsumerState<NewCustomerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _aadharCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _picker = ImagePicker();

  File? _photo;
  final List<_DocEntry> _docs = [];
  final List<_GuarantorEntry> _guarantors = [];
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
    for (final g in _guarantors) g.dispose();
    super.dispose();
  }

  // ── Photo picking ─────────────────────────────────────────────────────

  void _showPhotoSourcePicker() {
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
                leading: const Icon(Icons.camera_alt_outlined,
                    color: AppColors.primary),
                title: const Text('Take photo'),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera, isPhoto: true);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined,
                    color: AppColors.primary),
                title: const Text('Choose from gallery'),
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
                leading: const Icon(Icons.camera_alt_outlined,
                    color: AppColors.primary),
                title: const Text('Scan document'),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera, isPhoto: false);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined,
                    color: AppColors.primary),
                title: const Text('Choose from gallery'),
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
                leading: const Icon(Icons.camera_alt_outlined,
                    color: AppColors.primary),
                title: const Text('Take photo'),
                onTap: () {
                  source = ImageSource.camera;
                  Navigator.pop(ctx);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined,
                    color: AppColors.primary),
                title: const Text('Choose from gallery'),
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
    final errs = <String, String?>{};
    if (_nameCtrl.text.trim().isEmpty) errs['name'] = 'Full name is required';
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      errs['phone'] = 'Phone number is required';
    } else if (!RegExp(r'^\d{10}$').hasMatch(phone)) {
      errs['phone'] = 'Enter a valid 10-digit number';
    }
    final aadhar = _aadharCtrl.text.trim();
    if (aadhar.isNotEmpty && !RegExp(r'^\d{12}$').hasMatch(aadhar)) {
      errs['aadhar'] = 'Aadhar must be 12 digits';
    }
    if (_routeId == null) errs['route'] = 'Select a route';
    setState(() => _fieldErrors
      ..clear()
      ..addAll(errs));
    return errs.isEmpty;
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
          );
      if (!mounted) return;
      ref.invalidate(customerListProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Customer ${created.customerCode} created'),
          backgroundColor: AppColors.success,
        ),
      );
      if (widget.returnTo == 'loan' && context.canPop()) {
        context.pop(created);
      } else {
        context.go('/customers');
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // ── New agent dialog ──────────────────────────────────────────────────

  Future<void> _showNewAgentDialog() async {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();

    final created = await showDialog<AgentPerformance>(
      context: context,
      builder: (ctx) {
        String? err;
        bool creating = false;
        return StatefulBuilder(
          builder: (ctx, setLocal) => AlertDialog(
            title: const Text('Add New Agent'),
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
                              color: AppColors.danger, fontSize: 13)),
                    ),
                    const SizedBox(height: 10),
                  ],
                  TextField(
                    controller: nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Agent Name'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: passCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Password'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary),
                onPressed: creating
                    ? null
                    : () async {
                        if (nameCtrl.text.trim().isEmpty ||
                            phoneCtrl.text.trim().isEmpty ||
                            emailCtrl.text.trim().isEmpty ||
                            passCtrl.text.isEmpty) {
                          setLocal(() => err = 'All fields required');
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
                            color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Create Agent'),
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
    final ctrl = TextEditingController();
    final created = await showDialog<AppRoute>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Route'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Route name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
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
            child: const Text('Create'),
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
    final routesAsync = ref.watch(_routeListProvider);
    final agentsAsync = ref.watch(_agentListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Register New Customer'),
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/customers'),
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
                      _PhotoAvatar(
                        photo: _photo,
                        onTap: _showPhotoSourcePicker,
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          children: [
                            _LabeledField(
                              label: 'Full Name',
                              required: true,
                              child: TextField(
                                controller: _nameCtrl,
                                textCapitalization:
                                    TextCapitalization.words,
                                onChanged: (_) => setState(
                                    () => _fieldErrors.remove('name')),
                                style: AppTypography.body,
                                decoration: _inputDec(
                                  'Enter full name',
                                  error: _fieldErrors['name'],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            _LabeledField(
                              label: 'Phone Number',
                              required: true,
                              child: TextField(
                                controller: _phoneCtrl,
                                keyboardType: TextInputType.phone,
                                onChanged: (_) => setState(
                                    () => _fieldErrors.remove('phone')),
                                style: AppTypography.body,
                                decoration: _inputDec(
                                  'Enter 10-digit phone',
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
                    label: 'Aadhar Number',
                    child: TextField(
                      controller: _aadharCtrl,
                      keyboardType: TextInputType.number,
                      maxLength: 12,
                      onChanged: (_) =>
                          setState(() => _fieldErrors.remove('aadhar')),
                      style: AppTypography.body,
                      decoration: _inputDec(
                        '12-digit Aadhar number',
                        error: _fieldErrors['aadhar'],
                        counter: false,
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // ── Address ──────────────────────────────────────
                  _LabeledField(
                    label: 'Address',
                    child: TextField(
                      controller: _addressCtrl,
                      maxLines: 3,
                      style: AppTypography.body,
                      decoration: _inputDec('Complete postal address'),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── Route + Agent ─────────────────────────────────
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _LabeledField(
                          label: 'Route / Line',
                          required: true,
                          trailing: TextButton(
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            onPressed: _showNewRouteDialog,
                            child: Text(
                              '+ New Route',
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.primary),
                            ),
                          ),
                          child: routesAsync.when(
                            loading: () => _dropdownSkeleton(),
                            error: (_, __) => _dropdownError('Routes unavailable'),
                            data: (routes) => _AppDropdown<String>(
                              value: _routeId,
                              hint: 'Select Route',
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
                          label: 'Assigned Agent',
                          trailing: TextButton(
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            onPressed: _showNewAgentDialog,
                            child: Text(
                              '+ New Agent',
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.primary),
                            ),
                          ),
                          child: agentsAsync.when(
                            loading: () => _dropdownSkeleton(),
                            error: (_, __) => _dropdownError('Agents unavailable'),
                            data: (agents) => _AppDropdown<String>(
                              value: _agentId,
                              hint: 'Select Agent',
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

            // ── Documents section ──────────────────────────────────────
            _SectionCard(
              icon: Icons.attachment_rounded,
              title: 'Documents (Aadhar, PAN, etc.)',
              child: Column(
                children: [
                  for (int i = 0; i < _docs.length; i++) ...[
                    _DocTile(
                      entry: _docs[i],
                      onRemove: () => setState(() => _docs.removeAt(i)),
                      onTypeChange: (t) =>
                          setState(() => _docs[i].type = t),
                    ),
                    const SizedBox(height: 8),
                  ],
                  _UploadButton(
                    label: 'Tap to upload documents (JPG, PNG, PDF)',
                    onTap: _showDocSourcePicker,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── Guarantors section ─────────────────────────────────────
            _SectionCard(
              icon: Icons.people_alt_outlined,
              iconColor: AppColors.warning,
              title: 'Guarantors / Surety',
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
                    label: const Text('Add Guarantor'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
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
                        color: AppColors.danger, size: 18),
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
                      'Submit',
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

  InputDecoration _inputDec(String hint,
      {String? error, bool counter = true}) {
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
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
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
              AppTypography.caption.copyWith(color: AppColors.textSecondary)),
    );
  }
}

// ── Photo avatar ────────────────────────────────────────────────────────────

class _PhotoAvatar extends StatelessWidget {
  const _PhotoAvatar({required this.photo, required this.onTap});
  final File? photo;
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
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_a_photo_outlined,
                          size: 26, color: AppColors.textSecondary),
                    ],
                  )
                : null,
          ),
          const SizedBox(height: 6),
          Text(
            'Add Photo',
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

class _AppDropdown<T> extends StatelessWidget {
  const _AppDropdown({
    required this.value,
    required this.hint,
    required this.items,
    required this.onChanged,
    this.error,
  });
  final T? value;
  final String hint;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
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
            child: DropdownButton<T>(
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
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.child,
    this.iconColor = AppColors.primary,
  });
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
                color: AppColors.primary, size: 20),
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

class _DocTile extends StatelessWidget {
  const _DocTile({
    required this.entry,
    required this.onRemove,
    required this.onTypeChange,
  });
  final _DocEntry entry;
  final VoidCallback onRemove;
  final ValueChanged<String> onTypeChange;

  static const _types = [
    ('aadhar', 'Aadhar'),
    ('pan', 'PAN'),
    ('passport', 'Passport'),
    ('other', 'Other'),
  ];

  @override
  Widget build(BuildContext context) {
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
                    color: AppColors.textSecondary),
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
                items: _types
                    .map(
                      (t) => DropdownMenuItem(
                        value: t.$1,
                        child: Text(t.$2),
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

class _GuarantorTile extends StatelessWidget {
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

  static const _relations = [
    ('father', 'Father'),
    ('mother', 'Mother'),
    ('spouse', 'Spouse'),
    ('sibling', 'Sibling'),
    ('friend', 'Friend'),
    ('other', 'Other'),
  ];

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
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      );

  @override
  Widget build(BuildContext context) {
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
                'Guarantor $index',
                style: AppTypography.label
                    .copyWith(color: AppColors.textSecondary),
              ),
              const Spacer(),
              GestureDetector(
                onTap: onRemove,
                child: const Icon(Icons.delete_outline,
                    size: 18, color: AppColors.danger),
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
                        children: const [
                          TextSpan(text: 'Full Name'),
                          TextSpan(
                              text: ' *',
                              style: TextStyle(color: AppColors.danger)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: entry.name,
                      textCapitalization: TextCapitalization.words,
                      style: AppTypography.body,
                      decoration: _dec('Guarantor name'),
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
                        children: const [
                          TextSpan(text: 'Phone Number'),
                          TextSpan(
                              text: ' *',
                              style: TextStyle(color: AppColors.danger)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: entry.phone,
                      keyboardType: TextInputType.phone,
                      style: AppTypography.body,
                      decoration: _dec('Phone number'),
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
                    Text('Relation', style: AppTypography.label),
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
                            'Select Relation',
                            style: AppTypography.body
                                .copyWith(color: AppColors.textLight),
                          ),
                          isExpanded: true,
                          isDense: true,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 4),
                          borderRadius:
                              BorderRadius.circular(AppTokens.radiusSm),
                          style: AppTypography.body,
                          items: _relations
                              .map((r) => DropdownMenuItem(
                                    value: r.$1,
                                    child: Text(r.$2),
                                  ))
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
                    Text('Photo', style: AppTypography.label),
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
                                width: double.infinity)
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.add_a_photo_outlined,
                                      size: 16, color: AppColors.primary),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Upload Photo',
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
              Text('Address', style: AppTypography.label),
              const SizedBox(height: 6),
              TextField(
                controller: entry.address,
                style: AppTypography.body,
                decoration: _dec('Address'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
