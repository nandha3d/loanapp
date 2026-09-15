/// Payload of GET /api/v1/dashboard/chits — the chit-funds home dashboard.
/// Chit tenants land here instead of the lending DashboardSummary.
class ChitDashboardSummary {
  const ChitDashboardSummary({
    required this.activeGroups,
    required this.totalMembers,
    required this.auctionsThisMonth,
    required this.pendingApprovals,
    required this.todayExpected,
    required this.todayCollected,
    required this.todayGap,
    required this.hitRate,
    required this.totalOverdueAmount,
    required this.overdueMembersCount,
    this.overdueSubscriptions = const [],
    this.liveAuctions = const [],
    this.upcomingAuctions = const [],
    this.groups = const [],
  });

  final int activeGroups;
  final int totalMembers;
  final int auctionsThisMonth;
  final int pendingApprovals;
  final double todayExpected;
  final double todayCollected;
  final double todayGap;
  final double hitRate;
  final double totalOverdueAmount;
  final int overdueMembersCount;
  final List<ChitOverdueSubscription> overdueSubscriptions;
  final List<ChitAuctionBrief> liveAuctions;
  final List<ChitAuctionBrief> upcomingAuctions;
  final List<ChitGroupBrief> groups;

  factory ChitDashboardSummary.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return ChitDashboardSummary(
      activeGroups: (json['activeGroups'] as num?)?.toInt() ?? 0,
      totalMembers: (json['totalMembers'] as num?)?.toInt() ?? 0,
      auctionsThisMonth: (json['auctionsThisMonth'] as num?)?.toInt() ?? 0,
      pendingApprovals: (json['pendingApprovals'] as num?)?.toInt() ?? 0,
      todayExpected: toNum(json['todayExpected']),
      todayCollected: toNum(json['todayCollected']),
      todayGap: toNum(json['todayGap']),
      hitRate: toNum(json['hitRate']),
      totalOverdueAmount: toNum(json['totalOverdueAmount']),
      overdueMembersCount: (json['overdueMembersCount'] as num?)?.toInt() ?? 0,
      overdueSubscriptions:
          (json['overdueSubscriptions'] as List<dynamic>? ?? const [])
              .map((dynamic e) =>
                  ChitOverdueSubscription.fromJson(e as Map<String, dynamic>))
              .toList(growable: false),
      liveAuctions: (json['liveAuctions'] as List<dynamic>? ?? const [])
          .map((dynamic e) =>
              ChitAuctionBrief.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      upcomingAuctions: (json['upcomingAuctions'] as List<dynamic>? ?? const [])
          .map((dynamic e) =>
              ChitAuctionBrief.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      groups: (json['groups'] as List<dynamic>? ?? const [])
          .map(
              (dynamic e) => ChitGroupBrief.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

class ChitOverdueSubscription {
  const ChitOverdueSubscription({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.customerCode,
    required this.chitGroupId,
    required this.chitGroupName,
    required this.periodNumber,
    required this.overdueAmount,
    required this.daysOverdue,
    this.customerPhoto,
    this.dueDate,
  });

  final String id;
  final String customerId;
  final String customerName;
  final String customerCode;
  final String? customerPhoto;
  final String chitGroupId;
  final String chitGroupName;
  final int periodNumber;
  final double overdueAmount;
  final int daysOverdue;
  final DateTime? dueDate;

  factory ChitOverdueSubscription.fromJson(Map<String, dynamic> json) {
    return ChitOverdueSubscription(
      id: json['id'] as String? ?? '',
      customerId: json['customerId'] as String? ?? '',
      customerName: json['customerName'] as String? ?? '—',
      customerCode: json['customerCode'] as String? ?? '',
      customerPhoto: json['customerPhoto'] as String?,
      chitGroupId: json['chitGroupId'] as String? ?? '',
      chitGroupName: json['chitGroupName'] as String? ?? '',
      periodNumber: (json['periodNumber'] as num?)?.toInt() ?? 0,
      overdueAmount: (json['overdueAmount'] as num?)?.toDouble() ?? 0,
      daysOverdue: (json['daysOverdue'] as num?)?.toInt() ?? 0,
      dueDate: json['dueDate'] == null
          ? null
          : DateTime.tryParse(json['dueDate'] as String),
    );
  }
}

class ChitAuctionBrief {
  const ChitAuctionBrief({
    required this.id,
    required this.chitGroupId,
    required this.chitGroupName,
    required this.chitValue,
    required this.periodNumber,
    required this.roomStatus,
    this.auctionDate,
    this.scheduledAt,
  });

  final String id;
  final String chitGroupId;
  final String chitGroupName;
  final double chitValue;
  final int periodNumber;
  final String roomStatus;
  final DateTime? auctionDate;
  final DateTime? scheduledAt;

  bool get isLive => roomStatus == 'live';

  factory ChitAuctionBrief.fromJson(Map<String, dynamic> json) {
    return ChitAuctionBrief(
      id: json['id'] as String? ?? '',
      chitGroupId: json['chitGroupId'] as String? ?? '',
      chitGroupName: json['chitGroupName'] as String? ?? '',
      chitValue: (json['chitValue'] as num?)?.toDouble() ?? 0,
      periodNumber: (json['periodNumber'] as num?)?.toInt() ?? 0,
      roomStatus: json['roomStatus'] as String? ?? 'scheduled',
      auctionDate: json['auctionDate'] == null
          ? null
          : DateTime.tryParse(json['auctionDate'] as String),
      scheduledAt: json['scheduledAt'] == null
          ? null
          : DateTime.tryParse(json['scheduledAt'] as String),
    );
  }
}

class ChitGroupBrief {
  const ChitGroupBrief({
    required this.id,
    required this.name,
    required this.chitValue,
    required this.monthlyContrib,
    required this.totalMembers,
    required this.membersCount,
    required this.durationMonths,
    required this.currentPeriod,
    this.groupCode,
    this.startDate,
  });

  final String id;
  final String name;
  final String? groupCode;
  final double chitValue;
  final double monthlyContrib;
  final int totalMembers;
  final int membersCount;
  final int durationMonths;

  /// Highest completed auction period — 0 when no auction has run yet.
  final int currentPeriod;
  final DateTime? startDate;

  double get progress =>
      durationMonths > 0 ? (currentPeriod / durationMonths).clamp(0, 1).toDouble() : 0;

  factory ChitGroupBrief.fromJson(Map<String, dynamic> json) {
    return ChitGroupBrief(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      groupCode: json['groupCode'] as String?,
      chitValue: (json['chitValue'] as num?)?.toDouble() ?? 0,
      monthlyContrib: (json['monthlyContrib'] as num?)?.toDouble() ?? 0,
      totalMembers: (json['totalMembers'] as num?)?.toInt() ?? 0,
      membersCount: (json['membersCount'] as num?)?.toInt() ?? 0,
      durationMonths: (json['durationMonths'] as num?)?.toInt() ?? 0,
      currentPeriod: (json['currentPeriod'] as num?)?.toInt() ?? 0,
      startDate: json['startDate'] == null
          ? null
          : DateTime.tryParse(json['startDate'] as String),
    );
  }
}
