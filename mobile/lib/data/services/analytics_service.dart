import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/analytics.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class AnalyticsService {
  AnalyticsService(this._dio);
  final Dio _dio;

  Future<AnalyticsSummary> summary() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.analyticsSummary);
    return unwrapEnvelope(
      res,
      (dynamic d) => AnalyticsSummary.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<List<CollectionPoint>> collections({int? range}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.analyticsCollections,
      queryParameters: range != null ? {'range': range.toString()} : null,
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) =>
              CollectionPoint.fromJson(e as Map<String, dynamic>),)
          .toList(growable: false);
    });
  }

  Future<List<AgentPerformance>> agents() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.analyticsAgents);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map(
            (dynamic e) => AgentPerformance.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false);
    });
  }

  /// Full consolidated analytics for the enhanced mobile dashboard.
  Future<FullAnalytics> fullAnalytics({int? range}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.analyticsFull,
      queryParameters: range != null ? {'range': range.toString()} : null,
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => FullAnalytics.fromJson(d as Map<String, dynamic>),
    );
  }
}

final analyticsServiceProvider = Provider<AnalyticsService>(
  (ref) => AnalyticsService(ref.watch(dioProvider)),
);
