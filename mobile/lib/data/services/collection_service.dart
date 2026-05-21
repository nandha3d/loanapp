import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class CollectionService {
  CollectionService(this._dio);
  final Dio _dio;

  Future<List<CollectionRow>> today() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.collectionToday);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => CollectionRow.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  /// Submits a collection. Idempotent via `idempotencyKey`.
  Future<CollectionEntry> submit({
    required String instalmentId,
    required double receivedAmount,
    required String paymentMode,
    required String idempotencyKey,
    String? remarks,
    DateTime? collectionDate,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.collectionEntry,
      data: {
        'instalmentId': instalmentId,
        'receivedAmount': receivedAmount,
        'paymentMode': paymentMode,
        'idempotencyKey': idempotencyKey,
        if (remarks != null) 'remarks': remarks,
        if (collectionDate != null)
          'collectionDate': collectionDate.toIso8601String(),
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => CollectionEntry.fromJson(d as Map<String, dynamic>),
    );
  }
}

final collectionServiceProvider = Provider<CollectionService>(
  (ref) => CollectionService(ref.watch(dioProvider)),
);
