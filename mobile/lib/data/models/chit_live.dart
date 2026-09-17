/// Models for the live chit auction ("poker table"). Parse-only, matching the
/// null-safe style of the rest of `data/models`. The server is authoritative for
/// all money math and the countdown clock.

double _d(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
double? _dn(dynamic v) =>
    v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));
int _i(dynamic v) =>
    v == null ? 0 : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? 0);

/// Organizer bell ("going once / going twice / sold") state — shared shape
/// returned by both the staff and customer live-room poll payloads.
class ChitBellState {
  const ChitBellState({
    required this.enabled,
    required this.bellsRung,
    required this.bellCount,
    required this.intervalSeconds,
    required this.autoClose,
  });

  final bool enabled;
  final int bellsRung;
  final int bellCount;
  final int intervalSeconds;
  final bool autoClose;

  bool get finalBellRung => bellsRung >= bellCount && bellCount > 0;

  factory ChitBellState.fromJson(Map<String, dynamic>? j) {
    if (j == null) {
      return const ChitBellState(enabled: false, bellsRung: 0, bellCount: 0, intervalSeconds: 60, autoClose: true);
    }
    return ChitBellState(
      enabled: (j['enabled'] as bool?) ?? false,
      bellsRung: _i(j['bellsRung']),
      bellCount: _i(j['bellCount']),
      intervalSeconds: _i(j['intervalSeconds']),
      autoClose: (j['autoClose'] as bool?) ?? true,
    );
  }

  /// "Going once!" / "Going twice!" / "Sold to ticket #X!" — mirrors the
  /// web's bellPhrase helper so the wording matches across clients.
  String phrase({String? winnerTicketNo}) {
    if (bellsRung >= bellCount) {
      return winnerTicketNo != null ? 'Sold to ticket #$winnerTicketNo!' : 'Sold!';
    }
    if (bellsRung == bellCount - 1) return 'Going twice!';
    return 'Going once!';
  }
}

/// The current leading (lowest-prize) bid.
class CurrentBest {
  const CurrentBest({
    required this.bidId,
    required this.memberId,
    required this.prizeAmount,
    required this.discountAmount,
  });
  final String bidId;
  final String memberId;
  final double prizeAmount;
  final double discountAmount;

  factory CurrentBest.fromJson(Map<String, dynamic> j) => CurrentBest(
        bidId: (j['bidId'] as String?) ?? '',
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
/// One live-room chat message (public, or private to the organizer).
class RoomMessage {
  const RoomMessage({
    required this.id,
    required this.senderName,
    required this.visibility,
    required this.body,
    required this.createdAt,
  });
  final String id;
  final String senderName;
  final String visibility; // public | organizer
  final String body;
  final DateTime createdAt;

  bool get isPrivate => visibility == 'organizer';

  factory RoomMessage.fromJson(Map<String, dynamic> j) => RoomMessage(
        id: (j['id'] as String?) ?? '',
        senderName: (j['senderName'] as String?) ?? '—',
        visibility: (j['visibility'] as String?) ?? 'public',
        body: (j['body'] as String?) ?? '',
        createdAt:
            DateTime.tryParse((j['createdAt'] as String?) ?? '')?.toLocal() ??
                DateTime.now(),
      );
}

/// A member waiting in the admission lobby (roomAdmission = 'approval').
class WaitingMember {
  const WaitingMember({required this.memberId, required this.name});
  final String memberId;
  final String name;

  factory WaitingMember.fromJson(Map<String, dynamic> j) => WaitingMember(
        memberId: (j['memberId'] as String?) ?? '',
        name: (j['name'] as String?) ?? '—',
      );
}

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
    required this.allBids,
    required this.memberBids,
    required this.events,
    this.minNextPrize,
    this.startedAt,
    this.endsAt,
    this.currentBest,
    this.winner,
    this.settlement,
    this.autoClose = false,
    this.roomAdmission = 'auto',
    this.latestMessages = const [],
    this.waiting = const [],
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
  final List<LiveBid> allBids;
  final Map<String, List<LiveBid>> memberBids;
  final List<AuctionEvent> events;
  final double? minNextPrize;
  final DateTime? startedAt;
  final DateTime? endsAt;
  final CurrentBest? currentBest;
  final AuctionSettlement? winner;
  final AuctionSettlement? settlement;
  final bool autoClose;
  final String roomAdmission; // auto | approval
  final List<RoomMessage> latestMessages;
  final List<WaitingMember> waiting;

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

    Map<String, List<LiveBid>> parseMemberBids() {
      final raw = j['memberBids'];
      if (raw is! Map) return const <String, List<LiveBid>>{};
      return raw.map((dynamic key, dynamic value) {
        final bids = value is List
            ? value
                .map((dynamic e) => LiveBid.fromJson(e as Map<String, dynamic>))
                .toList(growable: false)
            : const <LiveBid>[];
        return MapEntry(key.toString(), bids);
      });
    }

    final recentBids = parseList('recentBids', LiveBid.fromJson);
    final allBids = parseList('allBids', LiveBid.fromJson);

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
      recentBids: recentBids,
      allBids: allBids.isEmpty ? recentBids : allBids,
      memberBids: parseMemberBids(),
      events: parseList('events', AuctionEvent.fromJson),
      minNextPrize: _dn(j['minNextPrize']),
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
      roomAdmission: (j['roomAdmission'] as String?) ?? 'auto',
      latestMessages: parseList('latestMessages', RoomMessage.fromJson),
      waiting: parseList('waiting', WaitingMember.fromJson),
    );
  }
}

/// Anonymized leading bid shown to customers — ticket number only, no name.
class CustomerHighestBid {
  const CustomerHighestBid({
    required this.ticketNo,
    required this.bidAmount,
    required this.bidDiscount,
  });
  final String? ticketNo;
  final double bidAmount;
  final double bidDiscount;

  factory CustomerHighestBid.fromJson(Map<String, dynamic> j) => CustomerHighestBid(
        ticketNo: j['ticketNo'] as String?,
        bidAmount: _d(j['bidAmount']),
        bidDiscount: _d(j['bidDiscount']),
      );
}

/// One of the customer's own bids in this auction.
class CustomerOwnBid {
  const CustomerOwnBid({
    required this.id,
    required this.bidAmount,
    required this.bidDiscount,
    required this.source,
    required this.createdAt,
  });
  final String id;
  final double bidAmount;
  final double bidDiscount;
  final String source; // tap | voice | remote
  final DateTime createdAt;

  factory CustomerOwnBid.fromJson(Map<String, dynamic> j) => CustomerOwnBid(
        id: (j['id'] as String?) ?? '',
        bidAmount: _d(j['bidAmount']),
        bidDiscount: _d(j['bidDiscount']),
        source: (j['source'] as String?) ?? 'tap',
        createdAt: DateTime.tryParse((j['createdAt'] as String?) ?? '')?.toLocal() ??
            DateTime.now(),
      );
}

/// The authenticated customer's own seat in this room.
class CustomerMembership {
  const CustomerMembership({
    required this.memberId,
    required this.ticketNo,
    required this.hasWon,
    required this.subscriberStatus,
    required this.admissionStatus,
  });
  final String memberId;
  final String? ticketNo;
  final bool hasWon;
  final String subscriberStatus;
  final String admissionStatus; // not_joined | waiting | admitted | denied

  bool get isWaiting => admissionStatus == 'waiting';
  bool get isAdmitted => admissionStatus == 'admitted';
  bool get isDenied => admissionStatus == 'denied';
  bool get notJoined => admissionStatus == 'not_joined';

  factory CustomerMembership.fromJson(Map<String, dynamic> j) => CustomerMembership(
        memberId: (j['memberId'] as String?) ?? '',
        ticketNo: j['ticketNo'] as String?,
        hasWon: (j['hasWon'] as bool?) ?? false,
        subscriberStatus: (j['subscriberStatus'] as String?) ?? 'active',
        admissionStatus: (j['admissionStatus'] as String?) ?? 'not_joined',
      );
}

/// One seat at the table, as a customer sees it — same roster the staff
/// poker table shows, minus staff-only controls.
class CustomerSeat {
  const CustomerSeat({
    required this.memberId,
    required this.ticketNo,
    required this.name,
    required this.hasWon,
    required this.isMe,
    required this.isLeader,
    this.profilePhoto,
    this.latestDiscount,
  });
  final String memberId;
  final String? ticketNo;
  final String name;
  final bool hasWon;
  final bool isMe;
  final bool isLeader;
  final String? profilePhoto;
  final double? latestDiscount;

  factory CustomerSeat.fromJson(Map<String, dynamic> j) => CustomerSeat(
        memberId: (j['memberId'] as String?) ?? '',
        ticketNo: j['ticketNo'] as String?,
        name: (j['name'] as String?) ?? '—',
        hasWon: (j['hasWon'] as bool?) ?? false,
        isMe: (j['isMe'] as bool?) ?? false,
        isLeader: (j['isLeader'] as bool?) ?? false,
        profilePhoto: j['profilePhoto'] as String?,
        latestDiscount: _dn(j['latestDiscount']),
      );
}

/// Customer-facing live-room snapshot — GET /borrower/chits/:id/auctions/:auctionId/live.
class CustomerLiveAuctionState {
  const CustomerLiveAuctionState({
    required this.roomStatus,
    required this.auctionStatus,
    required this.auctionType,
    required this.roomAdmission,
    required this.serverTime,
    required this.receivedAt,
    required this.secondsRemaining,
    required this.autoExtendSeconds,
    required this.chitValue,
    required this.membership,
    required this.myBids,
    required this.isRoomOpen,
    this.minDiscountPct,
    this.maxDiscountPct,
    this.bidIncrement,
    this.minNextDiscount,
    this.currentHighestBid,
    this.myLatestBid,
    this.winnerTicketNo,
    this.winnerIsMe = false,
    this.latestMessages = const [],
    this.seats = const [],
    this.bell = const ChitBellState(enabled: false, bellsRung: 0, bellCount: 0, intervalSeconds: 60, autoClose: true),
  });

  final String roomStatus; // scheduled | open | extended | closed
  final String auctionStatus; // pending | in_progress | confirmed | paid | cancelled
  final String auctionType;
  final String roomAdmission; // auto | approval
  final DateTime serverTime;
  final DateTime receivedAt;
  final int secondsRemaining;
  final int autoExtendSeconds;
  final double chitValue;
  final List<CustomerSeat> seats;
  final double? minDiscountPct;
  final double? maxDiscountPct;
  final double? bidIncrement;
  final double? minNextDiscount;
  final CustomerHighestBid? currentHighestBid;
  final CustomerMembership membership;
  final List<CustomerOwnBid> myBids;
  final CustomerOwnBid? myLatestBid;
  final bool isRoomOpen;
  final String? winnerTicketNo;
  final bool winnerIsMe;
  final List<RoomMessage> latestMessages;
  final ChitBellState bell;

  bool get roomLive => roomStatus == 'open' || roomStatus == 'extended';

  /// Countdown adjusted for device clock skew, same pattern as [LiveAuctionState].
  int displaySeconds(DateTime deviceNow) {
    final elapsed = deviceNow.difference(receivedAt).inSeconds;
    final left = secondsRemaining - elapsed;
    return left < 0 ? 0 : left;
  }

  factory CustomerLiveAuctionState.fromJson(Map<String, dynamic> j) {
    final bidsRaw = j['myBids'] as List<dynamic>?;
    final myBids = bidsRaw == null
        ? const <CustomerOwnBid>[]
        : bidsRaw
            .map((dynamic e) => CustomerOwnBid.fromJson(e as Map<String, dynamic>))
            .toList(growable: false);
    final messagesRaw = j['latestMessages'] as List<dynamic>?;
    final seatsRaw = j['seats'] as List<dynamic>?;
    final winner = j['winner'] as Map<String, dynamic>?;

    return CustomerLiveAuctionState(
      roomStatus: (j['roomStatus'] as String?) ?? 'scheduled',
      auctionStatus: (j['auctionStatus'] as String?) ?? 'pending',
      auctionType: (j['auctionType'] as String?) ?? 'open_live',
      roomAdmission: (j['roomAdmission'] as String?) ?? 'auto',
      serverTime: DateTime.tryParse((j['serverTime'] as String?) ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
      receivedAt: DateTime.now(),
      secondsRemaining: _i(j['secondsRemaining']),
      autoExtendSeconds: _i(j['autoExtendSeconds']),
      chitValue: _d(j['chitValue']),
      minDiscountPct: _dn(j['minDiscountPct']),
      maxDiscountPct: _dn(j['maxDiscountPct']),
      bidIncrement: _dn(j['bidIncrement']),
      minNextDiscount: _dn(j['minNextDiscount']),
      currentHighestBid: j['currentHighestBid'] == null
          ? null
          : CustomerHighestBid.fromJson(j['currentHighestBid'] as Map<String, dynamic>),
      membership: CustomerMembership.fromJson(
          (j['myMembership'] as Map<String, dynamic>?) ?? const {},
        ),
      myBids: myBids,
      myLatestBid: myBids.isEmpty ? null : myBids.first,
      isRoomOpen: (j['isRoomOpen'] as bool?) ?? false,
      winnerTicketNo: winner?['ticketNo'] as String?,
      winnerIsMe: (winner?['isMe'] as bool?) ?? false,
      latestMessages: messagesRaw == null
          ? const []
          : messagesRaw
              .map((dynamic e) => RoomMessage.fromJson(e as Map<String, dynamic>))
              .toList(growable: false),
      seats: seatsRaw == null
          ? const []
          : seatsRaw
              .map((dynamic e) => CustomerSeat.fromJson(e as Map<String, dynamic>))
              .toList(growable: false),
      bell: ChitBellState.fromJson(j['bell'] as Map<String, dynamic>?),
    );
  }
}
