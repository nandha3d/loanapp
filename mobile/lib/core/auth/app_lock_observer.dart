import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/features/auth/biometric_lock_screen.dart';

/// True while a signed-in session is covered by the unlock screen.
///
/// A mid-session lock is an overlay, not a route change, so whatever the user
/// was doing (a half-filled form, a scroll position) is still there after they
/// unlock. A *cold start* with the lock on still goes through the `/lock` route.
final appLockedProvider = StateProvider<bool>((ref) => false);

/// Locks the signed-in session — when the tenant has turned the lock on
/// (Settings → Security) — after the app has been in the background, or idle in
/// the foreground, for the tenant's chosen number of minutes.
class AppLockObserver extends ConsumerStatefulWidget {
  const AppLockObserver({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AppLockObserver> createState() => _AppLockObserverState();
}

class _AppLockObserverState extends ConsumerState<AppLockObserver>
    with WidgetsBindingObserver {
  static const _idleCheckEvery = Duration(seconds: 20);

  DateTime? _leftAt;
  DateTime _lastActivity = DateTime.now();
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ticker = Timer.periodic(_idleCheckEvery, (_) => _checkIdle());
  }

  @override
  void dispose() {
    _ticker?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  bool get _lockActive {
    final auth = ref.read(authControllerProvider);
    return auth.stage == AuthStage.authenticated &&
        (auth.user?.biometricLockRequired ?? false) &&
        !ref.read(appLockedProvider);
  }

  Duration get _timeout => Duration(
        minutes: ref.read(authControllerProvider).user?.appLockTimeoutMinutes ?? 0,
      );

  Future<void> _lock() async {
    if (!_lockActive) return;
    // A phone with no screen lock at all cannot show the prompt — never trap
    // the user behind a lock they cannot open.
    if (!await ref.read(authControllerProvider.notifier).canUseDeviceLock()) {
      return;
    }
    if (mounted && _lockActive) {
      ref.read(appLockedProvider.notifier).state = true;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      if (_lockActive) _leftAt = DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      final left = _leftAt;
      _leftAt = null;
      _lastActivity = DateTime.now();
      if (left != null && DateTime.now().difference(left) >= _timeout) {
        _lock();
      }
    }
  }

  void _checkIdle() {
    final timeout = _timeout;
    // 0 minutes means "lock when the app is left" only; there is no idle timer.
    if (timeout == Duration.zero || !_lockActive) return;
    if (DateTime.now().difference(_lastActivity) >= timeout) _lock();
  }

  /// While the lock is showing, the system back button must not reach the
  /// screens underneath.
  @override
  Future<bool> didPopRoute() async => ref.read(appLockedProvider);

  @override
  Widget build(BuildContext context) {
    // Sign-out (or anything that ends the session) clears a stale lock.
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      if (next.stage != AuthStage.authenticated &&
          ref.read(appLockedProvider)) {
        ref.read(appLockedProvider.notifier).state = false;
      }
    });
    final locked = ref.watch(appLockedProvider);
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _lastActivity = DateTime.now(),
      child: Stack(
        children: [
          widget.child,
          if (locked)
            Positioned.fill(
              child: BiometricLockScreen(
                onUnlocked: () {
                  _lastActivity = DateTime.now();
                  ref.read(appLockedProvider.notifier).state = false;
                },
              ),
            ),
        ],
      ),
    );
  }
}
