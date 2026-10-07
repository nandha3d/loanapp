import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/api_exception.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/settings_service.dart';
import 'package:zolofund/features/settings/two_factor_screen.dart';

/// Two-step login (per user) and the app lock (a tenant-wide policy the account
/// owner sets). The policy, its choices and who may edit it all come from
/// `GET /api/v1/settings/security`; saving also refreshes the signed-in user so
/// the lock takes effect straight away instead of at the next login.
class SecuritySettingsScreen extends ConsumerStatefulWidget {
  const SecuritySettingsScreen({super.key});

  @override
  ConsumerState<SecuritySettingsScreen> createState() =>
      _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState
    extends ConsumerState<SecuritySettingsScreen> {
  bool _loading = true;
  bool _saving = false;
  String _error = '';
  bool _lockOn = false;
  bool _canEdit = false;
  int _timeout = 0;
  List<int> _options = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      _apply(await ref.read(settingsServiceProvider).security());
    } catch (e) {
      _error = e is ApiException ? e.message : e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _apply(Map<String, dynamic> data) {
    _lockOn = data['biometricLockRequired'] == true;
    _canEdit = data['canEdit'] == true;
    _timeout = (data['timeoutMinutes'] as num?)?.toInt() ?? 0;
    _options = [
      for (final o in (data['timeoutOptions'] as List<dynamic>? ?? const []))
        (o as num).toInt(),
    ];
  }

  Future<void> _save({bool? lockOn, int? timeout}) async {
    final t = T.of(ref);
    final messenger = ScaffoldMessenger.of(context);
    if (lockOn == true &&
        !await ref.read(authControllerProvider.notifier).canUseDeviceLock()) {
      // Enabling a lock this phone cannot show would only lock people out.
      messenger.showSnackBar(SnackBar(content: Text(t.x('sec.no_device_lock'))));
      return;
    }
    setState(() => _saving = true);
    try {
      final saved = await ref.read(settingsServiceProvider).saveSecurity(
            biometricLockRequired: lockOn,
            timeoutMinutes: timeout,
          );
      // The signed-in user carries the policy; refresh so it applies now.
      await ref.read(authControllerProvider.notifier).refreshUser();
      if (!mounted) return;
      setState(() => _apply(saved));
      messenger.showSnackBar(SnackBar(content: Text(t.x('sec.saved'))));
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(e is ApiException ? e.message : e.toString()),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _timeoutLabel(T t, int minutes) => minutes == 0
      ? t.x('sec.timeout_zero')
      : t.x('sec.timeout_min').replaceAll('{n}', '$minutes');

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('sec.title')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/settings'),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        _error,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.danger),
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _card(
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(Icons.verified_user_outlined,
                              color: AppColors.primary,),
                          title: Text(t.x('2fa.title'),
                              style: AppTypography.bodyLarge,),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => const TwoFactorScreen(),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _card(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(t.x('sec.lock_title'),
                                style: AppTypography.sectionTitle,),
                            const SizedBox(height: 4),
                            SwitchListTile.adaptive(
                              contentPadding: EdgeInsets.zero,
                              title: Text(t.x('sec.lock_switch')),
                              subtitle: Text(
                                t.x('sec.lock_switch_hint'),
                                style: AppTypography.caption,
                              ),
                              value: _lockOn,
                              onChanged: (!_canEdit || _saving)
                                  ? null
                                  : (v) => _save(lockOn: v),
                            ),
                            if (_lockOn) ...[
                              const Divider(height: 24),
                              Text(t.x('sec.timeout_label'),
                                  style: AppTypography.bodySmall,),
                              const SizedBox(height: 8),
                              DropdownButtonFormField<int>(
                                initialValue: _options.contains(_timeout)
                                    ? _timeout
                                    : null,
                                decoration: InputDecoration(
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(
                                        AppTokens.radiusSm,),
                                  ),
                                ),
                                items: [
                                  for (final o in _options)
                                    DropdownMenuItem(
                                      value: o,
                                      child: Text(_timeoutLabel(t, o)),
                                    ),
                                ],
                                onChanged: (!_canEdit || _saving)
                                    ? null
                                    : (v) {
                                        if (v != null) _save(timeout: v);
                                      },
                              ),
                            ],
                            if (!_canEdit) ...[
                              const SizedBox(height: 10),
                              Text(
                                t.x('sec.owner_only'),
                                style: AppTypography.caption,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: AppTokens.shadow,
          border: Border.all(color: AppColors.border),
        ),
        child: child,
      );
}
