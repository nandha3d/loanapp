import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/auth/auth_storage.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/services/auth_service.dart';

class AuthRepository {
  AuthRepository(this._service, this._storage);

  final AuthService _service;
  final AuthStorage _storage;

  /// Returns `null` if 2FA required. Caller then routes to TOTP screen.
  Future<User?> login({
    required String username,
    required String password,
  }) async {
    final result = await _service.login(username: username, password: password);
    if (result.requiresTotp) {
      await _storage.savePendingTotpUser(username);
      return null;
    }
    await _persist(result.token!, result.user!, refreshToken: result.refreshToken);
    return result.user;
  }

  Future<User> verify2fa(String code) async {
    final username = await _storage.readPendingTotpUser();
    if (username == null) {
      throw StateError('No pending TOTP user');
    }
    final result = await _service.verify2fa(username: username, code: code);
    await _persist(result.token!, result.user!, refreshToken: result.refreshToken);
    await _storage.clearPendingTotpUser();
    return result.user!;
  }

  Future<User?> currentUser() async {
    final token = await _storage.readToken();
    if (token == null) return null;
    try {
      return await _service.me();
    } on Object {
      return null;
    }
  }

  Future<void> logout() async {
    try {
      await _service.logout();
    } on Object {
      // ignore — clear local state regardless
    }
    await _storage.clear();
  }

  Future<User> registerWithEmail({
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
    final result = await _service.registerWithEmail(
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
    await _persist(result.token!, result.user!);
    return result.user!;
  }

  Future<GoogleAuthResult> authenticateWithGoogle({
    required String idToken,
    String? businessName,
    String? ownerPhone,
    String? selectedPlan,
    List<String>? selectedModules,
    List<String>? selectedAddons,
    String? referralCode,
  }) async {
    final result = await _service.authenticateWithGoogle(
      idToken: idToken,
      businessName: businessName,
      ownerPhone: ownerPhone,
      selectedPlan: selectedPlan,
      selectedModules: selectedModules,
      selectedAddons: selectedAddons,
      referralCode: referralCode,
    );
    if (!result.needsRegistration && result.token != null && result.user != null) {
      await _persist(result.token!, result.user!);
    }
    return result;
  }

  Future<void> _persist(String token, User user, {String? refreshToken}) async {
    await _storage.saveSession(
      token: token,
      tenantSlug: user.tenantSlug ?? '',
      branchId: user.branchId,
      refreshToken: refreshToken,
    );
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(authServiceProvider),
    ref.watch(authStorageProvider),
  );
});
