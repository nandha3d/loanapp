// ignore_for_file: require_trailing_commas

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/npa.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class NpaLoansPage {
  const NpaLoansPage({
    required this.loans,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  final List<NpaLoan> loans;
  final int page;
  final int pageSize;
  final int total;
}

class NpaService {
  NpaService(this._dio);
  final Dio _dio;

  Future<NpaSummary> fetchSummary({DateTime? asOfDate}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.npaSummary,
      queryParameters: {
        if (asOfDate != null) 'date': asOfDate.toIso8601String(),
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => NpaSummary.fromJson(Map<String, dynamic>.from(d as Map)),
    );
  }

  Future<NpaLoansPage> fetchLoans({
    String? category,
    int page = 1,
    int pageSize = 20,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.npaLoans,
      queryParameters: {
        if (category != null && category.isNotEmpty) 'category': category,
        'page': page.toString(),
        'pageSize': pageSize.toString(),
      },
    );
    final body = res.data;
    return unwrapEnvelope(res, (dynamic d) {
      final loans = (d as List<dynamic>)
          .map((dynamic e) =>
              NpaLoan.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      final pagination = body?['pagination'] as Map<String, dynamic>? ?? {};
      int i(dynamic v, int fallback) => v == null
          ? fallback
          : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? fallback);
      return NpaLoansPage(
        loans: loans,
        page: i(pagination['page'], page),
        pageSize: i(pagination['pageSize'], pageSize),
        total: i(pagination['total'], loans.length),
      );
    });
  }

  Future<List<NpaHistoryItem>> fetchHistory(String loanId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.npaHistory,
      queryParameters: {'loanId': loanId},
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map(
            (dynamic e) =>
                NpaHistoryItem.fromJson(Map<String, dynamic>.from(e as Map)),
          )
          .toList();
    });
  }

  Future<NpaUpgradeEligibility> fetchUpgradeEligibility(String loanId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.npaUpgrade,
      queryParameters: {'loanId': loanId},
    );
    return unwrapEnvelope(
      res,
      (dynamic d) =>
          NpaUpgradeEligibility.fromJson(Map<String, dynamic>.from(d as Map)),
    );
  }

  Future<void> upgradeLoan(String loanId, {String? notes}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.npaUpgrade,
      data: {
        'loanId': loanId,
        if (notes != null) 'notes': notes,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }
}

final npaServiceProvider = Provider<NpaService>((ref) {
  return NpaService(ref.watch(dioProvider));
});
