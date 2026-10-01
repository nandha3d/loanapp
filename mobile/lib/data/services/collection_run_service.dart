import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/collection_run.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

/// mCollect — route batch collection runs + digital self-pay link generation.
class CollectionRunService {
  CollectionRunService(this._dio);
  final Dio _dio;

  /// RUN-01: active routes + the last 50 runs, one call (same as web).
  Future<({List<({String id, String name})> routes, List<CollectionRun> runs})> listRuns() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.runList);
    return unwrapEnvelope(res, (dynamic d) {
      final m = d as Map<String, dynamic>;
      return (
        routes: (m['routes'] as List<dynamic>? ?? const [])
            .map((dynamic r) => (id: '${(r as Map)['id']}', name: '${r['name']}'))
            .toList(),
        runs: (m['runs'] as List<dynamic>? ?? const [])
            .map((dynamic r) => CollectionRun.fromJson(Map<String, dynamic>.from(r as Map)))
            .toList(),
      );
    });
  }

  Future<CollectionRun> openRun({
    required String routeId,
    double? lat,
    double? lng,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.runOpen,
      data: {
        'routeId': routeId,
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => CollectionRun.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<RunSheet> fetchSheet(String runId) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.runSheet(runId));
    return unwrapEnvelope(res, (dynamic d) {
      final m = d as Map<String, dynamic>;
      final run = CollectionRun.fromJson(m['run'] as Map<String, dynamic>);
      final rows = (m['sheet'] as List<dynamic>? ?? const [])
          .map((dynamic e) => RunSheetRow.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
      return RunSheet(run: run, rows: rows);
    });
  }

  /// Posts a batch of lines. Returns {posted, skipped} counts.
  Future<({int posted, int skipped})> collect(
    String runId,
    List<Map<String, dynamic>> lines,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.runCollect(runId),
      data: {'lines': lines},
    );
    return unwrapEnvelope(res, (dynamic d) {
      final m = d as Map<String, dynamic>;
      final posted = (m['posted'] as List<dynamic>? ?? const []).length;
      final skipped = (m['skipped'] as List<dynamic>? ?? const []).length;
      return (posted: posted, skipped: skipped);
    });
  }

  Future<CollectionRun> close(String runId) async {
    final res =
        await _dio.post<Map<String, dynamic>>(Endpoints.runClose(runId));
    return unwrapEnvelope(
      res,
      (dynamic d) => CollectionRun.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<CollectionRun> reconcile(
    String runId, {
    required double cashDeposited,
    String? depositRef,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.runReconcile(runId),
      data: {
        'cashDeposited': cashDeposited,
        if (depositRef != null) 'depositRef': depositRef,
        if (note != null) 'note': note,
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => CollectionRun.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Generates a borrower self-pay link for an instalment. Returns the pay URL.
  Future<String> selfPayLink(String instalmentId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.selfPayLink,
      data: {'instalmentId': instalmentId},
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => (d as Map<String, dynamic>)['payUrl'] as String? ?? '',
    );
  }
}

final collectionRunServiceProvider = Provider<CollectionRunService>(
  (ref) => CollectionRunService(ref.watch(dioProvider)),
);
