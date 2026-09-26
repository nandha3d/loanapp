import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/network/api_exception.dart';
import 'package:zolofund/data/models/reports.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class ReportsService {
  ReportsService(this._dio);
  final Dio _dio;

  Future<Uint8List> exportReport({
    required String slug,
    required String format,
    required Map<String, dynamic> filters,
  }) async {
    if (!const {'pdf', 'excel', 'csv'}.contains(format)) {
      throw ArgumentError.value(format, 'format');
    }
    final res = await _dio.get<List<int>>(
      Endpoints.reportExport(slug),
      queryParameters: {...filters, 'format': format},
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = res.data ?? const <int>[];
    final type = res.headers.value('content-type') ?? '';
    final expected = switch (format) {
      'pdf' => 'application/pdf',
      'excel' => 'spreadsheetml.sheet',
      _ => 'text/csv',
    };
    if (res.statusCode != 200 || !type.contains(expected)) {
      String message = 'Could not export report (${res.statusCode})';
      try {
        final body = jsonDecode(utf8.decode(bytes));
        if (body is Map && body['error'] != null) message = body['error'].toString();
      } catch (_) {}
      throw ApiException(message, statusCode: res.statusCode);
    }
    return Uint8List.fromList(bytes);
  }

  Future<List<Map<String, dynamic>>> fetchCatalog() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.reportsOptions);
    return unwrapEnvelope(res, (dynamic data) {
      final reports =
          (data as Map<String, dynamic>)['reports'] as List<dynamic>? ??
              const [];
      return reports
          .map((dynamic item) => Map<String, dynamic>.from(item as Map))
          .toList(growable: false);
    });
  }

  Future<Map<String, dynamic>> fetchReport(
      String slug, DateTime from, DateTime to,
      [String? language, String? customerId, String? accountId]) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.report(slug),
      queryParameters: {
        'from': _fmtDate(from),
        'to': _fmtDate(to),
        if (language != null && language.isNotEmpty) 'lang': language,
        if (customerId != null) 'customerId': customerId,
        // The shared web report uses loanId for its chart-of-accounts selector.
        if (accountId != null) 'loanId': accountId,
      },
    );
    return unwrapEnvelope(
        res, (dynamic data) => Map<String, dynamic>.from(data as Map));
  }

  /// Fetch accounting capital summary.
  Future<AccountingSummary> fetchAccountingSummary() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.accountingSummary);
    return unwrapEnvelope(
      res,
      (dynamic d) => AccountingSummary.fromJson(d as Map<String, dynamic>),
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
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.reportsOverdue);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => OverdueItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  /// Fetch agent performance report for a date range.
  Future<List<AgentPerf>> fetchAgentPerformance(
    DateTime from,
    DateTime to,
  ) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.reportsAgent,
      queryParameters: <String, String>{
        'from': _fmtDate(from),
        'to': _fmtDate(to),
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      final list =
          (d is Map<String, dynamic> ? d['agents'] : d) as List<dynamic>? ??
              const [];
      return list
          .map((dynamic e) => AgentPerf.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  static String _fmtDate(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}

final reportsServiceProvider = Provider<ReportsService>(
  (ref) => ReportsService(ref.watch(dioProvider)),
);
