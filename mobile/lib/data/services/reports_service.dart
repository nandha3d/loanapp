import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/reports.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class ReportsService {
  ReportsService(this._dio);
  final Dio _dio;

  /// Fetch accounting capital summary.
  Future<AccountingSummary> fetchAccountingSummary() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.accountingSummary);
    return unwrapEnvelope(
      res,
      (dynamic d) =>
          AccountingSummary.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Read-only financial statements (net profit, cashflow, top expenses).
  /// All figures computed server-side — returned raw for display.
  Future<Map<String, dynamic>> fetchAccountingStatements() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.accountingStatements);
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  /// Fetch overdue loans report.
  Future<List<OverdueItem>> fetchOverdueReport() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.reportsOverdue);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => OverdueItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  /// Fetch agent performance report for a date range.
  Future<List<AgentPerf>> fetchAgentPerformance(
      DateTime from, DateTime to,) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.reportsAgent,
      queryParameters: <String, String>{
        'from': _fmtDate(from),
        'to': _fmtDate(to),
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => AgentPerf.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  static String _fmtDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}

final reportsServiceProvider = Provider<ReportsService>(
  (ref) => ReportsService(ref.watch(dioProvider)),
);
