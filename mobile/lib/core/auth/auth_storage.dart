import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure storage wrapper — JWT lives ONLY here (spec §9.3 rule 1).
class AuthStorage {
  AuthStorage(this._storage);

  static const _kToken = 'jwt_token';
  static const _kRefreshToken = 'refresh_token';
  static const _kTenantSlug = 'tenant_slug';
  static const _kBranchId = 'branch_id';
  static const _kAppType = 'app_type';
  static const _kPendingTotpUser = 'pending_totp_user';

  final FlutterSecureStorage _storage;

  Future<void> saveSession({
    required String token,
    required String tenantSlug,
    required String appType,
    String? branchId,
    String? refreshToken,
  }) async {
    await _storage.write(key: _kToken, value: token);
    await _storage.write(key: _kTenantSlug, value: tenantSlug);
    await _storage.write(key: _kAppType, value: appType);
    if (branchId != null) {
      await _storage.write(key: _kBranchId, value: branchId);
    }
    if (refreshToken != null) {
      await _storage.write(key: _kRefreshToken, value: refreshToken);
    }
  }

  Future<void> updateTokens({
    required String token,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _kToken, value: token),
      _storage.write(key: _kRefreshToken, value: refreshToken),
    ]);
  }

  Future<String?> readToken() => _storage.read(key: _kToken);
  Future<String?> readRefreshToken() => _storage.read(key: _kRefreshToken);
  Future<String?> readTenantSlug() => _storage.read(key: _kTenantSlug);
  Future<String?> readBranchId() => _storage.read(key: _kBranchId);
  Future<String?> readAppType() => _storage.read(key: _kAppType);

  Future<void> saveActiveAppType(String appType) =>
      _storage.write(key: _kAppType, value: appType);

  Future<void> savePendingTotpUser(String username) =>
      _storage.write(key: _kPendingTotpUser, value: username);
  Future<String?> readPendingTotpUser() =>
      _storage.read(key: _kPendingTotpUser);
  Future<void> clearPendingTotpUser() =>
      _storage.delete(key: _kPendingTotpUser);

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
