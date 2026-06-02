import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/penalty.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class PenaltyService {
  PenaltyService(this._dio);
  final Dio _dio;

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
    final payload = <String, dynamic>{'action': 'waive'};
    if (amount != null) payload['amount'] = amount;
    if (reason != null && reason.isNotEmpty) payload['reason'] = reason;

    await _dio.patch<Map<String, dynamic>>(
      Endpoints.penaltySettle(id),
      data: payload,
    );
  }
}

final penaltyServiceProvider = Provider<PenaltyService>(
  (ref) => PenaltyService(ref.watch(dioProvider)),
);
