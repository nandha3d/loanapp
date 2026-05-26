import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class TotpScreen extends ConsumerStatefulWidget {
  const TotpScreen({super.key});

  @override
  ConsumerState<TotpScreen> createState() => _TotpScreenState();
}

class _TotpScreenState extends ConsumerState<TotpScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_controller.text.length != 6) return;
    await ref.read(authControllerProvider.notifier).verifyTotp(_controller.text);
  }

  @override
  Widget build(BuildContext context) {
    final error = ref.watch(authControllerProvider).error;
    final t = T.of(ref);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () =>
                    ref.read(authControllerProvider.notifier).logout(),
              ),
              const SizedBox(height: 24),
              Text(t.x('title.2fa'), style: AppTypography.display),
              const SizedBox(height: 8),
              Text(
                t.x('tfa.enter_code'),
                style:
                    AppTypography.body.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                textAlign: TextAlign.center,
                style: AppTypography.display.copyWith(letterSpacing: 12),
                decoration: const InputDecoration(hintText: '000000'),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(
                  error,
                  style:
                      AppTypography.caption.copyWith(color: AppColors.danger),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                height: 48,
                child: AppButton(
                  label: t.x('tfa.verify'),
                  expand: true,
                  onPressed: _submit,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
