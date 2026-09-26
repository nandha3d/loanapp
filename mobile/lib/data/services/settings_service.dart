import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/analytics.dart';
import 'package:zolofund/data/models/route_model.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class SettingsService {
  SettingsService(this._dio);
  final Dio _dio;

  Future<bool> twoFactorEnabled() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.twoFactor);
    return unwrapEnvelope(res, (dynamic data) => (data as Map<String, dynamic>)['enabled'] == true);
  }

  Future<Map<String, dynamic>> startTwoFactorSetup() async {
    final res = await _dio.post<Map<String, dynamic>>(Endpoints.twoFactorSetup);
    return unwrapEnvelope(res, (dynamic data) => Map<String, dynamic>.from(data as Map));
  }

  Future<void> verifyTwoFactorSetup(String setupToken, String code) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.twoFactorVerify,
      data: {'setupToken': setupToken, 'code': code},
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> disableTwoFactor() async {
    final res = await _dio.delete<Map<String, dynamic>>(Endpoints.twoFactor);
    unwrapEnvelope(res, (_) => null);
  }

  Future<List<Map<String, dynamic>>> notificationTemplates() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.notificationTemplates);
    return unwrapEnvelope(res, (dynamic data) => (data as List<dynamic>)
        .map((dynamic row) => Map<String, dynamic>.from(row as Map))
        .toList(growable: false));
  }

  Future<void> saveNotificationTemplate(Map<String, dynamic> data) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.notificationTemplates, data: data,
    );
    unwrapEnvelope(res, (_) => null);
  }

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

  Future<List<LoanPackage>> packages({bool includeInactive = false}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.packages,
      queryParameters: includeInactive ? {'includeInactive': '1'} : null,
    );
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
        data: patch,);
  }

  Future<void> createPackage(Map<String, dynamic> data) async {
    final res = await _dio.post<Map<String, dynamic>>(Endpoints.packages, data: data);
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> updatePackage(String id, Map<String, dynamic> data) async {
    final res = await _dio.patch<Map<String, dynamic>>(Endpoints.package(id), data: data);
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> deletePackage(String id) async {
    final res = await _dio.delete<Map<String, dynamic>>(Endpoints.package(id));
    unwrapEnvelope(res, (_) => null);
  }

  Future<List<Map<String, dynamic>>> agents() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.agents);
    return unwrapEnvelope(res, (dynamic data) => (data as List<dynamic>)
        .map((dynamic item) => item as Map<String, dynamic>)
        .toList(growable: false));
  }

  Future<void> updateRoute(String id, String name) async {
    final res = await _dio.patch<Map<String, dynamic>>(Endpoints.route(id), data: {'name': name});
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> deleteRoute(String id) async {
    final res = await _dio.delete<Map<String, dynamic>>(Endpoints.route(id));
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> assignRouteAgent(String id, String agentId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.routeAgents(id), data: {'agentId': agentId});
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> removeRouteAgent(String id, String agentId) async {
    final res = await _dio.delete<Map<String, dynamic>>(
      Endpoints.routeAgents(id), data: {'agentId': agentId});
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> setPrimaryRouteAgent(String id, String? agentId) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.routePrimaryAgent(id), data: {'agentId': agentId});
    unwrapEnvelope(res, (_) => null);
  }

  Future<Map<String, dynamic>> integrations() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.integrations);
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> saveIntegrations(
    Map<String, dynamic> patch,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.integrations,
      data: patch,
    );
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }
}

final settingsServiceProvider = Provider<SettingsService>(
  (ref) => SettingsService(ref.watch(dioProvider)),
);
