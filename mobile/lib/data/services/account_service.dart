import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/superadmin_profile.dart' show ProfileAccount;
import 'package:zolofund/shared/constants/endpoints.dart';

/// Self-service account profile for non-superadmin roles (admin, agent,
/// developer). Deliberately separate from ProfileService, which is
/// superadmin-only — reuses the [ProfileAccount] model (field-compatible)
/// but talks to the generic /account endpoints instead of /profile.
class AccountService {
  AccountService(this._dio);

  final Dio _dio;

  Future<ProfileAccount> getAccount() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.account);
    return unwrapEnvelope(
      res,
      (dynamic d) => ProfileAccount.fromJson(
        (d as Map<String, dynamic>)['account'] as Map<String, dynamic>,
      ),
    );
  }

  Future<ProfileAccount> updateAccount({
    required String name,
    required String phone,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.account,
      data: {'name': name, 'phone': phone},
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => ProfileAccount.fromJson(
        (d as Map<String, dynamic>)['account'] as Map<String, dynamic>,
      ),
    );
  }

  Future<void> sendPasswordOtp() async {
    final res = await _dio.post<Map<String, dynamic>>(Endpoints.accountPasswordOtp);
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> changePassword({
    required String otp,
    required String newPassword,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountPasswordChange,
      data: {'otp': otp, 'newPassword': newPassword},
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final accountServiceProvider = Provider<AccountService>((ref) {
  return AccountService(ref.watch(dioProvider));
});
