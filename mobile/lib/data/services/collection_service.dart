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

  Future<List<SelfPayQueueItem>> selfPayQueue() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.selfPayQueue);
    return unwrapEnvelope(res, (dynamic d) {
      final map = d as Map<String, dynamic>;
      final rows = map['data'] as List<dynamic>? ?? const <dynamic>[];
      return rows
          .map(
            (dynamic e) => SelfPayQueueItem.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false);
    });
  }

  Future<void> reviewSelfPay({
    required String token,
    required String action,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.selfPayQueue,
      data: {'token': token, 'action': action},
    );
    unwrapEnvelope(res, (_) => null);
  }

  /// Submits a collection. Idempotent via `idempotencyKey`.
  Future<CollectionEntry> submit({
    required String instalmentId,
    required double receivedAmount,
    required String paymentMode,
    required String idempotencyKey,
    String? remarks,
    DateTime? collectionDate,
    // Device location captured at collection time. The server reads body.gps
    // (lat/lng/accuracy/altitude/timestamp/status) to geo-stamp + verify the
    // entry — identical handling to the web's GPS capture.
    Map<String, dynamic>? gps,
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
        if (gps != null) 'gps': gps,
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => CollectionEntry.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Loan-level collection: the server spreads the amount across the loan's
  /// open instalments TODAY-FIRST (today's due → overdue oldest-first →
  /// future). Single source of truth — the app never allocates client-side.
  /// When `idempotencyKey` is omitted the server derives stable per-instalment
  /// keys (same behaviour as the web popup). Returns the applied amount.
  Future<double> collectLoan({
    required String loanId,
    required double amount,
    required String paymentMode,
    String? idempotencyKey,
    String? remarks,
    DateTime? collectionDate,
    Map<String, dynamic>? gps,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.collectionCollect,
      data: {
        'loanId': loanId,
        'amount': amount,
        'paymentMode': paymentMode,
        if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
        if (remarks != null) 'remarks': remarks,
        if (collectionDate != null)
          'collectionDate': collectionDate.toIso8601String(),
        if (gps != null) 'gps': gps,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      final m = d as Map<String, dynamic>;
      final v = m['applied'];
      return v is num ? v.toDouble() : double.tryParse('${v ?? 0}') ?? 0;
    });
  }

  /// Photo proof: files a pending request that the client must approve.
  /// Returns the approval id.
  Future<String> submitPhotoProof({
    required String instalmentId,
    required double amount,
    required String paymentMode,
    String? photoUrl,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.collectionProofPhoto,
      data: {
        'instalmentId': instalmentId,
        'amount': amount,
        'paymentMode': paymentMode,
        if (photoUrl != null) 'photoUrl': photoUrl,
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => (d as Map<String, dynamic>)['id'] as String,
    );
  }

  /// Receipt PDF: returns raw PDF bytes for a collection entry.
  /// Server gates on subscription + admin setting; throws on 403/404.
  Future<List<int>> receiptPdf(String entryId) async {
    final res = await _dio.get<List<int>>(
      Endpoints.receipt(entryId),
      options: Options(responseType: ResponseType.bytes),
    );
    return unwrapPdfBytes(res);
  }

  /// QR proof: scanned token auto-confirms. Returns the applied amount.
  Future<double> submitQrProof(String token) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.collectionProofQr,
      data: {'token': token},
    );
    return unwrapEnvelope(res, (dynamic d) {
      final m = d as Map<String, dynamic>;
      final v = m['applied'];
      return v is num ? v.toDouble() : double.tryParse('${v ?? 0}') ?? 0;
    });
  }
}

final collectionServiceProvider = Provider<CollectionService>(
  (ref) => CollectionService(ref.watch(dioProvider)),
);
