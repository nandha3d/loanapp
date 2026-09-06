import 'package:dio/dio.dart';

/// Thrown when API returns an error envelope or HTTP failure.
class ApiException implements Exception {
  ApiException(String rawMessage, {this.statusCode, this.code, this.data})
      : message = _cleanMessage(rawMessage);

  final String message;
  final int? statusCode;
  final String? code;
  final dynamic data;

  static String _cleanMessage(String raw) {
    if (raw.startsWith('already_paid:')) {
      return raw.substring('already_paid:'.length).trim();
    }
    return raw;
  }

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isConflict => statusCode == 409;

  factory ApiException.fromDio(DioException err) {
    final res = err.response;
    if (res == null) {
      return ApiException(
        _networkMessage(err.type),
        statusCode: null,
        code: 'network',
      );
    }
    final data = res.data;
    String? error;
    if (data is Map<String, dynamic>) {
      final raw = data['error'];
      if (raw is String) {
        error = raw;
      } else if (raw is Map<String, dynamic>) {
        error = raw['message']?.toString() ?? raw.toString();
      }
    }
    return ApiException(
      error ?? 'Request failed (${res.statusCode})',
      statusCode: res.statusCode,
      code: error,
    );
  }

  static String _networkMessage(DioExceptionType type) {
    switch (type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Connection timed out';
      case DioExceptionType.connectionError:
        return 'No network connection';
      case DioExceptionType.cancel:
        return 'Request cancelled';
      default:
        return 'Network error';
    }
  }

  @override
  String toString() => 'ApiException($statusCode): ${code ?? message}';
}
