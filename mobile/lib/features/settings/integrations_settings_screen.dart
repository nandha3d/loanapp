import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/settings_service.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

class IntegrationsSettingsScreen extends ConsumerStatefulWidget {
  const IntegrationsSettingsScreen({super.key});

  @override
  ConsumerState<IntegrationsSettingsScreen> createState() =>
      _IntegrationsSettingsScreenState();
}

class _IntegrationsSettingsScreenState
    extends ConsumerState<IntegrationsSettingsScreen> {
  final _nachMaxAmount = TextEditingController();
  final _nachPresentDays = TextEditingController();
  final _nachRetryDays = TextEditingController();
  final _nachMaxRetries = TextEditingController();
  final _msg91Sender = TextEditingController();
  final _msg91Whatsapp = TextEditingController();
  final _msg91AuthKey = TextEditingController();
  final _smtpHost = TextEditingController();
  final _smtpPort = TextEditingController();
  final _smtpUser = TextEditingController();
  final _smtpPass = TextEditingController();
  final _smtpFromName = TextEditingController();
  final _digioClientId = TextEditingController();
  final _digioClientSecret = TextEditingController();
  final _digioWebhookSecret = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _nachEnabled = false;
  bool _messagingEnabled = true;
  bool _smsEnabled = false;
  bool _whatsappEnabled = false;
  bool _emailEnabled = false;
  bool _digioEnabled = false;
  bool _razorpayReady = false;
  bool _msg91KeySet = false;
  bool _smtpPassSet = false;
  bool _digioSecretSet = false;
  bool _digioWebhookSet = false;
  String _nachAuthType = 'netbanking';
  String _digioEnvironment = 'sandbox';
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [
      _nachMaxAmount,
      _nachPresentDays,
      _nachRetryDays,
      _nachMaxRetries,
      _msg91Sender,
      _msg91Whatsapp,
      _msg91AuthKey,
      _smtpHost,
      _smtpPort,
      _smtpUser,
      _smtpPass,
      _smtpFromName,
      _digioClientId,
      _digioClientSecret,
      _digioWebhookSecret,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data = await ref.read(settingsServiceProvider).integrations();
      final razorpay = _map(data['razorpay']);
      final nach = _map(data['nach']);
      final messaging = _map(data['messaging']);
      final email = _map(data['email']);
      final kyc = _map(data['kyc']);

      _razorpayReady = razorpay['ready'] == true;
      _nachEnabled = nach['enabled'] == true;
      _nachMaxAmount.text = _text(nach['defaultMaxAmount']);
      _nachPresentDays.text = _text(nach['presentDaysBefore'], fallback: '2');
      _nachRetryDays.text = _text(nach['retryIntervalDays'], fallback: '2');
      _nachMaxRetries.text = _text(nach['maxRetries'], fallback: '3');
      _nachAuthType = _text(nach['authType'], fallback: 'netbanking');

      _messagingEnabled = messaging['enabled'] != false;
      _smsEnabled = messaging['smsEnabled'] == true;
      _whatsappEnabled = messaging['whatsappEnabled'] == true;
      _msg91KeySet = messaging['msg91AuthKeySet'] == true;
      _msg91Sender.text = _text(messaging['senderId'], fallback: 'LNTRCK');
      _msg91Whatsapp.text = _text(messaging['whatsappNumber']);

      _emailEnabled = email['enabled'] == true;
      _smtpPassSet = email['smtpPassSet'] == true;
      _smtpHost.text = _text(email['smtpHost']);
      _smtpPort.text = _text(email['smtpPort'], fallback: '587');
      _smtpUser.text = _text(email['smtpUser']);
      _smtpFromName.text = _text(email['fromName']);

      _digioEnabled = kyc['enabled'] == true;
      _digioEnvironment = _text(kyc['environment'], fallback: 'sandbox');
      _digioClientId.text = _text(kyc['clientId']);
      _digioSecretSet = kyc['clientSecretSet'] == true;
      _digioWebhookSet = kyc['webhookSecretSet'] == true;
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic> _map(dynamic value) {
    return value is Map<String, dynamic> ? value : const {};
  }

  String _text(dynamic value, {String fallback = ''}) {
    final text = value?.toString() ?? '';
    return text.isEmpty ? fallback : text;
  }

  Future<void> _save(String section, Map<String, dynamic> patch) async {
    setState(() => _saving = true);
    try {
      await ref.read(settingsServiceProvider).saveIntegrations({section: patch});
      _msg91AuthKey.clear();
      _smtpPass.clear();
      _digioClientSecret.clear();
      _digioWebhookSecret.clear();
      await _load();
      _snack('Integration settings saved');
    } catch (e) {
      _snack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.danger : AppColors.success,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Add-on Integrations'),
        centerTitle: true,
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: Skeleton(height: 420),
            )
          : _error.isNotEmpty
              ? Center(
                  child: Text(
                    _error,
                    style: AppTypography.body.copyWith(
                      color: AppColors.danger,
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _section(
                      title: 'e-NACH Auto-Debit',
                      subtitle: _razorpayReady
                          ? 'Razorpay is ready for mandate checkout.'
                          : 'Add Razorpay Key ID and Secret before live mandates.',
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Enable e-NACH mandates'),
                          value: _nachEnabled,
                          onChanged: (v) => setState(() => _nachEnabled = v),
                        ),
                        _input(_nachMaxAmount, 'Default max debit amount',
                            keyboardType: TextInputType.number,),
                        _dropdown(
                          value: _nachAuthType,
                          label: 'Mandate auth type',
                          values: const ['netbanking', 'debitcard', 'aadhaar'],
                          onChanged: (v) => setState(() => _nachAuthType = v),
                        ),
                        _input(_nachPresentDays, 'Present debit days before due',
                            keyboardType: TextInputType.number,),
                        _input(_nachRetryDays, 'Retry interval days',
                            keyboardType: TextInputType.number,),
                        _input(_nachMaxRetries, 'Max retry attempts',
                            keyboardType: TextInputType.number,),
                        _button(
                          'Save NACH',
                          () => _save('nach', {
                            'enabled': _nachEnabled,
                            'defaultMaxAmount': _nachMaxAmount.text.trim(),
                            'authType': _nachAuthType,
                            'presentDaysBefore': _nachPresentDays.text.trim(),
                            'retryIntervalDays': _nachRetryDays.text.trim(),
                            'maxRetries': _nachMaxRetries.text.trim(),
                          }),
                        ),
                      ],
                    ),
                    _section(
                      title: 'MSG91 SMS and WhatsApp',
                      subtitle: _msg91KeySet
                          ? 'MSG91 auth key saved.'
                          : 'Add MSG91 auth key to send SMS or WhatsApp.',
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Enable outbound notifications'),
                          value: _messagingEnabled,
                          onChanged: (v) =>
                              setState(() => _messagingEnabled = v),
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('SMS'),
                          value: _smsEnabled,
                          onChanged: (v) =>
                              setState(() => _smsEnabled = v ?? false),
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('WhatsApp'),
                          value: _whatsappEnabled,
                          onChanged: (v) =>
                              setState(() => _whatsappEnabled = v ?? false),
                        ),
                        _input(_msg91Sender, 'Sender ID'),
                        _input(_msg91Whatsapp, 'WhatsApp number'),
                        _input(
                          _msg91AuthKey,
                          _msg91KeySet
                              ? 'MSG91 auth key saved - blank keeps it'
                              : 'MSG91 auth key',
                          obscure: true,
                        ),
                        _button(
                          'Save MSG91',
                          () => _save('messaging', {
                            'enabled': _messagingEnabled,
                            'smsEnabled': _smsEnabled,
                            'whatsappEnabled': _whatsappEnabled,
                            'senderId': _msg91Sender.text.trim(),
                            'whatsappNumber': _msg91Whatsapp.text.trim(),
                            if (_msg91AuthKey.text.trim().isNotEmpty)
                              'msg91AuthKey': _msg91AuthKey.text.trim(),
                          }),
                        ),
                      ],
                    ),
                    _section(
                      title: 'SMTP Email',
                      subtitle: _smtpPassSet
                          ? 'SMTP password saved.'
                          : 'Add SMTP password to send email notifications.',
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Enable email notifications'),
                          value: _emailEnabled,
                          onChanged: (v) => setState(() => _emailEnabled = v),
                        ),
                        _input(_smtpHost, 'SMTP host'),
                        _input(_smtpPort, 'SMTP port',
                            keyboardType: TextInputType.number,),
                        _input(_smtpUser, 'SMTP user'),
                        _input(_smtpFromName, 'From name'),
                        _input(
                          _smtpPass,
                          _smtpPassSet
                              ? 'SMTP password saved - blank keeps it'
                              : 'SMTP password',
                          obscure: true,
                        ),
                        _button(
                          'Save SMTP',
                          () => _save('email', {
                            'enabled': _emailEnabled,
                            'smtpHost': _smtpHost.text.trim(),
                            'smtpPort': _smtpPort.text.trim(),
                            'smtpUser': _smtpUser.text.trim(),
                            'fromName': _smtpFromName.text.trim(),
                            if (_smtpPass.text.trim().isNotEmpty)
                              'smtpPass': _smtpPass.text.trim(),
                          }),
                        ),
                      ],
                    ),
                    _section(
                      title: 'Digio KYC',
                      subtitle: _digioSecretSet
                          ? 'Digio client secret saved.'
                          : 'Add Digio credentials for KYC sessions.',
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Enable Digio KYC'),
                          value: _digioEnabled,
                          onChanged: (v) => setState(() => _digioEnabled = v),
                        ),
                        _dropdown(
                          value: _digioEnvironment,
                          label: 'Environment',
                          values: const ['sandbox', 'production'],
                          onChanged: (v) =>
                              setState(() => _digioEnvironment = v),
                        ),
                        _input(_digioClientId, 'Client ID'),
                        _input(
                          _digioClientSecret,
                          _digioSecretSet
                              ? 'Client secret saved - blank keeps it'
                              : 'Client secret',
                          obscure: true,
                        ),
                        _input(
                          _digioWebhookSecret,
                          _digioWebhookSet
                              ? 'Webhook secret saved - blank keeps it'
                              : 'Webhook secret',
                          obscure: true,
                        ),
                        _button(
                          'Save Digio',
                          () => _save('kyc', {
                            'enabled': _digioEnabled,
                            'environment': _digioEnvironment,
                            'clientId': _digioClientId.text.trim(),
                            if (_digioClientSecret.text.trim().isNotEmpty)
                              'clientSecret':
                                  _digioClientSecret.text.trim(),
                            if (_digioWebhookSecret.text.trim().isNotEmpty)
                              'webhookSecret':
                                  _digioWebhookSecret.text.trim(),
                          }),
                        ),
                      ],
                    ),
                  ],
                ),
    );
  }

  Widget _section({
    required String title,
    required String subtitle,
    required List<Widget> children,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.sectionTitle),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _input(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
    bool obscure = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        obscureText: obscure,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }

  Widget _dropdown({
    required String value,
    required String label,
    required List<String> values,
    required ValueChanged<String> onChanged,
  }) {
    final effective = values.contains(value) ? value : values.first;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: effective,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        items: values
            .map((v) => DropdownMenuItem(value: v, child: Text(v)))
            .toList(growable: false),
        onChanged: (v) {
          if (v != null) onChanged(v);
        },
      ),
    );
  }

  Widget _button(String label, VoidCallback onPressed) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: _saving ? null : onPressed,
        child: Text(_saving ? 'Saving...' : label),
      ),
    );
  }
}
