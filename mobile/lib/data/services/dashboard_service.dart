import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/chit_dashboard_summary.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class DashboardService {
  DashboardService(this._dio);
  final Dio _dio;

  Future<DashboardSummary> getSummary() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.dashboard);
    return unwrapEnvelope(
      res,
      (dynamic d) => DashboardSummary.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<ChitDashboardSummary> getChitSummary() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.dashboardChits);
    return unwrapEnvelope(
      res,
      (dynamic d) =>
          ChitDashboardSummary.fromJson(d as Map<String, dynamic>),
    );
  }
}

final dashboardServiceProvider = Provider<DashboardService>(
  (ref) => DashboardService(ref.watch(dioProvider)),
);
