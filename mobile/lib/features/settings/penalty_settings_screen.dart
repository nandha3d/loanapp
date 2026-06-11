import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/settings_service.dart';

final _penaltySettingsProvider =
    FutureProvider.autoDispose<Map<String, String>>((ref) async {
  final rows = await ref.read(settingsServiceProvider).all();
  return {
    for (final r in rows)
      if (r['key'] is String) r['key'] as String: (r['value'] ?? '').toString(),
  };
});

class PenaltySettingsScreen extends ConsumerStatefulWidget {
  const PenaltySettingsScreen({super.key});

  @override
  ConsumerState<PenaltySettingsScreen> createState() =>
      _PenaltySettingsScreenState();
}

class _PenaltySettingsScreenState
    extends ConsumerState<PenaltySettingsScreen> {
  final _perDay = TextEditingController();
  final _gracePeriod = TextEditingController();
  final _maxCap = TextEditingController();

  bool _seeded = false;
  bool _saving = false;

  @override
  void dispose() {
    _perDay.dispose();
    _gracePeriod.dispose();
    _maxCap.dispose();
    super.dispose();
  }

  void _seed(Map<String, String> m) {
    if (_seeded) return;
    _seeded = true;
    _perDay.text = m['default_penalty_per_day'] ?? '50';
    _gracePeriod.text = m['penalty_grace_period'] ?? '0';
    _maxCap.text = m['penalty_max_cap'] ?? '0';
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(settingsServiceProvider).save({
        'default_penalty_per_day': _perDay.text.trim(),
        'penalty_grace_period': _gracePeriod.text.trim(),
        'penalty_max_cap': _maxCap.text.trim(),
      });
      if (mounted) {
        final t = T.of(ref);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(t.x('set.penalty_saved')),
            backgroundColor: AppColors.success,
          ),
        );
        ref.invalidate(_penaltySettingsProvider);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final async = ref.watch(_penaltySettingsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('set.penalty')),
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
                  Icon(Icons.bolt_outlined, color: AppColors.primary, size: 18),
                  const SizedBox(width: 8),
                  Text(t.x('set.penalty'), style: AppTypography.sectionTitle),
                ],
              ),
              const SizedBox(height: 14),
              _LabeledField(
                label: t.x('set.penalty_per_day'),
                child: _NumField(controller: _perDay),
              ),
              const SizedBox(height: 14),
              _LabeledField(
                label: t.x('set.grace_period'),
                child: _NumField(controller: _gracePeriod),
              ),
              const SizedBox(height: 14),
              _LabeledField(
                label: t.x('set.max_cap'),
                child: _NumField(controller: _maxCap),
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

class _NumField extends StatelessWidget {
  const _NumField({required this.controller});
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
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
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
    );
  }
}
