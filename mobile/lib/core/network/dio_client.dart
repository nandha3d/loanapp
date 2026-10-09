import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import 'package:zolofund/core/auth/auth_storage.dart';
import 'package:zolofund/core/a11y/ui_prefs.dart';
import 'package:zolofund/core/network/api_exception.dart';

/// Base URL — override via --dart-define=API_BASE_URL=...
/// Release builds default to production; debug builds use local development.
const kProductionApiBaseUrl = 'https://app.zolofunds.com/api/v1';

String resolveApiBaseUrl({
  required String configuredUrl,
  required bool isRelease,
  required bool isWeb,
  required bool isAndroid,
}) {
  final override = configuredUrl.trim();
  if (override.isNotEmpty) return override;
  if (isRelease) return kProductionApiBaseUrl;
  final host = !isWeb && isAndroid ? '10.0.2.2' : 'localhost';
  return 'http://$host:3000/api/v1';
}

String get kDefaultBaseUrl {
  const envUrl = String.fromEnvironment('API_BASE_URL');
  return resolveApiBaseUrl(
    configuredUrl: envUrl,
    isRelease: kReleaseMode,
    isWeb: kIsWeb,
    isAndroid: !kIsWeb && Platform.isAndroid,
  );
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

  /// Guards concurrent 401 handling. When a refresh is in progress, later 401s
  /// wait on this completer instead of triggering a duplicate refresh.
  Completer<String?>? _refreshCompleter;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final path = options.path;
    final isAuthEndpoint = path.contains('/auth/refresh') ||
        path.contains('/auth/login') ||
        path.contains('/auth/register') ||
        path.contains('/auth/whatsapp') ||
        path.contains('/auth/2fa') ||
        path.contains('/auth/forgot-password') ||
        path.contains('/auth/reset-password') ||
        path.contains('/auth/google') ||
        path.contains('/borrower/auth');
    if (!isAuthEndpoint) {
      final token = await _storage.readToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      final tenantSlug = await _storage.readTenantSlug();
      final branchId = await _storage.readBranchId();
      final appType = await _storage.readAppType();
      if (tenantSlug != null && options.headers['X-Tenant-Slug'] == null) {
        options.headers['X-Tenant-Slug'] = tenantSlug;
      }
      if (branchId != null && options.headers['X-Branch-Id'] == null) {
        options.headers['X-Branch-Id'] = branchId;
      }
      if (appType != null && options.headers['X-App-Type'] == null) {
        options.headers['X-App-Type'] = appType;
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401 ||
        err.requestOptions.path.contains('/auth/refresh')) {
      handler.next(err);
      return;
    }

    // If another request is already refreshing, wait for it.
    if (_refreshCompleter != null) {
      final newToken = await _refreshCompleter!.future;
      if (newToken != null) {
        final opts = err.requestOptions;
        opts.headers['Authorization'] = 'Bearer $newToken';
        try {
          final retried = await _dio.fetch<dynamic>(opts);
          handler.resolve(retried);
          return;
        } catch (_) {
          // Retry failed — fall through to next(err).
        }
      }
      handler.next(err);
      return;
    }

    // This request is the first to see 401 — perform the refresh.
    final refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null) {
      _on401();
      handler.next(err);
      return;
    }

    _refreshCompleter = Completer<String?>();
    String? newToken;
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(headers: {'Authorization': ''}),
      );
      final body = res.data;
      newToken = body?['data']?['token'] as String?;
      final newRefresh = body?['data']?['refreshToken'] as String?;
      if (newToken != null && newRefresh != null) {
        await _storage.updateTokens(
          token: newToken,
          refreshToken: newRefresh,
        );
      } else {
        newToken = null;
      }
    } catch (_) {
      newToken = null;
    } finally {
      _refreshCompleter!.complete(newToken);
      _refreshCompleter = null;
    }

    if (newToken != null) {
      // Retry the original request with the fresh token.
      final opts = err.requestOptions;
      opts.headers['Authorization'] = 'Bearer $newToken';
      try {
        final retried = await _dio.fetch<dynamic>(opts);
        handler.resolve(retried);
        return;
      } catch (_) {
        // Retry failed — fall through.
      }
    } else {
      _on401();
    }
    handler.next(err);
  }
}

/// Automatically retries idempotent GET requests on transient network drops,
/// timeouts, or temporary 5xx server responses with exponential backoff.
class _RetryInterceptor extends Interceptor {
  _RetryInterceptor(this._dio);
  final Dio _dio;

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final req = err.requestOptions;
    final isGet = req.method.toUpperCase() == 'GET';
    final isAuthLogin =
        req.path.contains('/auth/login') && err.response == null;
    final retryCount = (req.extra['retry_count'] as int?) ?? 0;
    final statusCode = err.response?.statusCode;

    final isTransient = err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        err.type == DioExceptionType.connectionError ||
        (statusCode != null && statusCode >= 500);

    final maxRetries = isAuthLogin ? 1 : (isGet ? 2 : 0);

    if ((isGet || isAuthLogin) && isTransient && retryCount < maxRetries) {
      req.extra['retry_count'] = retryCount + 1;
      await Future<void>.delayed(
        Duration(milliseconds: 350 * (retryCount + 1)),
      );
      try {
        final res = await _dio.fetch<dynamic>(req);
        handler.resolve(res);
        return;
      } catch (retryErr) {
        if (retryErr is DioException) {
          handler.next(retryErr);
          return;
        }
      }
    }
    handler.next(err);
  }
}

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(authStorageProvider);
  final ctrl = ref.watch(_unauthorizedControllerProvider);
  final baseUrl = ref.watch(apiBaseUrlProvider) ?? kDefaultBaseUrl;

  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json'},
      validateStatus: (s) => s != null && s < 500 && s != 401,
    ),
  );

  dio.interceptors.add(
    _AuthInterceptor(storage, dio, () {
      if (!ctrl.isClosed) ctrl.add(null);
    }),
  );

  dio.interceptors.add(_RetryInterceptor(dio));

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

/// Server media (photos, KYC docs) is stored as a RELATIVE url like
/// `/api/files/<tenant>/<name>` — the web resolves it against the page host,
/// but `NetworkImage` needs an absolute URL, so on mobile every photo
/// silently failed to load. This is the host root (api base minus /api/v1).
final mediaBaseUrlProvider = Provider<String>((ref) {
  final api = ref.watch(apiBaseUrlProvider) ?? kDefaultBaseUrl;
  return api.replaceFirst(RegExp(r'/api/v1/?$'), '');
});

/// Absolutize a server media url. Passes through http(s) urls untouched.
String absoluteMediaUrl(String base, String? url) {
  if (url == null || url.isEmpty) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url.startsWith('/') ? '$base$url' : '$base/$url';
}

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

/// Helper: unwrap a raw-bytes PDF/file download. `validateStatus` treats
/// everything under 500 (except 401) as a normal response, so a 403/404 gate
/// on a `responseType: bytes` request comes back as `Response.data = <bytes
/// of the JSON error body>` instead of throwing — without this check, that
/// gets silently handed to a PDF viewer as if it were the real file, which
/// fails with a cryptic renderer error instead of the server's actual reason
/// (e.g. "disabled by administrator").
List<int> unwrapPdfBytes(Response<List<int>> res) {
  final bytes = res.data ?? const <int>[];
  final contentType = res.headers.value('content-type') ?? '';
  if (res.statusCode != 200 || !contentType.contains('pdf')) {
    String message = 'Could not generate the document (${res.statusCode})';
    try {
      final decoded = jsonDecode(utf8.decode(bytes));
      if (decoded is Map && decoded['error'] != null) {
        message = decoded['error'].toString();
      }
    } catch (_) {
      // Body wasn't JSON either — keep the generic message.
    }
    throw ApiException(message, statusCode: res.statusCode);
  }
  return bytes;
}
