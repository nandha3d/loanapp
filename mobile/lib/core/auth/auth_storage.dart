import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure storage wrapper — JWT lives ONLY here (spec §9.3 rule 1).
class AuthStorage {
  AuthStorage(this._storage);

  static const _kToken = 'jwt_token';
  static const _kTenantSlug = 'tenant_slug';
  static const _kBranchId = 'branch_id';
  static const _kPendingTotpUser = 'pending_totp_user';

  final FlutterSecureStorage _storage;

  Future<void> saveSession({
    required String token,
    required String tenantSlug,
    String? branchId,
  }) async {
    await _storage.write(key: _kToken, value: token);
    await _storage.write(key: _kTenantSlug, value: tenantSlug);
    if (branchId != null) {
      await _storage.write(key: _kBranchId, value: branchId);
    }
  }

  Future<String?> readToken() => _storage.read(key: _kToken);
  Future<String?> readTenantSlug() => _storage.read(key: _kTenantSlug);
  Future<String?> readBranchId() => _storage.read(key: _kBranchId);

  Future<void> savePendingTotpUser(String username) =>
      _storage.write(key: _kPendingTotpUser, value: username);
  Future<String?> readPendingTotpUser() => _storage.read(key: _kPendingTotpUser);
  Future<void> clearPendingTotpUser() => _storage.delete(key: _kPendingTotpUser);

  Future<void> clear() async {
    await _storage.deleteAll();
  }
}

final authStorageProvider = Provider<AuthStorage>((ref) {
  return AuthStorage(
    const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    ),
  );
});
