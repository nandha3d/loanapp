import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class LoginResult {
  const LoginResult({this.token, this.refreshToken, this.user, this.requiresTotp = false});
  final String? token;
  final String? refreshToken;
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
        refreshToken: map['refreshToken'] as String?,
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
        refreshToken: map['refreshToken'] as String?,
        user: User.fromJson(map['user'] as Map<String, dynamic>),
      );
    });
  }

  Future<LoginResult> registerWithEmail({
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
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.register,
      data: {
        'businessName': businessName,
        'ownerName': ownerName,
        'ownerPhone': ownerPhone,
        'ownerUsername': ownerUsername,
        'ownerPassword': ownerPassword,
        'selectedPlan': selectedPlan,
        'selectedModules': selectedModules,
        'selectedAddons': selectedAddons,
        if (referralCode != null && referralCode.isNotEmpty)
          'referralCode': referralCode,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      final map = d as Map<String, dynamic>;
      return LoginResult(
        token: map['token'] as String,
        user: User.fromJson(map['user'] as Map<String, dynamic>),
      );
    });
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
    final data = <String, dynamic>{
      'idToken': idToken,
    };
    if (businessName != null) data['businessName'] = businessName;
    if (ownerPhone != null) data['ownerPhone'] = ownerPhone;
    if (selectedPlan != null) data['selectedPlan'] = selectedPlan;
    if (selectedModules != null) data['selectedModules'] = selectedModules;
    if (selectedAddons != null) data['selectedAddons'] = selectedAddons;
    if (referralCode != null && referralCode.isNotEmpty) {
      data['referralCode'] = referralCode;
    }

    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.googleAuth,
      data: data,
    );

    return unwrapEnvelope(res, (dynamic d) {
      final map = d as Map<String, dynamic>;
      if (map['needsRegistration'] == true) {
        return GoogleAuthResult(
          needsRegistration: true,
          email: map['email'] as String?,
          name: map['name'] as String?,
        );
      }
      return GoogleAuthResult(
        token: map['token'] as String?,
        user: map['user'] != null
            ? User.fromJson(map['user'] as Map<String, dynamic>)
            : null,
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

  Future<void> forgotPassword(String email) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.forgotPassword,
      data: {'email': email},
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.resetPassword,
      data: {'email': email, 'otp': otp, 'newPassword': newPassword},
    );
    unwrapEnvelope(res, (_) => null);
  }
}

class GoogleAuthResult {
  const GoogleAuthResult({
    this.token,
    this.user,
    this.needsRegistration = false,
    this.email,
    this.name,
  });

  final String? token;
  final User? user;
  final bool needsRegistration;
  final String? email;
  final String? name;
}

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(dioProvider)),
);
