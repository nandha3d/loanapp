import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/settings_service.dart';

final _sysSettingsProvider =
    FutureProvider.autoDispose<Map<String, String>>((ref) async {
  final rows = await ref.read(settingsServiceProvider).all();
  return {
    for (final r in rows)
      if (r['key'] is String) r['key'] as String: (r['value'] ?? '').toString(),
  };
});

class SystemSettingsScreen extends ConsumerStatefulWidget {
  const SystemSettingsScreen({super.key});

  @override
  ConsumerState<SystemSettingsScreen> createState() =>
      _SystemSettingsScreenState();
}

class _SystemSettingsScreenState extends ConsumerState<SystemSettingsScreen> {
  final _appName = TextEditingController();
  final _currency = TextEditingController();
  final _currencySymbol = TextEditingController();
  final _prefixDaily = TextEditingController();
  final _prefixWeekly = TextEditingController();
  final _prefixBiweekly = TextEditingController();
  final _prefixMonthly = TextEditingController();

  String _timezone = 'Asia/Kolkata';
  String _midnightCutoff = 'true';
  String _allowWeekend = 'false';
  String _kycMethod = 'manual_upload';

  bool _seeded = false;
  bool _saving = false;

  @override
  void dispose() {
    _appName.dispose();
    _currency.dispose();
    _currencySymbol.dispose();
    _prefixDaily.dispose();
    _prefixWeekly.dispose();
    _prefixBiweekly.dispose();
    _prefixMonthly.dispose();
    super.dispose();
  }

  void _seed(Map<String, String> m) {
    if (_seeded) return;
    _seeded = true;
    _appName.text = m['app_name'] ?? 'LoanTrack';
    _currency.text = m['currency'] ?? 'INR';
    _currencySymbol.text = m['currency_symbol'] ?? '₹';
    _prefixDaily.text = m['loan_prefix_daily'] ?? 'DL';
    _prefixWeekly.text = m['loan_prefix_weekly'] ?? 'WK';
    _prefixBiweekly.text = m['loan_prefix_biweekly'] ?? 'BW';
    _prefixMonthly.text = m['loan_prefix_monthly'] ?? 'ML';
    _timezone = m['timezone'] ?? 'Asia/Kolkata';
    _midnightCutoff = m['midnight_cutoff'] ?? 'true';
    _allowWeekend = m['allow_weekend_collection'] ?? 'false';
    _kycMethod = m['kyc_method'] ?? 'manual_upload';
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(settingsServiceProvider).save({
        'app_name': _appName.text.trim(),
        'currency': _currency.text.trim(),
        'currency_symbol': _currencySymbol.text.trim(),
        'timezone': _timezone,
        'midnight_cutoff': _midnightCutoff,
        'allow_weekend_collection': _allowWeekend,
        'kyc_method': _kycMethod,
        'loan_prefix_daily': _prefixDaily.text.trim(),
        'loan_prefix_weekly': _prefixWeekly.text.trim(),
        'loan_prefix_biweekly': _prefixBiweekly.text.trim(),
        'loan_prefix_monthly': _prefixMonthly.text.trim(),
      });
      if (mounted) {
        final t = T.of(ref);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t.x('sys.saved'))),
        );
        ref.invalidate(_sysSettingsProvider);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final async = ref.watch(_sysSettingsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('sys.title')),
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
        _SectionCard(
          icon: Icons.info_outline,
          title: t.x('sys.app_name'),
          child: Column(
            children: [
              _LabeledField(
                label: t.x('sys.app_name'),
                child: _TextField(controller: _appName),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _LabeledField(
                      label: t.x('sys.currency'),
                      child: _TextField(controller: _currency),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _LabeledField(
                      label: t.x('sys.currency_symbol'),
                      child: _TextField(controller: _currencySymbol),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          icon: Icons.schedule_outlined,
          title: t.x('sys.timezone'),
          child: Column(
            children: [
              _LabeledField(
                label: t.x('sys.timezone'),
                child: _AppDropdown<String>(
                  value: _timezone,
                  hint: t.x('sys.timezone'),
                  items: const [
                    DropdownMenuItem(
                        value: 'Asia/Kolkata',
                        child: Text('Asia/Kolkata'),),
                    DropdownMenuItem(value: 'UTC', child: Text('UTC')),
                  ],
                  onChanged: (v) => setState(() => _timezone = v ?? _timezone),
                ),
              ),
              const SizedBox(height: 14),
              _LabeledField(
                label: t.x('sys.midnight_cutoff'),
                child: _AppDropdown<String>(
                  value: _midnightCutoff,
                  hint: t.x('sys.midnight_cutoff'),
                  items: [
                    DropdownMenuItem(
                        value: 'true', child: Text(t.x('sys.enabled')),),
                    DropdownMenuItem(
                        value: 'false', child: Text(t.x('sys.disabled')),),
                  ],
                  onChanged: (v) =>
                      setState(() => _midnightCutoff = v ?? _midnightCutoff),
                ),
              ),
              const SizedBox(height: 14),
              _LabeledField(
                label: t.x('sys.allow_weekend'),
                child: _AppDropdown<String>(
                  value: _allowWeekend,
                  hint: t.x('sys.allow_weekend'),
                  items: [
                    DropdownMenuItem(
                        value: 'true', child: Text(t.x('sys.yes')),),
                    DropdownMenuItem(
                        value: 'false', child: Text(t.x('sys.no')),),
                  ],
                  onChanged: (v) =>
                      setState(() => _allowWeekend = v ?? _allowWeekend),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          icon: Icons.verified_user_outlined,
          title: t.x('sys.kyc_method'),
          child: _LabeledField(
            label: t.x('sys.kyc_method'),
            child: _AppDropdown<String>(
              value: _kycMethod,
              hint: t.x('sys.kyc_method'),
              items: [
                DropdownMenuItem(
                    value: 'manual_upload',
                    child: Text(t.x('sys.kyc_manual')),),
                DropdownMenuItem(
                    value: 'aadhaar_otp',
                    child: Text(t.x('sys.kyc_aadhaar')),),
                DropdownMenuItem(
                    value: 'video_kyc',
                    child: Text(t.x('sys.kyc_video')),),
                DropdownMenuItem(
                    value: 'both', child: Text(t.x('sys.kyc_both')),),
              ],
              onChanged: (v) => setState(() => _kycMethod = v ?? _kycMethod),
            ),
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          icon: Icons.label_outline,
          title: t.x('sys.loan_prefixes'),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _LabeledField(
                      label: t.x('sys.prefix_daily'),
                      child: _TextField(
                          controller: _prefixDaily, maxLength: 4,),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _LabeledField(
                      label: t.x('sys.prefix_weekly'),
                      child: _TextField(
                          controller: _prefixWeekly, maxLength: 4,),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _LabeledField(
                      label: t.x('sys.prefix_biweekly'),
                      child: _TextField(
                          controller: _prefixBiweekly, maxLength: 4,),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _LabeledField(
                      label: t.x('sys.prefix_monthly'),
                      child: _TextField(
                          controller: _prefixMonthly, maxLength: 4,),
                    ),
                  ),
                ],
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
              : Text(t.x('btn.save'),
                  style: const TextStyle(color: Colors.white),),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.label),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}

class _TextField extends StatelessWidget {
  const _TextField({required this.controller, this.maxLength});
  final TextEditingController controller;
  final int? maxLength;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      maxLength: maxLength,
      style: AppTypography.body,
      decoration: InputDecoration(
        counterText: '',
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
      ),
    );
  }
}

class _AppDropdown<V> extends StatelessWidget {
  const _AppDropdown({
    required this.value,
    required this.hint,
    required this.items,
    required this.onChanged,
  });
  final V? value;
  final String hint;
  final List<DropdownMenuItem<V>> items;
  final ValueChanged<V?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<V>(
          value: value,
          hint: Text(hint,
              style:
                  AppTypography.body.copyWith(color: AppColors.textLight),),
          isExpanded: true,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          items: items,
          onChanged: onChanged,
          style: AppTypography.body,
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.child,
  });
  final IconData icon;
  final String title;
  final Widget child;

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
              Icon(icon, color: AppColors.primary, size: 18),
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
