import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/settings_service.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

/// Per-tenant payment gateway: Tier-0 UPI VPA + Tier-1 Razorpay keys.
class PaymentGatewayScreen extends ConsumerStatefulWidget {
  const PaymentGatewayScreen({super.key});

  @override
  ConsumerState<PaymentGatewayScreen> createState() =>
      _PaymentGatewayScreenState();
}

class _PaymentGatewayScreenState extends ConsumerState<PaymentGatewayScreen> {
  final _upiId = TextEditingController();
  final _keyId = TextEditingController();
  final _keySecret = TextEditingController();
  final _webhookSecret = TextEditingController();
  bool _enabled = false;
  bool _loading = true;
  bool _saving = false;
  bool _keySecretSet = false;
  bool _webhookSecretSet = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _upiId.dispose();
    _keyId.dispose();
    _keySecret.dispose();
    _webhookSecret.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final m = await ref.read(settingsServiceProvider).gateway();
      _upiId.text = (m['upiId'] as String?) ?? '';
      _keyId.text = (m['keyId'] as String?) ?? '';
      _enabled = m['enabled'] == true;
      _keySecretSet = m['keySecretSet'] == true;
      _webhookSecretSet = m['webhookSecretSet'] == true;
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_enabled && _keyId.text.trim().isEmpty) {
      _snack('Key ID is required to enable the gateway', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(settingsServiceProvider).saveGateway({
        'upiId': _upiId.text.trim(),
        'enabled': _enabled,
        'keyId': _keyId.text.trim(),
        if (_keySecret.text.trim().isNotEmpty)
          'keySecret': _keySecret.text.trim(),
        if (_webhookSecret.text.trim().isNotEmpty)
          'webhookSecret': _webhookSecret.text.trim(),
      });
      _keySecret.clear();
      _webhookSecret.clear();
      _snack('Gateway saved');
      await _load();
    } catch (e) {
      _snack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.danger : AppColors.success,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Payment Gateway'), centerTitle: true),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16), child: Skeleton(height: 320),)
          : _error != null
              ? Center(
                  child: Text(_error!,
                      style:
                          AppTypography.body.copyWith(color: AppColors.danger),),)
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _card(
                      title: 'Tier 0 · UPI (no account needed)',
                      subtitle:
                          'Borrowers get a QR with the exact amount and pay into your bank. Staff confirm receipt.',
                      children: [
                        _label('Your UPI ID (VPA)'),
                        TextField(
                          controller: _upiId,
                          decoration: const InputDecoration(
                            hintText: 'yourbusiness@okaxis',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _card(
                      title: 'Tier 1 · Razorpay (auto-confirm)',
                      subtitle:
                          'Connect your own Razorpay account so UPI/links reconcile automatically.',
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Enable live Razorpay'),
                          value: _enabled,
                          onChanged: (v) => setState(() => _enabled = v),
                        ),
                        _label('Key ID'),
                        TextField(
                          controller: _keyId,
                          decoration: const InputDecoration(
                            hintText: 'rzp_live_xxxxxxxx',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _label(
                            'Key Secret${_keySecretSet ? ' · saved (blank = keep)' : ''}',),
                        TextField(
                          controller: _keySecret,
                          obscureText: true,
                          decoration: InputDecoration(
                            hintText: _keySecretSet ? '••••••••' : 'Key secret',
                            border: const OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _label(
                            'Webhook Secret${_webhookSecretSet ? ' · saved (blank = keep)' : ''}',),
                        TextField(
                          controller: _webhookSecret,
                          obscureText: true,
                          decoration: InputDecoration(
                            hintText: _webhookSecretSet
                                ? '••••••••'
                                : 'Webhook secret',
                            border: const OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Webhook URL: <app>/api/webhooks/razorpay/collections — set the same secret in your Razorpay dashboard and subscribe to payment_link.paid, payment.captured, order.paid.',
                          style: AppTypography.caption
                              .copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _saving ? null : _save,
                      child: Text(_saving ? 'Saving…' : 'Save gateway'),
                    ),
                  ],
                ),
    );
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6, top: 4),
        child: Text(t, style: AppTypography.label),
      );

  Widget _card({
    required String title,
    required String subtitle,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.sectionTitle),
          const SizedBox(height: 4),
          Text(subtitle,
              style: AppTypography.caption
                  .copyWith(color: AppColors.textSecondary),),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}
