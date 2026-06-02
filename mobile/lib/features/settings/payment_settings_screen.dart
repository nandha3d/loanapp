import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/settings_service.dart';
import 'package:loantrack/data/services/upload_service.dart';

final _paymentSettingsProvider =
    FutureProvider.autoDispose<Map<String, String>>((ref) async {
  final rows = await ref.read(settingsServiceProvider).all();
  return {
    for (final r in rows)
      if (r['key'] is String) r['key'] as String: (r['value'] ?? '').toString(),
  };
});

class PaymentSettingsScreen extends ConsumerStatefulWidget {
  const PaymentSettingsScreen({super.key});

  @override
  ConsumerState<PaymentSettingsScreen> createState() =>
      _PaymentSettingsScreenState();
}

class _PaymentSettingsScreenState extends ConsumerState<PaymentSettingsScreen> {
  final _upiId = TextEditingController();
  String? _qrUrl;
  bool _receiptPdfActive = false;

  bool _seeded = false;
  bool _saving = false;
  bool _uploading = false;

  @override
  void dispose() {
    _upiId.dispose();
    super.dispose();
  }

  void _seed(Map<String, String> m) {
    if (_seeded) return;
    _seeded = true;
    _upiId.text = m['upi_id'] ?? '';
    _qrUrl = m['upi_qr_url'];
    _receiptPdfActive = m['receipt_pdf_active'] == 'true';
  }

  Future<void> _pickQr() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked == null) return;
    setState(() => _uploading = true);
    try {
      final file = File(picked.path);
      final res = await ref.read(uploadServiceProvider).uploadFile(file);
      setState(() => _qrUrl = res.url);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final patch = <String, dynamic>{
        'upi_id': _upiId.text.trim(),
        'receipt_pdf_active': _receiptPdfActive ? 'true' : 'false',
      };
      if (_qrUrl != null) patch['upi_qr_url'] = _qrUrl;
      await ref.read(settingsServiceProvider).save(patch);
      if (mounted) {
        final t = T.of(ref);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(t.x('set.payment_saved')),
            backgroundColor: AppColors.success,
          ),
        );
        ref.invalidate(_paymentSettingsProvider);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final async = ref.watch(_paymentSettingsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('set.payment')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(e.toString(),
              style: AppTypography.body.copyWith(color: AppColors.danger),),
        ),
        data: (m) {
          _seed(m);
          return _buildForm(t);
        },
      ),
    );
  }

  Widget _buildForm(T t) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // UPI section
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
              Row(
                children: [
                  const Icon(Icons.account_balance_wallet_outlined,
                      color: AppColors.primary, size: 18,),
                  const SizedBox(width: 8),
                  Text(t.x('set.upi_id'), style: AppTypography.sectionTitle),
                ],
              ),
              const SizedBox(height: 14),
              Text(t.x('set.upi_id'), style: AppTypography.label),
              const SizedBox(height: 6),
              TextField(
                controller: _upiId,
                style: AppTypography.body,
                decoration: InputDecoration(
                  hintText: 'name@upi',
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
                    borderSide:
                        const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(t.x('set.upi_qr'), style: AppTypography.label),
              const SizedBox(height: 6),
              if (_qrUrl != null && _qrUrl!.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                    color: Colors.white,
                  ),
                  child: Image.network(
                    _qrUrl!,
                    width: 160,
                    height: 160,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) =>
                        const Icon(Icons.broken_image, size: 48),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              OutlinedButton.icon(
                onPressed: _uploading ? null : _pickQr,
                icon: _uploading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.upload_outlined, size: 18),
                label: Text(_qrUrl != null
                    ? t.x('btn.replace')
                    : t.x('btn.choose_photo'),),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Receipt PDF toggle
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
              Row(
                children: [
                  const Icon(Icons.picture_as_pdf_outlined,
                      color: AppColors.primary, size: 18,),
                  const SizedBox(width: 8),
                  Text(t.x('set.receipt_pdf'),
                      style: AppTypography.sectionTitle,),
                ],
              ),
              const SizedBox(height: 10),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(t.x('set.receipt_pdf'), style: AppTypography.body),
                value: _receiptPdfActive,
                activeColor: AppColors.primary,
                onChanged: (v) => setState(() => _receiptPdfActive = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        FilledButton(
          onPressed: _saving ? null : _save,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
            ),
          ),
          child: _saving
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white,),
                )
              : Text(t.x('common.save'),
                  style: const TextStyle(color: Colors.white),),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}
