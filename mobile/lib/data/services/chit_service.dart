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

  Future<ChitBid> addBid(
    String groupId,
    String auctionId, {
    required String memberId,
    required double bidAmount,
    double? bidDiscount,
    String? remarks,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitAuctionBids(groupId, auctionId),
      data: {
        'memberId': memberId,
        'bidAmount': bidAmount,
        if (bidDiscount != null) 'bidDiscount': bidDiscount,
        if (remarks != null && remarks.trim().isNotEmpty)
          'remarks': remarks.trim(),
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => ChitBid.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<void> markAttendance(
    String groupId,
    String auctionId, {
    required String memberId,
    String status = 'present',
    String? proxyName,
    String? remarks,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitAuctionAttendance(groupId, auctionId),
      data: {
        'memberId': memberId,
        'status': status,
        if (proxyName != null && proxyName.trim().isNotEmpty)
          'proxyName': proxyName.trim(),
        if (remarks != null && remarks.trim().isNotEmpty)
          'remarks': remarks.trim(),
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> confirmAuction(
    String groupId,
    String auctionId, {
    String? winningBidId,
    String? minutesText,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitAuctionConfirm(groupId, auctionId),
      data: {
        if (winningBidId != null) 'winningBidId': winningBidId,
        if (minutesText != null && minutesText.trim().isNotEmpty)
          'minutesText': minutesText.trim(),
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> submitSecurity(
    String groupId,
    String auctionId, {
    required String securityType,
    double? securityValue,
    String? guarantorName,
    String? guarantorPhone,
    String? details,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitAuctionSecurity(groupId, auctionId),
      data: {
        'action': 'submit',
        'securityType': securityType,
        if (securityValue != null) 'securityValue': securityValue,
        if (guarantorName != null && guarantorName.trim().isNotEmpty)
          'guarantorName': guarantorName.trim(),
        if (guarantorPhone != null && guarantorPhone.trim().isNotEmpty)
          'guarantorPhone': guarantorPhone.trim(),
        if (details != null && details.trim().isNotEmpty)
          'details': details.trim(),
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> reviewSecurity(
    String groupId,
    String auctionId, {
    required String action,
    String? reason,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitAuctionSecurity(groupId, auctionId),
      data: {
        'action': action,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> releasePayout(
    String groupId,
    String auctionId, {
    String paymentMode = 'cash',
    String? referenceNo,
    String? notes,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitAuctionPayout(groupId, auctionId),
      data: {
        'paymentMode': paymentMode,
        if (referenceNo != null && referenceNo.trim().isNotEmpty)
          'referenceNo': referenceNo.trim(),
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
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
    String mode = 'ADD_PAYMENT',
    String? referenceNo,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitPayments(groupId),
      data: {
        'memberId': memberId,
        'periodNumber': periodNumber,
        'amount': amount,
        'mode': mode,
        'paymentMode': paymentMode,
        if (referenceNo != null && referenceNo.trim().isNotEmpty)
          'referenceNo': referenceNo.trim(),
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
    String chitType = 'unregistered',
    String auctionType = 'open_manual',
    String commissionBasis = 'BID_DISCOUNT',
    String dividendPolicy = 'ALL_MEMBERS',
    String dividendDistribution = 'ADJUST_NEXT_DUE',
    String tieBreakRule = 'EARLIEST_BID',
    double? fixedDiscountPct,
    double? gstPct,
    double? minDiscountPct,
    double? maxDiscountPct,
    double? bidIncrement,
    int? dividendRounding,
    bool? hasForemanTicket,
    Map<String, dynamic>? compliance,
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
        'chitType': chitType,
        'auctionType': auctionType,
        'commissionBasis': commissionBasis,
        'dividendPolicy': dividendPolicy,
        'dividendDistribution': dividendDistribution,
        'tieBreakRule': tieBreakRule,
        if (fixedDiscountPct != null) 'fixedDiscountPct': fixedDiscountPct,
        if (gstPct != null) 'gstPct': gstPct,
        if (minDiscountPct != null) 'minDiscountPct': minDiscountPct,
        if (maxDiscountPct != null) 'maxDiscountPct': maxDiscountPct,
        if (bidIncrement != null) 'bidIncrement': bidIncrement,
        if (dividendRounding != null) 'dividendRounding': dividendRounding,
        if (hasForemanTicket != null) 'hasForemanTicket': hasForemanTicket,
        if (compliance != null) ...compliance,
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
    String? chitType,
    String? auctionType,
    String? commissionBasis,
    String? dividendPolicy,
    String? dividendDistribution,
    String? tieBreakRule,
    double? fixedDiscountPct,
    double? gstPct,
    double? minDiscountPct,
    double? maxDiscountPct,
    double? bidIncrement,
    int? dividendRounding,
    bool? hasForemanTicket,
    Map<String, dynamic>? compliance,
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
        if (chitType != null) 'chitType': chitType,
        if (auctionType != null) 'auctionType': auctionType,
        if (commissionBasis != null) 'commissionBasis': commissionBasis,
        if (dividendPolicy != null) 'dividendPolicy': dividendPolicy,
        if (dividendDistribution != null)
          'dividendDistribution': dividendDistribution,
        if (tieBreakRule != null) 'tieBreakRule': tieBreakRule,
        if (fixedDiscountPct != null) 'fixedDiscountPct': fixedDiscountPct,
        if (gstPct != null) 'gstPct': gstPct,
        if (minDiscountPct != null) 'minDiscountPct': minDiscountPct,
        if (maxDiscountPct != null) 'maxDiscountPct': maxDiscountPct,
        if (bidIncrement != null) 'bidIncrement': bidIncrement,
        if (dividendRounding != null) 'dividendRounding': dividendRounding,
        if (hasForemanTicket != null) 'hasForemanTicket': hasForemanTicket,
        if (compliance != null) ...compliance,
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> activate(String id) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitActivate(id),
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> updateMember(
    String groupId,
    String memberId, {
    String? ticketNo,
    String? fractionNo,
    double? ticketShare,
    String? subscriberStatus,
    String? nomineeName,
    String? nomineeRelation,
    String? nomineePhone,
    String? introducedBy,
    bool? isForemanTicket,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.chitMember(groupId, memberId),
      data: {
        if (ticketNo != null) 'ticketNo': ticketNo,
        if (fractionNo != null) 'fractionNo': fractionNo,
        if (ticketShare != null) 'ticketShare': ticketShare,
        if (subscriberStatus != null) 'subscriberStatus': subscriberStatus,
        if (nomineeName != null) 'nomineeName': nomineeName,
        if (nomineeRelation != null) 'nomineeRelation': nomineeRelation,
        if (nomineePhone != null) 'nomineePhone': nomineePhone,
        if (introducedBy != null) 'introducedBy': introducedBy,
        if (isForemanTicket != null) 'isForemanTicket': isForemanTicket,
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> updateAgreement(
    String groupId,
    String memberId, {
    required String status,
    String? reason,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitMemberAgreement(groupId, memberId),
      data: {
        'status': status,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
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
          .map(
            (dynamic e) => ChitSubscription.fromJson(e as Map<String, dynamic>),
          )
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

  Future<void> reverseReceipt(
    String receiptId, {
    required String reason,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitReceiptReverse(receiptId),
      data: {'reason': reason},
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<List<Map<String, dynamic>>> penalties(String groupId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.chitPenalties(groupId),
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .toList(growable: false);
    });
  }

  Future<void> createPenalty(
    String groupId, {
    required String subscriptionId,
    required double amount,
    String penaltyType = 'late_fee',
    String? reason,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitPenalties(groupId),
      data: {
        'subscriptionId': subscriptionId,
        'amount': amount,
        'penaltyType': penaltyType,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> payPenalty(
    String groupId,
    String penaltyId, {
    required double amount,
    String paymentMode = 'cash',
    String? referenceNo,
    String? notes,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitPenaltyPay(groupId, penaltyId),
      data: {
        'amount': amount,
        'paymentMode': paymentMode,
        if (referenceNo != null && referenceNo.trim().isNotEmpty)
          'referenceNo': referenceNo.trim(),
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> waivePenalty(
    String groupId,
    String penaltyId, {
    double? amount,
    String? reason,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.chitPenaltyWaive(groupId, penaltyId),
      data: {
        if (amount != null) 'amount': amount,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final chitServiceProvider = Provider<ChitService>(
  (ref) => ChitService(ref.watch(dioProvider)),
);
