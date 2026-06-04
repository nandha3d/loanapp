import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/analytics.dart';
import 'package:loantrack/data/models/route_model.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class SettingsService {
  SettingsService(this._dio);
  final Dio _dio;

  Future<List<Map<String, dynamic>>> all() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.settings);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => e as Map<String, dynamic>)
          .toList(growable: false);
    });
  }

  Future<void> save(Map<String, dynamic> patch) async {
    await _dio.post<Map<String, dynamic>>(Endpoints.settings, data: patch);
  }

  Future<List<AppRoute>> routes() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.routes);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => AppRoute.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  Future<AppRoute> createRoute({required String name, String? agentId}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.routes,
      data: {'name': name, if (agentId != null) 'assignedAgentId': agentId},
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => AppRoute.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<AgentPerformance> createAgent({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.agents,
      data: {
        'name': name,
        'email': email,
        'phone': phone,
        'password': password,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      final map = d as Map<String, dynamic>;
      return AgentPerformance(
        id: map['id'] as String,
        name: (map['name'] as String?) ?? '',
        expected: 0,
        collected: 0,
        hitRate: 0,
      );
    });
  }

  Future<List<LoanPackage>> packages() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.packages);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => LoanPackage.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  /// Per-tenant payment gateway config (masked secrets). Admin only.
  Future<Map<String, dynamic>> gateway() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.paymentGateway);
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  Future<void> saveGateway(Map<String, dynamic> patch) async {
    await _dio.post<Map<String, dynamic>>(Endpoints.paymentGateway,
        data: patch);
  }
}

final settingsServiceProvider = Provider<SettingsService>(
  (ref) => SettingsService(ref.watch(dioProvider)),
);
