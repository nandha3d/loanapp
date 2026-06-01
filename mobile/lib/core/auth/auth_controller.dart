import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/repositories/auth_repository.dart';
import 'package:loantrack/data/services/auth_service.dart';
import 'package:loantrack/data/services/fcm_service.dart';

enum AuthStage { unknown, unauthenticated, pendingTotp, locked, authenticated }

class AuthState {
  const AuthState({required this.stage, this.user, this.error});

  final AuthStage stage;
  final User? user;
  final String? error;

  AuthState copyWith({
    AuthStage? stage,
    User? user,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      stage: stage ?? this.stage,
      user: user ?? this.user,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repo, this._fcm, Stream<void> unauthorizedStream)
      : super(const AuthState(stage: AuthStage.unknown)) {
    _unauthorizedSub = unauthorizedStream.listen((_) => logout());
    _bootstrap();
  }

  final AuthRepository _repo;
  final FcmService _fcm;
  final LocalAuthentication _localAuth = LocalAuthentication();
  late final StreamSubscription<void> _unauthorizedSub;

  Future<void> _bootstrap() async {
    final user = await _repo.currentUser();
    if (user == null) {
      state = const AuthState(stage: AuthStage.unauthenticated);
    } else {
      state = AuthState(stage: AuthStage.authenticated, user: user);
      _fcm.startTokenSync();
    }
  }

  Future<void> login(String username, String password) async {
    state = state.copyWith(clearError: true);
    try {
      final user = await _repo.login(username: username, password: password);
      if (user == null) {
        state = state.copyWith(stage: AuthStage.pendingTotp);
      } else {
        state = AuthState(stage: AuthStage.authenticated, user: user);
        _fcm.startTokenSync();
      }
    } on Object catch (e) {
      state = state.copyWith(error: _readable(e));
    }
  }

  Future<void> verifyTotp(String code) async {
    state = state.copyWith(clearError: true);
    try {
      final user = await _repo.verify2fa(code);
      state = AuthState(stage: AuthStage.authenticated, user: user);
      _fcm.startTokenSync();
    } on Object catch (e) {
      state = state.copyWith(error: _readable(e));
    }
  }

  Future<GoogleAuthResult?> loginWithGoogle(String idToken) async {
    state = state.copyWith(clearError: true);
    try {
      final res = await _repo.authenticateWithGoogle(idToken: idToken);
      if (!res.needsRegistration && res.user != null) {
        state = AuthState(stage: AuthStage.authenticated, user: res.user);
        _fcm.startTokenSync();
      }
      return res;
    } on Object catch (e) {
      state = state.copyWith(error: _readable(e));
      return null;
    }
  }

  Future<void> registerWithGoogle({
    required String idToken,
    required String businessName,
    required String ownerPhone,
    required String selectedPlan,
    required List<String> selectedModules,
    required List<String> selectedAddons,
    String? referralCode,
  }) async {
    state = state.copyWith(clearError: true);
    try {
      final res = await _repo.authenticateWithGoogle(
        idToken: idToken,
        businessName: businessName,
        ownerPhone: ownerPhone,
        selectedPlan: selectedPlan,
        selectedModules: selectedModules,
        selectedAddons: selectedAddons,
        referralCode: referralCode,
      );
      if (res.user != null) {
        state = AuthState(stage: AuthStage.authenticated, user: res.user);
        _fcm.startTokenSync();
      } else {
        throw Exception('Failed to register Google account');
      }
    } on Object catch (e) {
      state = state.copyWith(error: _readable(e));
    }
  }

  Future<void> registerWithEmail({
    required String businessName,
    required String ownerName,
    required String ownerPhone,
    required String ownerUsername,
    required String ownerPassword,
    required String selectedPlan,
    required List<String> selectedModules,
    required List<String> selectedAddons,
    String? referralCode,
  }) async {
    state = state.copyWith(clearError: true);
    try {
      final user = await _repo.registerWithEmail(
        businessName: businessName,
        ownerName: ownerName,
        ownerPhone: ownerPhone,
        ownerUsername: ownerUsername,
        ownerPassword: ownerPassword,
        selectedPlan: selectedPlan,
        selectedModules: selectedModules,
        selectedAddons: selectedAddons,
        referralCode: referralCode,
      );
      state = AuthState(stage: AuthStage.authenticated, user: user);
      _fcm.startTokenSync();
    } on Object catch (e) {
      state = state.copyWith(error: _readable(e));
    }
  }

  Future<void> lock() async {
    if (state.stage == AuthStage.authenticated) {
      state = state.copyWith(stage: AuthStage.locked);
    }
  }

  Future<bool> unlockWithBiometrics() async {
    try {
      final available = await _localAuth.canCheckBiometrics;
      if (!available) {
        state = state.copyWith(stage: AuthStage.authenticated);
        return true;
      }
      final ok = await _localAuth.authenticate(
        localizedReason: 'Unlock LoanTrack',
        options: const AuthenticationOptions(stickyAuth: true),
      );
      if (ok) {
        state = state.copyWith(stage: AuthStage.authenticated);
      }
      return ok;
    } on Object catch (e) {
      state = state.copyWith(error: _readable(e));
      return false;
    }
  }

  Future<void> logout() async {
    await _fcm.dispose();
    await _repo.logout();
    state = const AuthState(stage: AuthStage.unauthenticated);
  }

  @override
  void dispose() {
    _unauthorizedSub.cancel();
    super.dispose();
  }

  String _readable(Object e) {
    final s = e.toString();
    return s.startsWith('Exception: ') ? s.substring(11) : s;
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(
    ref.watch(authRepositoryProvider),
    ref.watch(fcmServiceProvider),
    ref.watch(unauthorizedStreamProvider),
  );
});
