import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class BiometricLockScreen extends ConsumerStatefulWidget {
  const BiometricLockScreen({super.key});

  @override
  ConsumerState<BiometricLockScreen> createState() =>
      _BiometricLockScreenState();
}

class _BiometricLockScreenState extends ConsumerState<BiometricLockScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryUnlock());
  }

  Future<void> _tryUnlock() async {
    await ref.read(authControllerProvider.notifier).unlockWithBiometrics();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.sidebarBg,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline,
                  size: 56, color: AppColors.primary),
              const SizedBox(height: 16),
              Text(
                'LoanTrack is locked',
                style: AppTypography.sectionTitle.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 8),
              Text(
                'Authenticate to continue',
                style: AppTypography.body.copyWith(color: Colors.white70),
              ),
              const SizedBox(height: 32),
              AppButton(label: 'Unlock', onPressed: _tryUnlock),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () =>
                    ref.read(authControllerProvider.notifier).logout(),
                child: const Text(
                  'Sign out instead',
                  style: TextStyle(color: Colors.white70),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
