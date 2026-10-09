// ignore_for_file: require_trailing_commas

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:dio/dio.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/a11y/ui_prefs.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/shared/widgets/app_button.dart';
import 'package:zolofund/shared/widgets/app_logo.dart';
import 'package:zolofund/shared/widgets/app_text_field.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _submitting = false;

  // WhatsApp OTP login state
  bool _useWhatsApp = false;
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  bool _otpSent = false;
  String? _challengeToken;
  int _cooldown = 0;
  Timer? _cooldownTimer;
  String? _localError;

  late final AnimationController _fade = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 400),
  )..forward();

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _phone.dispose();
    _otp.dispose();
    _cooldownTimer?.cancel();
    _fade.dispose();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _cooldown = 60);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_cooldown <= 1) {
        timer.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown--);
      }
    });
  }

  Future<void> _sendWhatsAppOtp() async {
    final phone = _phone.text.trim();
    if (phone.length < 10) {
      setState(() => _localError = 'Enter a valid 10-digit mobile number');
      return;
    }
    setState(() {
      _submitting = true;
      _localError = null;
    });
    try {
      final token = await ref
          .read(authControllerProvider.notifier)
          .sendWhatsAppOtp(phone);
      if (mounted) {
        setState(() {
          _challengeToken = token;
          _otpSent = true;
        });
        _startCooldown();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _localError = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitWhatsAppOtp() async {
    final otp = _otp.text.trim();
    if (otp.length != 6) {
      setState(() => _localError = 'Enter the 6-digit WhatsApp OTP');
      return;
    }
    if (_challengeToken == null) {
      setState(() => _localError = 'Session expired. Please request a new OTP.');
      return;
    }
    setState(() {
      _submitting = true;
      _localError = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .loginWithWhatsAppOtp(
            phone: _phone.text.trim(),
            otp: otp,
            challengeToken: _challengeToken!,
          );
    } catch (e) {
      if (mounted) {
        setState(() => _localError = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await ref.read(authControllerProvider.notifier).login(
            _username.text.trim(),
            _password.text,
          );
    } finally {
      // On success the router redirects away; only reset if still mounted
      // (i.e. login failed and the screen is still visible).
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      // serverClientId = the Web OAuth client (client_type 3) from
      // google-services.json. Required on Android so account.authentication
      // returns a non-null idToken for the backend to verify.
      final googleSignIn = GoogleSignIn(
        scopes: const ['email', 'profile'],
        serverClientId:
            '895293019400-o8lov2voov7r173e3eltjm9a0lrqvq8v.apps.googleusercontent.com',
      );
      final account = await googleSignIn.signIn();
      if (account == null) return; // User cancelled

      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Failed to retrieve Google credentials')),
          );
        }
        return;
      }

      final res = await ref
          .read(authControllerProvider.notifier)
          .loginWithGoogle(idToken);
      if (res != null && res.needsRegistration) {
        if (mounted) {
          // Carry the real idToken (not account.id) — the backend re-verifies it
          // to complete Google registration. account.id alone is not a token.
          context.push(
            '/register?googleEmail=${Uri.encodeComponent(res.email ?? '')}&googleName=${Uri.encodeComponent(res.name ?? '')}&googleId=${Uri.encodeComponent(account.id)}&googleIdToken=${Uri.encodeComponent(idToken)}',
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Google Sign-In failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showServerConfigDialog() {
    final activeUrl = ref.read(apiBaseUrlProvider) ?? kDefaultBaseUrl;
    final controller = TextEditingController(text: activeUrl);
    String? testStatus;
    bool isTesting = false;
    Color testStatusColor = AppColors.textSecondary;

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          Future<void> runTest(String testTarget) async {
            final target = testTarget.trim();
            if (target.isEmpty) return;
            setDialogState(() {
              isTesting = true;
              testStatus = 'Testing $target ...';
              testStatusColor = AppColors.textSecondary;
            });
            final sw = Stopwatch()..start();
            try {
              final pingDio = Dio(
                BaseOptions(
                  connectTimeout: const Duration(seconds: 5),
                  receiveTimeout: const Duration(seconds: 5),
                ),
              );
              final endpoint =
                  target.endsWith('/') ? '${target}pricing' : '$target/pricing';
              await pingDio.get<dynamic>(endpoint);
              sw.stop();
              if (ctx.mounted) {
                setDialogState(() {
                  isTesting = false;
                  testStatus = 'Connected (${sw.elapsedMilliseconds}ms)';
                  testStatusColor = const Color(0xFF10B981);
                });
              }
            } catch (e) {
              sw.stop();
              if (ctx.mounted) {
                setDialogState(() {
                  isTesting = false;
                  testStatus =
                      'Unreachable: ${e is DioException ? (e.message ?? e.type.name) : e}';
                  testStatusColor = AppColors.danger;
                });
              }
            }
          }

          void applyPreset(String url) {
            controller.text = url;
            runTest(url);
          }

          return AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Row(
              children: [
                Icon(Icons.dns_outlined, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'Server API URL',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Quick Presets:',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ActionChip(
                        avatar: Icon(
                          Icons.cloud_done,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        label: const Text(
                          'ZoloFunds Live',
                          style: TextStyle(fontSize: 12),
                        ),
                        onPressed: () =>
                            applyPreset('https://app.zolofunds.com/api/v1'),
                      ),
                      ActionChip(
                        avatar: Icon(
                          Icons.shield_outlined,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        label: const Text(
                          'Samurai Live',
                          style: TextStyle(fontSize: 12),
                        ),
                        onPressed: () =>
                            applyPreset('https://loan.samuraibuiness.in/api/v1'),
                      ),
                      ActionChip(
                        avatar: Icon(
                          Icons.phone_android,
                          size: 16,
                          color: AppColors.textSecondary,
                        ),
                        label: const Text(
                          'Emulator (10.0.2.2)',
                          style: TextStyle(fontSize: 12),
                        ),
                        onPressed: () =>
                            applyPreset('http://10.0.2.2:3000/api/v1'),
                      ),
                      ActionChip(
                        avatar: Icon(
                          Icons.computer,
                          size: 16,
                          color: AppColors.textSecondary,
                        ),
                        label: const Text(
                          'Local PC',
                          style: TextStyle(fontSize: 12),
                        ),
                        onPressed: () =>
                            applyPreset('http://localhost:3000/api/v1'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: controller,
                    decoration: InputDecoration(
                      labelText: 'API Base URL',
                      hintText: 'https://...',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: isTesting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Icon(
                                Icons.network_check,
                                color: AppColors.primary,
                              ),
                        tooltip: 'Test Connection',
                        onPressed: isTesting
                            ? null
                            : () => runTest(controller.text),
                      ),
                    ),
                  ),
                  if (testStatus != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      testStatus!,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: testStatusColor,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  ref.read(apiBaseUrlProvider.notifier).set(null);
                  if (mounted) setState(() => _localError = null);
                  Navigator.pop(ctx);
                },
                child: const Text('Reset Default'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
                onPressed: () {
                  final newUrl = controller.text.trim();
                  if (newUrl.isNotEmpty) {
                    ref.read(apiBaseUrlProvider.notifier).set(newUrl);
                  }
                  if (mounted) setState(() => _localError = null);
                  Navigator.pop(ctx);
                },
                child: const Text('Save & Apply'),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    // Only spin if submitting or already authenticated and redirecting.
    final loading = _submitting || auth.stage == AuthStage.authenticated;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            stops: [0.0, 0.5, 1.0],
            colors: [
              Color(0xFF1A1D23),
              Color(0xFF281429),
              Color(0xFF1A1D23),
            ],
          ),
        ),
        child: Stack(
          children: [
            // Top-right purple brand glow
            Positioned(
              top: -120,
              right: -120,
              child: Container(
                width: 320,
                height: 320,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x337D287E), Color(0x007D287E)],
                  ),
                ),
              ),
            ),
            // Bottom-left purple brand glow
            Positioned(
              bottom: -140,
              left: -140,
              child: Container(
                width: 360,
                height: 360,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x267D287E), Color(0x007D287E)],
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Stack(
                children: [
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton(
                      icon: const Icon(Icons.settings_outlined, color: Colors.white70),
                      tooltip: 'Server Configuration',
                      onPressed: _showServerConfigDialog,
                    ),
                  ),
                  Center(
                    child: SingleChildScrollView(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                      child: FadeTransition(
                        opacity: _fade,
                        child: SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0, 0.05),
                            end: Offset.zero,
                          ).animate(
                            CurvedAnimation(
                              parent: _fade,
                              curve: Curves.easeOut,
                            ),
                          ),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 420),
                            child: _LoginCard(
                              username: _username,
                              password: _password,
                              obscure: _obscure,
                              onToggleObscure: () =>
                                  setState(() => _obscure = !_obscure),
                              useWhatsApp: _useWhatsApp,
                              onToggleMode: (val) => setState(() {
                                _useWhatsApp = val;
                                _localError = null;
                              }),
                              phone: _phone,
                              otp: _otp,
                              otpSent: _otpSent,
                              cooldown: _cooldown,
                              onSendOtp: _sendWhatsAppOtp,
                              onSubmitOtp: _submitWhatsAppOtp,
                              onResetOtp: () => setState(() {
                                _otpSent = false;
                                _otp.clear();
                                _challengeToken = null;
                                _localError = null;
                              }),
                              error: _localError ?? auth.error,
                              loading: loading,
                              onSubmit: _submit,
                              onGoogleSignIn: _handleGoogleSignIn,
                              onConfigureServer: _showServerConfigDialog,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoginCard extends ConsumerWidget {
  const _LoginCard({
    required this.username,
    required this.password,
    required this.obscure,
    required this.onToggleObscure,
    required this.useWhatsApp,
    required this.onToggleMode,
    required this.phone,
    required this.otp,
    required this.otpSent,
    required this.cooldown,
    required this.onSendOtp,
    required this.onSubmitOtp,
    required this.onResetOtp,
    required this.error,
    required this.loading,
    required this.onSubmit,
    required this.onGoogleSignIn,
    this.onConfigureServer,
  });

  final TextEditingController username;
  final TextEditingController password;
  final bool obscure;
  final VoidCallback onToggleObscure;
  final bool useWhatsApp;
  final ValueChanged<bool> onToggleMode;
  final TextEditingController phone;
  final TextEditingController otp;
  final bool otpSent;
  final int cooldown;
  final VoidCallback onSendOtp;
  final VoidCallback onSubmitOtp;
  final VoidCallback onResetOtp;
  final String? error;
  final bool loading;
  final Future<void> Function() onSubmit;
  final VoidCallback onGoogleSignIn;
  final VoidCallback? onConfigureServer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final isSamurai = () {
      final url = (ref.watch(apiBaseUrlProvider) ?? kDefaultBaseUrl).toLowerCase();
      return url.contains('samuraibuiness.in') || url.contains('samurai');
    }();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Center(
            child: AppLogo.horizontal(
              height: 52,
            ),
          ),
          const SizedBox(height: 28),
          if (!isSamurai) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 24),
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => onToggleMode(false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: !useWhatsApp ? AppColors.surface : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: !useWhatsApp ? AppTokens.shadow : null,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          t.x('login.password'),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: !useWhatsApp ? AppColors.textPrimary : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => onToggleMode(true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: useWhatsApp ? const Color(0xFF25D366) : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: useWhatsApp ? AppTokens.shadow : null,
                        ),
                        alignment: Alignment.center,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.chat,
                              size: 14,
                              color: useWhatsApp ? Colors.white : AppColors.textSecondary,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  t.x('login.whatsapp_otp'),
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: useWhatsApp ? Colors.white : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (error != null) ...[
            _ErrorBanner(
              message: error!,
              serverUrl: ref.watch(apiBaseUrlProvider) ?? kDefaultBaseUrl,
              onConfigureServer: onConfigureServer,
              onRetry: onSubmit,
            ),
            const SizedBox(height: 16),
          ],
          if (!useWhatsApp || isSamurai) ...[
            AppTextField(
              label: t.x('login.username'),
              controller: username,
              prefixIcon: Icons.person_outline,
              autofillHints: const [AutofillHints.username],
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: t.x('login.password'),
              controller: password,
              obscureText: obscure,
              prefixIcon: Icons.lock_outline,
              autofillHints: const [AutofillHints.password],
              suffixIcon: IconButton(
                icon: Icon(
                  obscure
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 18,
                  color: AppColors.textSecondary,
                ),
                onPressed: onToggleObscure,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 48,
              child: AppButton(
                label: t.x('login.sign_in'),
                expand: true,
                loading: loading,
                onPressed: onSubmit,
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: TextButton(
                onPressed: () => context.push('/forgot-password'),
                child: Text(
                  t.x('login.forgot'),
                  style:
                      AppTypography.body.copyWith(color: AppColors.primaryDark),
                ),
              ),
            ),
          ] else ...[
            AppTextField(
              label: 'Mobile Number',
              controller: phone,
              prefixIcon: Icons.phone_android,
              autofillHints: const [AutofillHints.telephoneNumber],
              keyboardType: TextInputType.phone,
              enabled: !otpSent,
            ),
            const SizedBox(height: 16),
            if (!otpSent) ...[
              SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.chat, color: Colors.white, size: 20),
                  label: Text(
                    loading ? 'Sending OTP…' : 'Send WhatsApp OTP',
                    style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: loading ? null : onSendOtp,
                ),
              ),
            ] else ...[
              AppTextField(
                label: '6-digit WhatsApp OTP',
                controller: otp,
                prefixIcon: Icons.lock_clock_outlined,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 20),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: loading ? null : onSubmitOtp,
                  child: Text(
                    loading ? 'Verifying…' : 'Verify & Sign In',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(
                    onPressed: loading ? null : onResetOtp,
                    child: const Text('Change number', style: TextStyle(fontSize: 12)),
                  ),
                  TextButton(
                    onPressed: (cooldown > 0 || loading) ? null : onSendOtp,
                    child: Text(
                      cooldown > 0 ? 'Resend in ${cooldown}s' : 'Resend WhatsApp OTP',
                      style: TextStyle(
                        fontSize: 12,
                        color: cooldown > 0 ? AppColors.textSecondary : AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
          const SizedBox(height: 12),
          if (kIsWeb || defaultTargetPlatform != TargetPlatform.windows) ...[
            Row(
              children: [
                Expanded(child: Divider(color: AppColors.border)),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text('OR',
                      style: TextStyle(
                          color: AppColors.textSecondary, fontSize: 12)),
                ),
                Expanded(child: Divider(color: AppColors.border)),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: OutlinedButton.icon(
                icon: Icon(Icons.g_mobiledata,
                    color: AppColors.textPrimary, size: 28),
                label: Text('Continue with Google',
                    style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600)),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: onGoogleSignIn,
              ),
            ),
            const SizedBox(height: 24),
          ],
          Center(
            child: Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'New to ZoloFund? ',
                  style:
                      TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
                GestureDetector(
                  onTap: () => context.push('/register'),
                  child: Text(
                    'Register Business',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: GestureDetector(
              onTap: () => context.push('/borrower/login'),
              child: Text(
                'Are you a Borrower? Access Borrower Portal',
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({
    required this.message,
    this.serverUrl,
    this.onConfigureServer,
    this.onRetry,
  });

  final String message;
  final String? serverUrl;
  final VoidCallback? onConfigureServer;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final lower = message.toLowerCase();
    final isConnectionErr = lower.contains('connection') ||
        lower.contains('server') ||
        lower.contains('reach the server');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.dangerBg,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 2),
                child: Icon(
                  Icons.warning_amber_rounded,
                  size: 18,
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      message,
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.dangerText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (isConnectionErr && serverUrl != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Target: $serverUrl',
                        style: TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (isConnectionErr && onConfigureServer != null) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (onRetry != null) ...[
                  TextButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh, size: 14),
                    label: const Text('Retry', style: TextStyle(fontSize: 12)),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.dangerText,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                ElevatedButton.icon(
                  onPressed: onConfigureServer,
                  icon: const Icon(Icons.tune, size: 14),
                  label: const Text(
                    'Change Server / Test',
                    style: TextStyle(fontSize: 12),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
