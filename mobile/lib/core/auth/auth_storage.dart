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
  static const _kUserJson = 'user_json';

  final FlutterSecureStorage _storage;

  /// Same secure-storage options as [authStorageProvider], for code that runs
  /// outside Riverpod (the background notification isolate).
  factory AuthStorage.standalone() => AuthStorage(
        const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
            resetOnError: true,
          ),
          iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
        ),
      );

  // In-memory cache to avoid repeated asynchronous Android KeyStore / Keystore IPC on every request
  static String? _memToken;
  static String? _memRefreshToken;
  static String? _memTenantSlug;
  static String? _memBranchId;
  static String? _memAppType;

  Future<void> saveSession({
    required String token,
    required String tenantSlug,
    required String appType,
    String? branchId,
    String? refreshToken,
  }) async {
    _memToken = token;
    _memTenantSlug = tenantSlug;
    _memAppType = appType;
    _memBranchId = branchId;
    _memRefreshToken = refreshToken;

    await Future.wait([
      _storage.write(key: _kToken, value: token),
      _storage.write(key: _kTenantSlug, value: tenantSlug),
      _storage.write(key: _kAppType, value: appType),
      if (branchId != null) _storage.write(key: _kBranchId, value: branchId),
      if (refreshToken != null) _storage.write(key: _kRefreshToken, value: refreshToken),
    ]);
  }

  Future<void> updateTokens({
    required String token,
    required String refreshToken,
  }) async {
    _memToken = token;
    _memRefreshToken = refreshToken;
    await Future.wait([
      _storage.write(key: _kToken, value: token),
      _storage.write(key: _kRefreshToken, value: refreshToken),
    ]);
  }

  Future<String?> readToken() async {
    if (_memToken != null) return _memToken;
    final val = await _storage.read(key: _kToken);
    if (val != null) _memToken = val;
    return val;
  }

  Future<String?> readRefreshToken() async {
    if (_memRefreshToken != null) return _memRefreshToken;
    final val = await _storage.read(key: _kRefreshToken);
    if (val != null) _memRefreshToken = val;
    return val;
  }

  Future<String?> readTenantSlug() async {
    if (_memTenantSlug != null) return _memTenantSlug;
    final val = await _storage.read(key: _kTenantSlug);
    if (val != null) _memTenantSlug = val;
    return val;
  }

  Future<String?> readBranchId() async {
    if (_memBranchId != null) return _memBranchId;
    final val = await _storage.read(key: _kBranchId);
    if (val != null) _memBranchId = val;
    return val;
  }

  Future<String?> readAppType() async {
    if (_memAppType != null) return _memAppType;
    final val = await _storage.read(key: _kAppType);
    if (val != null) _memAppType = val;
    return val;
  }

  Future<void> saveActiveAppType(String appType) async {
    _memAppType = appType;
    await _storage.write(key: _kAppType, value: appType);
  }

  /// Superadmin branch switcher: sent as `X-Branch-Id` (`all` = All Branches).
  Future<void> saveActiveBranchId(String branchId) async {
    _memBranchId = branchId;
    await _storage.write(key: _kBranchId, value: branchId);
  }

  /// Cached profile of the signed-in user (JSON) — lets the app boot to the
  /// dashboard offline / on a slow network instead of bouncing to login while
  /// a valid token + refresh token still exist.
  Future<void> saveUserJson(String json) =>
      _storage.write(key: _kUserJson, value: json);
  Future<String?> readUserJson() => _storage.read(key: _kUserJson);

  Future<void> savePendingTotpUser(String username) =>
      _storage.write(key: _kPendingTotpUser, value: username);
  Future<String?> readPendingTotpUser() =>
      _storage.read(key: _kPendingTotpUser);
  Future<void> clearPendingTotpUser() =>
      _storage.delete(key: _kPendingTotpUser);

  Future<void> clear() async {
    _memToken = null;
    _memRefreshToken = null;
    _memTenantSlug = null;
    _memBranchId = null;
    _memAppType = null;
    await _storage.deleteAll();
  }
}

final authStorageProvider = Provider<AuthStorage>((ref) {
  return AuthStorage(
    const FlutterSecureStorage(
      // resetOnError: after a reinstall, Android may restore the encrypted
      // prefs file via auto-backup while the Keystore key is gone, so reads
      // throw and the FIRST login silently fails until the user clears app
      // data. resetOnError wipes the corrupt store and retries automatically.
      aOptions: AndroidOptions(
        encryptedSharedPreferences: true,
        resetOnError: true,
      ),
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    ),
  );
});
