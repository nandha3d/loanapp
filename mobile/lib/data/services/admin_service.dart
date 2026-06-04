import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class AdminService {
  AdminService(this._dio);
  final Dio _dio;

  // --- Users ---
  Future<List<Map<String, dynamic>>> listUsers() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.adminUsers);
    return unwrapEnvelope(res, (dynamic d) {
      final list = (d as List<dynamic>);
      return list.map((dynamic e) => Map<String, dynamic>.from(e as Map)).toList();
    });
  }

  Future<void> createUser({
    required String name,
    required String username,
    required String phone,
    required String password,
    required String role,
    String? appType,
    String? branchId,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.adminUsers,
      data: {
        'name': name,
        'username': username,
        'phone': phone,
        'password': password,
        'role': role,
        if (appType != null) 'appType': appType,
        if (branchId != null) 'branchId': branchId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> updateUser(String id, {
    required String name,
    required String username,
    required String phone,
    String? password,
    required String role,
    String? appType,
    String? branchId,
    String? status,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.adminUser(id),
      data: {
        'name': name,
        'username': username,
        'phone': phone,
        if (password != null && password.isNotEmpty) 'password': password,
        'role': role,
        if (appType != null) 'appType': appType,
        if (branchId != null) 'branchId': branchId,
        if (status != null) 'status': status,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> toggleUserStatus(String id, String status) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.adminUser(id),
      data: {'status': status},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  // --- Branches ---
  Future<List<Map<String, dynamic>>> listBranches() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.adminBranches);
    return unwrapEnvelope(res, (dynamic d) {
      final list = (d as List<dynamic>);
      return list.map((dynamic e) => Map<String, dynamic>.from(e as Map)).toList();
    });
  }

  Future<void> createBranch({
    required String name,
    required String code,
    String? phone,
    String? superadminId,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.adminBranches,
      data: {
        'name': name,
        'code': code,
        if (phone != null) 'phone': phone,
        if (superadminId != null) 'superadminId': superadminId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> updateBranch(String id, {
    required String name,
    required String code,
    String? phone,
    String? status,
    String? superadminId,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.adminBranch(id),
      data: {
        'name': name,
        'code': code,
        if (phone != null) 'phone': phone,
        if (status != null) 'status': status,
        if (superadminId != null) 'superadminId': superadminId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  // --- Billing ---
  Future<Map<String, dynamic>> getBilling() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.adminBilling);
    return unwrapEnvelope(res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<void> updateBilling(Map<String, dynamic> data) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.adminBilling,
      data: data,
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  // --- Affiliates ---
  Future<Map<String, dynamic>> getAffiliates() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.adminAffiliates);
    return unwrapEnvelope(res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<Map<String, dynamic>> syncAffiliates() async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.adminAffiliates,
      data: {'action': 'sync'},
    );
    return unwrapEnvelope(res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<void> saveAffiliateConfig({
    required double threshold,
    required double monthlyCommissionRate,
    required double monthlyCommissionMonths,
    required double yearlyRewardFreeMonths,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.adminAffiliates,
      data: {
        'action': 'config',
        'threshold': threshold,
        'monthlyCommissionRate': monthlyCommissionRate,
        'monthlyCommissionMonths': monthlyCommissionMonths,
        'yearlyRewardFreeMonths': yearlyRewardFreeMonths,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> updateAffiliateReward(String rewardId, String status) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.adminAffiliates,
      data: {
        'action': 'update_reward',
        'rewardId': rewardId,
        'status': status,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  // --- Requests ---
  Future<Map<String, dynamic>> getRequests() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.adminRequests);
    return unwrapEnvelope(res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<void> reviewRequest({
    required String requestType,
    required String requestId,
    required String decision,
    String? reviewNote,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.adminRequests,
      data: {
        'requestType': requestType,
        'requestId': requestId,
        'decision': decision,
        if (reviewNote != null) 'reviewNote': reviewNote,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }
}

final adminServiceProvider = Provider<AdminService>((ref) {
  return AdminService(ref.watch(dioProvider));
});
