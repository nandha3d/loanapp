import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/penalty.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class PenaltyPage {
  const PenaltyPage({
    required this.rows,
    required this.page,
    required this.pages,
    required this.totalGross,
    required this.totalSettled,
    required this.totalWaived,
  });

  final List<Penalty> rows;
  final int page;
  final int pages;
  final double totalGross;
  final double totalSettled;
  final double totalWaived;
}

/// DEC-03 (B): a page of per-loan penalty groups plus the KPIs (server figures).
class LoanPenaltyPage {
  const LoanPenaltyPage({
    required this.rows,
    required this.page,
    required this.pages,
    required this.totalGross,
    required this.totalSettled,
    required this.totalWaived,
    required this.net,
  });
  final List<LoanPenaltyGroup> rows;
  final int page;
  final int pages;
  final double totalGross;
  final double totalSettled;
  final double totalWaived;
  final double net;
}

class PenaltyService {
  PenaltyService(this._dio);
  final Dio _dio;

  /// DEC-03 (B): one row per loan, totals computed by the server.
  Future<LoanPenaltyPage> listLoanGroups({
    required int page,
    String? status,
    String? routeId,
    String? query,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.penalties,
      queryParameters: {
        'groupBy': 'loan',
        'page': page,
        if (status != null && status != 'all') 'status': status,
        if (routeId != null) 'routeId': routeId,
        if (query != null && query.isNotEmpty) 'q': query,
      },
    );
    return unwrapEnvelope(res, (dynamic data) {
      final d = data as Map<String, dynamic>;
      final kpis = d['kpis'] as Map<String, dynamic>;
      double amount(dynamic value) =>
          value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
      return LoanPenaltyPage(
        rows: (d['rows'] as List<dynamic>)
            .map((dynamic item) => LoanPenaltyGroup.fromJson(item as Map<String, dynamic>))
            .toList(growable: false),
        page: (d['page'] as num).toInt(),
        pages: (d['pages'] as num).toInt(),
        totalGross: amount(kpis['totalGross']),
        totalSettled: amount(kpis['totalSettled']),
        totalWaived: amount(kpis['totalWaived']),
        net: amount(kpis['net']),
      );
    });
  }

  /// DEC-03 (B): the server splits [amount] over the loan's open penalties.
  Future<void> settleLoan({required String loanId, required double amount, String paymentMode = 'cash'}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '${Endpoints.penalties}/loan/$loanId/settle',
      data: {'amount': amount, 'paymentMode': paymentMode},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  /// DEC-03 (B): waive the loan's open penalties (all, or [amount]) on the server.
  Future<void> waiveLoan({required String loanId, double? amount, String? reason}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '${Endpoints.penalties}/loan/$loanId/waive',
      data: {if (amount != null) 'amount': amount, if (reason != null && reason.isNotEmpty) 'reason': reason},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<PenaltyPage> listPage({
    required int page,
    String? status,
    String? routeId,
    String? query,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.penalties,
      queryParameters: {
        'page': page,
        if (status != null && status != 'all') 'status': status,
        if (routeId != null) 'routeId': routeId,
        if (query != null && query.isNotEmpty) 'q': query,
      },
    );
    return unwrapEnvelope(res, (dynamic data) {
      final d = data as Map<String, dynamic>;
      final kpis = d['kpis'] as Map<String, dynamic>;
      double amount(dynamic value) =>
          value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
      return PenaltyPage(
        rows: (d['rows'] as List<dynamic>)
            .map((dynamic item) => Penalty.fromJson(item as Map<String, dynamic>))
            .toList(growable: false),
        page: (d['page'] as num).toInt(),
        pages: (d['pages'] as num).toInt(),
        totalGross: amount(kpis['totalGross']),
        totalSettled: amount(kpis['totalSettled']),
        totalWaived: amount(kpis['totalWaived']),
      );
    });
  }

  Future<List<Penalty>> list({String status = 'pending'}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.penalties,
      queryParameters: {'status': status},
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => Penalty.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  Future<void> settle({
    required String id,
    required double amount,
    String paymentMode = 'cash',
  }) async {
    await _dio.patch<Map<String, dynamic>>(
      Endpoints.penaltySettle(id),
      data: {'action': 'settle', 'amount': amount, 'paymentMode': paymentMode},
    );
  }

  Future<void> waive({
    required String id,
    double? amount,
    String? reason,
  }) async {
    final payload = <String, dynamic>{};
    if (amount != null) payload['amount'] = amount;
    if (reason != null && reason.isNotEmpty) payload['reason'] = reason;

    await _dio.post<Map<String, dynamic>>(
      Endpoints.penaltyWaive(id),
      data: payload,
    );
  }
}

final penaltyServiceProvider = Provider<PenaltyService>(
  (ref) => PenaltyService(ref.watch(dioProvider)),
);
