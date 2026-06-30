import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/superadmin_profile.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class ProfileService {
  ProfileService(this._dio);

  final Dio _dio;

  Future<SuperadminProfile> getProfile() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.profile);
    return unwrapEnvelope(
      res,
      (dynamic d) => SuperadminProfile.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<SuperadminProfile> updateProfile({
    required String name,
    required String phone,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.profile,
      data: {'name': name, 'phone': phone},
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => SuperadminProfile.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<void> sendPasswordOtp() async {
    final res = await _dio.post<Map<String, dynamic>>(Endpoints.profilePasswordOtp);
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> changePassword({
    required String otp,
    required String newPassword,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.profilePasswordChange,
      data: {'otp': otp, 'newPassword': newPassword},
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final profileServiceProvider = Provider<ProfileService>((ref) {
  return ProfileService(ref.watch(dioProvider));
});
