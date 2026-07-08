class ChitGroup {
  const ChitGroup({
    required this.id,
    required this.name,
    required this.chitValue,
    required this.monthlyContrib,
    required this.totalMembers,
    required this.durationMonths,
    required this.status,
    required this.startDate,
    required this.memberCount,
    required this.auctionCount,
    required this.commissionPct,
  });

  final String id;
  final String name;
  final double chitValue;
  final double monthlyContrib;
  final int totalMembers;
  final int durationMonths;
  final String status;
  final DateTime startDate;
  final int memberCount;
  final int auctionCount;
  final double commissionPct;

  factory ChitGroup.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final counts = (json['_count'] as Map<String, dynamic>?) ?? const {};
    return ChitGroup(
      id: json['id'] as String,
      name: json['name'] as String,
      chitValue: n(json['chitValue']),
      monthlyContrib: n(json['monthlyContrib']),
      totalMembers: (json['totalMembers'] as num?)?.toInt() ?? 0,
      durationMonths: (json['durationMonths'] as num?)?.toInt() ?? 0,
      status: (json['status'] as String?) ?? 'active',
      startDate: DateTime.parse(json['startDate'] as String),
      memberCount: (counts['members'] as num?)?.toInt() ?? 0,
      auctionCount: (counts['auctions'] as num?)?.toInt() ?? 0,
      commissionPct: n(json['commissionPct']),
    );
  }
}

class ChitSubscription {
  const ChitSubscription({
    required this.id,
    required this.periodNumber,
    required this.dueDate,
    required this.dueAmount,
    required this.paidAmount,
    required this.status,
    required this.memberId,
    required this.memberName,
  });

  final String id;
  final int periodNumber;
  final DateTime dueDate;
  final double dueAmount;
  final double paidAmount;
  final String status;
  final String memberId;
  final String memberName;

  double get outstanding => (dueAmount - paidAmount).clamp(0, double.infinity);

  factory ChitSubscription.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final member = json['member'] as Map<String, dynamic>?;
    final customer = member?['customer'] as Map<String, dynamic>?;
    return ChitSubscription(
      id: json['id'] as String,
      periodNumber: (json['periodNumber'] as num).toInt(),
      dueDate: DateTime.parse(json['dueDate'] as String),
      dueAmount: n(json['dueAmount']),
      paidAmount: n(json['paidAmount']),
      status: (json['status'] as String?) ?? 'pending',
      memberId: (member?['id'] as String?) ?? '',
      memberName: (customer?['name'] as String?) ?? '—',
    );
  }
}

class ChitMember {
  const ChitMember({
    required this.id,
    required this.memberNumber,
    required this.customerName,
    required this.customerCode,
    required this.hasWon,
  });
  final String id;
  final int memberNumber;
  final String customerName;
  final String customerCode;
  final bool hasWon;

  factory ChitMember.fromJson(Map<String, dynamic> json) {
    final c = (json['customer'] as Map<String, dynamic>?) ?? const {};
    return ChitMember(
      id: json['id'] as String,
      memberNumber: (json['memberNumber'] as num).toInt(),
      customerName: (c['name'] as String?) ?? '—',
      customerCode: (c['customerCode'] as String?) ?? '',
      hasWon: (json['hasWon'] as bool?) ?? false,
    );
  }
}

class ChitAuction {
  const ChitAuction({
    required this.id,
    required this.periodNumber,
    required this.status,
    this.winnerName,
    this.prizeAmount,
    this.dividend,
    this.auctionDate,
  });
  final String id;
  final int periodNumber;
  final String status;
  final String? winnerName;
  final double? prizeAmount;
  final double? dividend;
  final DateTime? auctionDate;

  factory ChitAuction.fromJson(Map<String, dynamic> json) {
    double? n(dynamic v) =>
        v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));
    final w = json['winnerMember'] as Map<String, dynamic>?;
    final wc = w == null ? null : w['customer'] as Map<String, dynamic>?;
    return ChitAuction(
      id: json['id'] as String,
      periodNumber: (json['periodNumber'] as num).toInt(),
      status: (json['status'] as String?) ?? 'pending',
      winnerName: wc?['name'] as String?,
      prizeAmount: n(json['prizeAmount']),
      dividend: n(json['dividend']),
      auctionDate: json['auctionDate'] == null
          ? null
          : DateTime.parse(json['auctionDate'] as String),
    );
  }
}
