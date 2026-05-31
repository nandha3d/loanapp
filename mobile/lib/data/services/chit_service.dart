import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class ChitService {
  ChitService(this._dio);
  final Dio _dio;

  Future<List<ChitGroup>> list() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.chits);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => ChitGroup.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  Future<Map<String, dynamic>> getById(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.chit(id));
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  Future<List<ChitMember>> members(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.chitMembers(id));
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => ChitMember.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  Future<List<ChitAuction>> auctions(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.chitAuctions(id));
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => ChitAuction.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  /// Records (or updates) an auction result for a period. Commission/dividend
  /// are computed server-side from the group config — no client math.
  Future<void> recordAuction(
    String groupId, {
    required int periodNumber,
    String? winnerMemberId,
    double? prizeAmount,
    double? bidDiscount,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitAuctions(groupId),
      data: {
        'periodNumber': periodNumber,
        if (winnerMemberId != null) 'winnerMemberId': winnerMemberId,
        if (prizeAmount != null) 'prizeAmount': prizeAmount,
        if (bidDiscount != null) 'bidDiscount': bidDiscount,
      },
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final chitServiceProvider = Provider<ChitService>(
  (ref) => ChitService(ref.watch(dioProvider)),
);
