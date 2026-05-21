import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class LoginResult {
  const LoginResult({this.token, this.user, this.requiresTotp = false});
  final String? token;
  final User? user;
  final bool requiresTotp;
}

/// Plain Dio-based service (no Retrofit codegen).
/// Calls only endpoints listed in `Endpoints` (spec §2.4).
class AuthService {
  AuthService(this._dio);

  final Dio _dio;

  Future<LoginResult> login({
    required String username,
    required String password,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.login,
      data: {'username': username, 'password': password},
    );
    return unwrapEnvelope(res, (dynamic d) {
      final map = d as Map<String, dynamic>;
      if (map['requiresTotp'] == true) {
        return const LoginResult(requiresTotp: true);
      }
      return LoginResult(
        token: map['token'] as String,
        user: User.fromJson(map['user'] as Map<String, dynamic>),
      );
    });
  }

  Future<LoginResult> verify2fa({
    required String username,
    required String code,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.verify2fa,
      data: {'username': username, 'code': code},
    );
    return unwrapEnvelope(res, (dynamic d) {
      final map = d as Map<String, dynamic>;
      return LoginResult(
        token: map['token'] as String,
        user: User.fromJson(map['user'] as Map<String, dynamic>),
      );
    });
  }

  Future<User> me() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.me);
    return unwrapEnvelope(
      res,
      (dynamic d) => User.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<void> logout() async {
    await _dio.post<Map<String, dynamic>>(Endpoints.logout);
  }
}

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(dioProvider)),
);
