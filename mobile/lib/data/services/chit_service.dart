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
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.chitAuctions(id));
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

  Future<void> collectContribution(
    String groupId, {
    required String memberId,
    required int periodNumber,
    required double amount,
    required String paymentMode,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitPayments(groupId),
      data: {
        'memberId': memberId,
        'periodNumber': periodNumber,
        'paidAmount': amount,
        'paymentMode': paymentMode,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  /// Create a new chit group.
  Future<Map<String, dynamic>> create({
    required String name,
    required double chitValue,
    required double monthlyContrib,
    required int totalMembers,
    required double commissionPct,
    required String startDate,
    required List<String> memberIds,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chits,
      data: {
        'name': name,
        'chitValue': chitValue,
        'monthlyContrib': monthlyContrib,
        'totalMembers': totalMembers,
        'commissionPct': commissionPct,
        'startDate': startDate,
        'memberIds': memberIds,
      },
    );
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  /// Update an existing chit group.
  Future<void> update(
    String id, {
    String? name,
    double? chitValue,
    double? monthlyContrib,
    int? totalMembers,
    double? commissionPct,
    String? startDate,
  }) async {
    final res = await _dio.put<Map<String, dynamic>>(
      Endpoints.chit(id),
      data: {
        if (name != null) 'name': name,
        if (chitValue != null) 'chitValue': chitValue,
        if (monthlyContrib != null) 'monthlyContrib': monthlyContrib,
        if (totalMembers != null) 'totalMembers': totalMembers,
        if (commissionPct != null) 'commissionPct': commissionPct,
        if (startDate != null) 'startDate': startDate,
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  /// Cancel a chit group.
  Future<void> cancel(String id) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitCancel(id),
    );
    unwrapEnvelope(res, (_) => null);
  }

  /// Fetch subscription payments for a group.
  Future<List<ChitSubscription>> subscriptions(String groupId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.chitSubscriptions(groupId),
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) =>
              ChitSubscription.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  /// Mark a subscription period as missed.
  Future<void> markMissed(String subscriptionId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitSubscriptionMiss(subscriptionId),
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final chitServiceProvider = Provider<ChitService>(
  (ref) => ChitService(ref.watch(dioProvider)),
);
