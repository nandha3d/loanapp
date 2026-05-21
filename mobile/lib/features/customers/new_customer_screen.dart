import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/data/services/customer_service.dart';
import 'package:loantrack/data/services/upload_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/app_text_field.dart';

class NewCustomerScreen extends ConsumerStatefulWidget {
  const NewCustomerScreen({super.key});

  @override
  ConsumerState<NewCustomerScreen> createState() => _NewCustomerScreenState();
}

class _NewCustomerScreenState extends ConsumerState<NewCustomerScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _aadhar = TextEditingController();
  final _picker = ImagePicker();
  final _page = PageController();

  int _step = 0;
  File? _photo;
  final List<_KycLocal> _kyc = [];
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _aadhar.dispose();
    _page.dispose();
    super.dispose();
  }

  void _goTo(int i) {
    setState(() => _step = i);
    _page.animateToPage(
      i,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  Future<void> _pickPhoto() async {
    final x = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1024,
      imageQuality: 80,
    );
    if (x != null) setState(() => _photo = File(x.path));
  }

  Future<void> _pickKyc() async {
    final x = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      imageQuality: 80,
    );
    if (x != null) {
      setState(() => _kyc.add(_KycLocal(file: File(x.path), type: 'aadhar')));
    }
  }

  bool get _canAdvanceStep1 =>
      _name.text.trim().isNotEmpty && _phone.text.trim().length >= 10;

  Future<void> _submit() async {
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
      for (final k in _kyc) {
        final r = await uploader.uploadFile(k.file, contentType: 'image/jpeg');
        kycInputs.add(KycDocInput(type: k.type, url: r.url));
      }
      final created = await ref.read(customerRepositoryProvider).create(
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            address: _address.text.trim().isEmpty ? null : _address.text.trim(),
            aadharNumber:
                _aadhar.text.trim().isEmpty ? null : _aadhar.text.trim(),
            photoUrl: photoUrl,
            kycDocs: kycInputs,
          );
      if (!mounted) return;
      ref.invalidate(customerListProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Created ${created.customerCode}')),
      );
      context.go('/customers');
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
        title: const Text('New Customer'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/customers'),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: Row(
            children: List.generate(3, (i) {
              final filled = i <= _step;
              return Expanded(
                child: Container(
                  height: 4,
                  color: filled ? AppColors.primary : AppColors.border,
                ),
              );
            }),
          ),
        ),
      ),
      body: PageView(
        controller: _page,
        physics: const NeverScrollableScrollPhysics(),
        children: [_step1(), _step2(), _step3()],
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
                    onPressed:
                        _submitting ? null : () => _goTo(_step - 1),
                  ),
                ),
              if (_step > 0) const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: AppButton(
                  label: _step == 2 ? 'Submit' : 'Next',
                  expand: true,
                  loading: _submitting,
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
    if (_step == 0) return _canAdvanceStep1 ? () => _goTo(1) : null;
    if (_step == 1) return () => _goTo(2);
    return _submit;
  }

  Widget _step1() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Personal Info', style: AppTypography.sectionTitle),
        const SizedBox(height: 16),
        AppTextField(
          label: 'Name',
          controller: _name,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        AppTextField(
          label: 'Phone',
          controller: _phone,
          keyboardType: TextInputType.phone,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        AppTextField(label: 'Address (optional)', controller: _address),
      ],
    );
  }

  Widget _step2() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('KYC & Photo', style: AppTypography.sectionTitle),
        const SizedBox(height: 16),
        AppTextField(
          label: 'Aadhaar Number (optional)',
          controller: _aadhar,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 20),
        Text('Photo', style: AppTypography.label),
        const SizedBox(height: 8),
        _photo == null
            ? OutlinedButton.icon(
                onPressed: _pickPhoto,
                icon: const Icon(Icons.camera_alt_outlined),
                label: const Text('Capture photo'),
              )
            : _ImageTile(file: _photo!, onRemove: () => setState(() => _photo = null)),
        const SizedBox(height: 20),
        Text('KYC Documents', style: AppTypography.label),
        const SizedBox(height: 8),
        for (final k in _kyc) ...[
          _ImageTile(
            file: k.file,
            onRemove: () => setState(() => _kyc.remove(k)),
          ),
          const SizedBox(height: 8),
        ],
        OutlinedButton.icon(
          onPressed: _pickKyc,
          icon: const Icon(Icons.add_photo_alternate_outlined),
          label: const Text('Add KYC document'),
        ),
      ],
    );
  }

  Widget _step3() {
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
              _kv('Name', _name.text),
              _kv('Phone', _phone.text),
              if (_address.text.isNotEmpty) _kv('Address', _address.text),
              if (_aadhar.text.isNotEmpty) _kv('Aadhaar', _aadhar.text),
              _kv('Photo', _photo == null ? '—' : 'Captured'),
              _kv('KYC Documents', '${_kyc.length}'),
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
              style: AppTypography.bodySmall.copyWith(color: AppColors.dangerText),
            ),
          ),
        ],
      ],
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(k, style: AppTypography.caption),
          ),
          Expanded(
            child: Text(v, style: AppTypography.body, maxLines: 2),
          ),
        ],
      ),
    );
  }
}

class _KycLocal {
  _KycLocal({required this.file, required this.type});
  final File file;
  final String type;
}

class _ImageTile extends StatelessWidget {
  const _ImageTile({required this.file, required this.onRemove});
  final File file;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 80,
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
              file,
              width: 80,
              height: 80,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              file.path.split(Platform.pathSeparator).last,
              style: AppTypography.bodySmall,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: AppColors.danger),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}
