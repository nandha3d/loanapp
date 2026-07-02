import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/approval.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class ApprovalService {
  ApprovalService(this._dio);
  final Dio _dio;

  Future<List<Approval>> list({String status = 'pending'}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.approvals,
      queryParameters: {'status': status},
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => Approval.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  Future<void> approve(String id, {String? note}) async {
    await _dio.patch<Map<String, dynamic>>(
      Endpoints.approvalApprove(id),
      data: {if (note != null) 'note': note},
    );
  }

  Future<void> reject(String id, {String? note}) async {
    await _dio.patch<Map<String, dynamic>>(
      Endpoints.approvalReject(id),
      data: {if (note != null) 'note': note},
    );
  }

  /// Files a generic review-gated request — used for corrections a role
  /// can't apply directly (e.g. a recorded collection amount), mirroring
  /// the web's `requestCollectionEdit`. Never applies the change itself.
  Future<void> request({
    required String requestType,
    required String entityType,
    required String entityId,
    required Map<String, dynamic> requestedChanges,
    String reason = '',
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.approvals,
      data: {
        'requestType': requestType,
        'entityType': entityType,
        'entityId': entityId,
        'requestedChanges': requestedChanges,
        'reason': reason,
      },
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final approvalServiceProvider = Provider<ApprovalService>(
  (ref) => ApprovalService(ref.watch(dioProvider)),
);
