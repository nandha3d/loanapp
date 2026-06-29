import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import 'package:loantrack/core/auth/auth_storage.dart';
import 'package:loantrack/core/network/api_exception.dart';

/// Base URL — override via --dart-define=API_BASE_URL=...
/// Android emulator uses 10.0.2.2 to reach host localhost; all other platforms use localhost directly.
String get kDefaultBaseUrl {
  const envUrl = String.fromEnvironment('API_BASE_URL');
  if (envUrl.isNotEmpty) return envUrl;
  final host = (!kIsWeb && Platform.isAndroid) ? '10.0.2.2' : 'localhost';
  return 'http://$host:3000/api/v1';
}

/// Global 401 broadcast — UI listens to force logout (spec §9.3 rule 6).
final unauthorizedStreamProvider = Provider<Stream<void>>((ref) {
  return ref.watch(_unauthorizedControllerProvider).stream;
});

final _unauthorizedControllerProvider = Provider((ref) {
  final ctrl = StreamController<void>.broadcast();
  ref.onDispose(ctrl.close);
  return ctrl;
});

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._storage, this._dio, this._on401);

  final AuthStorage _storage;
  final Dio _dio;
  final void Function() _on401;
  bool _refreshing = false;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.readToken();
    final tenantSlug = await _storage.readTenantSlug();
    final branchId = await _storage.readBranchId();
    final appType = await _storage.readAppType();
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    if (tenantSlug != null) options.headers['X-Tenant-Slug'] = tenantSlug;
    if (branchId != null) options.headers['X-Branch-Id'] = branchId;
    if (appType != null) options.headers['X-App-Type'] = appType;
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401 && !_refreshing) {
      final refreshToken = await _storage.readRefreshToken();
      if (refreshToken != null) {
        _refreshing = true;
        try {
          final res = await _dio.post<Map<String, dynamic>>(
            '/auth/refresh',
            data: {'refreshToken': refreshToken},
            options: Options(headers: {'Authorization': ''}),
          );
          final body = res.data;
          final newToken = body?['data']?['token'] as String?;
          final newRefresh = body?['data']?['refreshToken'] as String?;
          if (newToken != null && newRefresh != null) {
            await _storage.updateTokens(
                token: newToken, refreshToken: newRefresh);
            // Retry original request with new token
            final opts = err.requestOptions;
            opts.headers['Authorization'] = 'Bearer $newToken';
            final retried = await _dio.fetch<dynamic>(opts);
            handler.resolve(retried);
            return;
          }
        } catch (_) {
          // Refresh failed — fall through to logout
        } finally {
          _refreshing = false;
        }
      }
      _on401();
    }
    handler.next(err);
  }
}

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(authStorageProvider);
  final ctrl = ref.watch(_unauthorizedControllerProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: kDefaultBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 15),
      headers: {'Accept': 'application/json'},
      validateStatus: (s) => s != null && s < 500 && s != 401,
    ),
  );

  dio.interceptors.add(
    _AuthInterceptor(storage, dio, () {
      if (!ctrl.isClosed) ctrl.add(null);
    }),
  );

  if (kDebugMode) {
    dio.interceptors.add(
      PrettyDioLogger(
        requestHeader: true,
        requestBody: true,
        responseBody: false,
        compact: true,
      ),
    );
  }

  return dio;
});

/// Helper: unwrap `{data, error, pagination}` envelope.
T unwrapEnvelope<T>(Response<dynamic> res, T Function(dynamic) parse) {
  final body = res.data;
  if (body is! Map<String, dynamic>) {
    throw ApiException('Malformed response', statusCode: res.statusCode);
  }
  final err = body['error'];
  if (err != null) {
    throw ApiException(
      err is String ? err : err.toString(),
      statusCode: res.statusCode,
      code: body['code']?.toString() ?? (err is String ? err : null),
      data: body['data'],
    );
  }
  return parse(body['data']);
}
