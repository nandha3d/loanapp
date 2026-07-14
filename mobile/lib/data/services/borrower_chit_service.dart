import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/models/chit_live.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

/// One-shot random key so a retried bid request (timeout, connectivity blip)
/// replays the original result instead of creating a duplicate — no `uuid`
/// package dependency needed for a value that's only ever compared for equality.
String _newIdempotencyKey() {
  final rand = Random.secure();
  final bytes = List<int>.generate(16, (_) => rand.nextInt(256));
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

/// Customer-facing counterpart of [ChitService]'s auction methods — every
/// call is scoped server-side to the authenticated customer's own ticket.
class BorrowerChitService {
  BorrowerChitService(this._dio);
  final Dio _dio;

  Future<CustomerLiveAuctionState> liveState(String groupId, String auctionId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.borrowerChitAuctionLive(groupId, auctionId),
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => CustomerLiveAuctionState.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Full chronological auction activity feed, scoped to this member's
  /// audience (organizer-only chat and, if sealed, other members' bid
  /// amounts are excluded server-side). Fetched on-demand, not part of the
  /// hot room poll.
  Future<Map<String, dynamic>> timeline(String groupId, String auctionId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.borrowerChitAuctionTimeline(groupId, auctionId),
    );
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  Future<String> join(String groupId, String auctionId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.borrowerChitAuctionJoin(groupId, auctionId),
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => (d as Map<String, dynamic>)['admissionStatus'] as String? ?? 'waiting',
    );
  }

  Future<ChitBid> placeBid(
    String groupId,
    String auctionId, {
    required double prizeAmount,
    String source = 'tap',
    String? transcript,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.borrowerChitAuctionBids(groupId, auctionId),
      data: {
        'prizeAmount': prizeAmount,
        'source': source,
        if (transcript != null && transcript.trim().isNotEmpty)
          'transcript': transcript.trim(),
        // Client-generated once per bid attempt: a retried request (timeout,
        // connectivity blip) with the same key replays the original result
        // instead of creating a duplicate bid.
        'idempotencyKey': _newIdempotencyKey(),
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => ChitBid.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<List<RoomMessage>> messages(String groupId, String auctionId, {String? sinceMessageId}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.borrowerChitAuctionMessages(groupId, auctionId),
      queryParameters: sinceMessageId == null ? null : {'since': sinceMessageId},
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => RoomMessage.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  Future<RoomMessage> sendMessage(String groupId, String auctionId, String body) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.borrowerChitAuctionMessages(groupId, auctionId),
      data: {'body': body},
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => RoomMessage.fromJson(d as Map<String, dynamic>),
    );
  }
}

final borrowerChitServiceProvider = Provider<BorrowerChitService>(
  (ref) => BorrowerChitService(ref.watch(dioProvider)),
);
