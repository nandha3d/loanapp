import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class ReportsService {
  ReportsService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> daily({DateTime? date}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.reportsDaily,
      queryParameters: {
        if (date != null) 'date': date.toIso8601String(),
      },
    );
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> agent({DateTime? from, DateTime? to, String? agentId}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.reportsAgent,
      queryParameters: {
        if (from != null) 'from': from.toIso8601String(),
        if (to != null) 'to': to.toIso8601String(),
        if (agentId != null) 'agentId': agentId,
      },
    );
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  Future<List<Map<String, dynamic>>> overdue() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.reportsOverdue);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => e as Map<String, dynamic>)
          .toList(growable: false);
    });
  }
}

final reportsServiceProvider = Provider<ReportsService>(
  (ref) => ReportsService(ref.watch(dioProvider)),
);
