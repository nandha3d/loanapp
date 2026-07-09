/// Models for the live chit auction ("poker table"). Parse-only, matching the
/// null-safe style of the rest of `data/models`. The server is authoritative for
/// all money math and the countdown clock.

double _d(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
double? _dn(dynamic v) =>
    v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));
int _i(dynamic v) =>
    v == null ? 0 : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? 0);

/// The current leading (lowest-prize) bid.
class CurrentBest {
  const CurrentBest({
    required this.memberId,
    required this.prizeAmount,
    required this.discountAmount,
  });
  final String memberId;
  final double prizeAmount;
  final double discountAmount;

  factory CurrentBest.fromJson(Map<String, dynamic> j) => CurrentBest(
        memberId: (j['memberId'] as String?) ?? '',
        prizeAmount: _d(j['prizeAmount']),
        discountAmount: _d(j['discountAmount']),
      );
}

/// One seat at the table.
class SeatState {
  const SeatState({
    required this.memberId,
    required this.memberNumber,
    required this.name,
    required this.customerCode,
    required this.hasWon,
    required this.passed,
    this.profilePhoto,
    this.latestPrize,
  });
  final String memberId;
  final int memberNumber;
  final String name;
  final String customerCode;
  final bool hasWon;
  final bool passed;
  final String? profilePhoto;
  final double? latestPrize;

  bool get active => !hasWon && !passed;

  factory SeatState.fromJson(Map<String, dynamic> j) => SeatState(
        memberId: (j['memberId'] as String?) ?? '',
        memberNumber: _i(j['memberNumber']),
        name: (j['name'] as String?) ?? '—',
        customerCode: (j['customerCode'] as String?) ?? '',
        hasWon: (j['hasWon'] as bool?) ?? false,
        passed: (j['passed'] as bool?) ?? false,
        profilePhoto: j['profilePhoto'] as String?,
        latestPrize: _dn(j['latestPrize']),
      );
}

/// A single bid/pass/retraction in the stream.
class LiveBid {
  const LiveBid({
    required this.id,
    required this.memberId,
    required this.prizeAmount,
    required this.discountAmount,
    required this.kind,
    required this.source,
    required this.createdAt,
  });
  final String id;
  final String memberId;
  final double prizeAmount;
  final double discountAmount;
  final String kind; // bid | pass | retracted
  final String source; // tap | voice | remote
  final DateTime createdAt;

  factory LiveBid.fromJson(Map<String, dynamic> j) => LiveBid(
        id: (j['id'] as String?) ?? '',
        memberId: (j['memberId'] as String?) ?? '',
        prizeAmount: _d(j['prizeAmount']),
        discountAmount: _d(j['discountAmount']),
        kind: (j['kind'] as String?) ?? 'bid',
        source: (j['source'] as String?) ?? 'tap',
        createdAt: DateTime.tryParse((j['createdAt'] as String?) ?? '')?.toLocal() ??
            DateTime.now(),
      );
}

/// A minutes-trail event (open/extend/close/winner/cancel).
class AuctionEvent {
  const AuctionEvent({
    required this.id,
    required this.type,
    required this.createdAt,
    this.message,
    this.memberId,
    this.amount,
  });
  final String id;
  final String type;
  final DateTime createdAt;
  final String? message;
  final String? memberId;
  final double? amount;

  factory AuctionEvent.fromJson(Map<String, dynamic> j) => AuctionEvent(
        id: (j['id'] as String?) ?? '',
        type: (j['type'] as String?) ?? '',
        createdAt: DateTime.tryParse((j['createdAt'] as String?) ?? '')?.toLocal() ??
            DateTime.now(),
        message: j['message'] as String?,
        memberId: j['memberId'] as String?,
        amount: _dn(j['amount']),
      );
}

/// Settlement result echoed back after close.
class AuctionSettlement {
  const AuctionSettlement({
    required this.winnerMemberId,
    required this.prizeAmount,
    required this.bidDiscount,
    required this.commission,
    required this.dividend,
  });
  final String winnerMemberId;
  final double prizeAmount;
  final double bidDiscount;
  final double commission;
  final double dividend;

  factory AuctionSettlement.fromJson(Map<String, dynamic> j) => AuctionSettlement(
        winnerMemberId: (j['winnerMemberId'] as String?) ?? '',
        prizeAmount: _d(j['prizeAmount']),
        bidDiscount: _d(j['bidDiscount']),
        commission: _d(j['commission']),
        dividend: _d(j['dividend']),
      );
}

/// Full live-auction state snapshot from `…/state` (or returned by write routes).
class LiveAuctionState {
  const LiveAuctionState({
    required this.auctionId,
    required this.periodNumber,
    required this.status,
    required this.serverNow,
    required this.receivedAt,
    required this.countdownSeconds,
    required this.minBidDecrement,
    required this.chitValue,
    required this.totalMembers,
    required this.seats,
    required this.activeCount,
    required this.recentBids,
    required this.events,
    this.startedAt,
    this.endsAt,
    this.currentBest,
    this.winner,
    this.settlement,
    this.autoClose = false,
  });

  final String auctionId;
  final int periodNumber;
  final String status; // pending | live | completed
  final DateTime serverNow;

  /// Device time when this snapshot was parsed — lets us offset the countdown
  /// against the server clock so a skewed device still ticks accurately.
  final DateTime receivedAt;
  final int countdownSeconds;
  final double minBidDecrement;
  final double chitValue;
  final int totalMembers;
  final List<SeatState> seats;
  final int activeCount;
  final List<LiveBid> recentBids;
  final List<AuctionEvent> events;
  final DateTime? startedAt;
  final DateTime? endsAt;
  final CurrentBest? currentBest;
  final AuctionSettlement? winner;
  final AuctionSettlement? settlement;
  final bool autoClose;

  bool get isLive => status == 'live';
  bool get isCompleted => status == 'completed';

  /// The lowest prize on the table right now (full chit value if no bid yet).
  double get currentPrize => currentBest?.prizeAmount ?? chitValue;
  double get currentDiscount => chitValue - currentPrize;

  /// Seconds left, server-authoritative and adjusted for device clock skew.
  Duration remaining(DateTime deviceNow) {
    if (endsAt == null) return Duration.zero;
    final skew = deviceNow.difference(receivedAt);
    final serverEstimatedNow = serverNow.add(skew);
    final left = endsAt!.difference(serverEstimatedNow);
    return left.isNegative ? Duration.zero : left;
  }

  SeatState? seatOf(String memberId) {
    for (final s in seats) {
      if (s.memberId == memberId) return s;
    }
    return null;
  }

  factory LiveAuctionState.fromJson(Map<String, dynamic> j) {
    List<T> parseList<T>(String key, T Function(Map<String, dynamic>) f) {
      final raw = j[key] as List<dynamic>?;
      if (raw == null) return const [];
      return raw
          .map((dynamic e) => f(e as Map<String, dynamic>))
          .toList(growable: false);
    }

    return LiveAuctionState(
      auctionId: (j['auctionId'] as String?) ?? '',
      periodNumber: _i(j['periodNumber']),
      status: (j['status'] as String?) ?? 'pending',
      serverNow: DateTime.tryParse((j['serverNow'] as String?) ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
      receivedAt: DateTime.now(),
      countdownSeconds: _i(j['countdownSeconds']),
      minBidDecrement: _d(j['minBidDecrement']),
      chitValue: _d(j['chitValue']),
      totalMembers: _i(j['totalMembers']),
      seats: parseList('seats', SeatState.fromJson),
      activeCount: _i(j['activeCount']),
      recentBids: parseList('recentBids', LiveBid.fromJson),
      events: parseList('events', AuctionEvent.fromJson),
      startedAt: DateTime.tryParse((j['startedAt'] as String?) ?? '')?.toUtc(),
      endsAt: DateTime.tryParse((j['endsAt'] as String?) ?? '')?.toUtc(),
      currentBest: j['currentBest'] == null
          ? null
          : CurrentBest.fromJson(j['currentBest'] as Map<String, dynamic>),
      winner: j['winner'] == null
          ? null
          : AuctionSettlement.fromJson(j['winner'] as Map<String, dynamic>),
      settlement: j['settlement'] == null
          ? null
          : AuctionSettlement.fromJson(j['settlement'] as Map<String, dynamic>),
      autoClose: (j['autoClose'] as bool?) ?? false,
    );
  }
}
