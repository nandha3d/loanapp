import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/auth_service.dart';
import 'package:loantrack/shared/widgets/app_text_field.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _loading = false;
  bool _otpSent = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _otpCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Enter your email address');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authServiceProvider).forgotPassword(email);
      setState(() { _otpSent = true; _loading = false; });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _resetPassword() async {
    final email = _emailCtrl.text.trim();
    final otp = _otpCtrl.text.trim();
    final password = _passwordCtrl.text;
    final confirm = _confirmCtrl.text;

    if (otp.length != 6) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }
    if (password.length < 8) {
      setState(() => _error = 'Password must be at least 8 characters');
      return;
    }
    if (password != confirm) {
      setState(() => _error = 'Passwords do not match');
      return;
    }

    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authServiceProvider).resetPassword(
        email: email,
        otp: otp,
        newPassword: password,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password reset successfully')),
        );
        context.pop();
      }
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('login.forgot')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              Text(
                _otpSent
                    ? 'Enter the code sent to ${_emailCtrl.text}'
                    : 'Enter your email to receive a reset code.',
                style: AppTypography.body.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              AppTextField(
                label: 'Email',
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
              ),
              if (_otpSent) ...[
                const SizedBox(height: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('6-digit code', style: AppTypography.label),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _otpCtrl,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      style: AppTypography.body,
                      decoration: const InputDecoration(counterText: ''),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: 'New Password',
                  controller: _passwordCtrl,
                  obscureText: true,
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: 'Confirm Password',
                  controller: _confirmCtrl,
                  obscureText: true,
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  _error!,
                  style: AppTypography.body.copyWith(color: AppColors.danger),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : (_otpSent ? _resetPassword : _sendOtp),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                ),
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        _otpSent ? 'Reset Password' : 'Send Code',
                        style: const TextStyle(color: Colors.white),
                      ),
              ),
              if (_otpSent) ...[
                const SizedBox(height: 12),
                TextButton(
                  onPressed: _loading ? null : () => setState(() { _otpSent = false; _error = null; }),
                  child: Text(
                    'Resend code',
                    style: AppTypography.body.copyWith(color: AppColors.primaryDark),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
