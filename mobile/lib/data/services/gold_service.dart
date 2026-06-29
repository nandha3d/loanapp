import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

/// Gold pledge module API client — master data, config, servicing, reports.
/// Reads the same /api/v1/gold/* endpoints the web uses, so web + mobile stay
/// in sync. No business math on the client; the server computes it.

class GoldMaster {
  GoldMaster({required this.ornamentTypes, required this.ornamentSpecs, required this.bankNames});
  final List<Map<String, dynamic>> ornamentTypes;
  final List<Map<String, dynamic>> ornamentSpecs;
  final List<Map<String, dynamic>> bankNames;

  static List<Map<String, dynamic>> _list(dynamic v) =>
      (v as List<dynamic>? ?? []).map((e) => (e as Map).cast<String, dynamic>()).toList();

  factory GoldMaster.fromJson(Map<String, dynamic> j) => GoldMaster(
        ornamentTypes: _list(j['ornamentTypes']),
        ornamentSpecs: _list(j['ornamentSpecs']),
        bankNames: _list(j['bankNames']),
      );
}

class GoldServicingSummary {
  GoldServicingSummary({
    required this.loanCode,
    required this.status,
    required this.outstandingPrincipal,
    required this.monthlyInterest,
    required this.monthsDue,
    required this.interestDue,
    required this.redemptionAmount,
    required this.payments,
  });
  final String loanCode;
  final String status;
  final num outstandingPrincipal;
  final num monthlyInterest;
  final num monthsDue;
  final num interestDue;
  final num redemptionAmount;
  final List<Map<String, dynamic>> payments;

  bool get isClosed => status == 'closed';

  factory GoldServicingSummary.fromJson(Map<String, dynamic> j) => GoldServicingSummary(
        loanCode: (j['loanCode'] ?? '') as String,
        status: (j['status'] ?? '') as String,
        outstandingPrincipal: (j['outstandingPrincipal'] ?? 0) as num,
        monthlyInterest: (j['monthlyInterest'] ?? 0) as num,
        monthsDue: (j['monthsDue'] ?? 0) as num,
        interestDue: (j['interestDue'] ?? 0) as num,
        redemptionAmount: (j['redemptionAmount'] ?? 0) as num,
        payments: (j['payments'] as List<dynamic>? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList(),
      );
}

class GoldService {
  GoldService(this._dio);
  final Dio _dio;

  Future<GoldMaster> master({String? metal}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.goldMaster,
      queryParameters: metal == null ? null : {'metal': metal},
    );
    return unwrapEnvelope(res, (d) => GoldMaster.fromJson((d as Map).cast<String, dynamic>()));
  }

  Future<Map<String, dynamic>> config() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.goldConfig);
    return unwrapEnvelope(res, (d) => (d as Map).cast<String, dynamic>());
  }

  Future<GoldServicingSummary> servicing(String loanId) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.goldServicing(loanId));
    return unwrapEnvelope(
      res,
      (d) => GoldServicingSummary.fromJson((d as Map).cast<String, dynamic>()),
    );
  }

  /// action: 'interest' | 'part' | 'redeem'.
  Future<void> recordServicing(
    String loanId,
    String action,
    double amount, {
    String paymentMode = 'cash',
  }) async {
    await _dio.post<Map<String, dynamic>>(
      Endpoints.goldServicing(loanId),
      data: {'action': action, 'amount': amount, 'paymentMode': paymentMode},
    );
  }

  /// type: 'summary' | 'pending' | 'ornaments'.
  Future<Map<String, dynamic>> reports(String type) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.goldReports,
      queryParameters: {'type': type},
    );
    return unwrapEnvelope(res, (d) => (d as Map).cast<String, dynamic>());
  }
}

final goldServiceProvider = Provider<GoldService>(
  (ref) => GoldService(ref.watch(dioProvider)),
);
