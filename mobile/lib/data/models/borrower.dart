/// Borrower portal models — mirrors the web BorrowerDashboardClient.tsx types.

class BorrowerInstalment {
  const BorrowerInstalment({
    required this.id,
    required this.instNo,
    required this.dueDate,
    required this.dueAmount,
    required this.receivedAmount,
    required this.status,
    this.paidAt,
  });

  final String id;
  final int instNo;
  final DateTime dueDate;
  final double dueAmount;
  final double receivedAmount;
  final String status;
  final DateTime? paidAt;

  double get outstanding =>
      (dueAmount - receivedAmount).clamp(0, double.infinity);
  bool get isOverdue => status == 'overdue' || status == 'missed';
  bool get isPaid => status == 'paid';

  factory BorrowerInstalment.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return BorrowerInstalment(
      id: (json['id'] as String?) ?? '',
      instNo: (json['instNo'] as num?)?.toInt() ??
          (json['number'] as num?)?.toInt() ??
          0,
      dueDate: DateTime.parse(
          (json['dueDate'] as String?) ?? DateTime.now().toIso8601String()),
      dueAmount: n(json['dueAmount']),
      receivedAmount: n(json['receivedAmount']),
      status: (json['status'] as String?) ?? 'pending',
      paidAt: json['paidAt'] == null
          ? null
          : DateTime.tryParse(json['paidAt'] as String),
    );
  }
}

class BorrowerLoan {
  const BorrowerLoan({
    required this.id,
    required this.loanCode,
    required this.status,
    required this.principalAmount,
    required this.totalPayable,
    required this.interestRate,
    required this.tenure,
    required this.frequency,
    required this.instalments,
    this.disbursedAt,
    this.customerName,
    this.collectionPoint,
  });

  final String id;
  final String loanCode;
  final String status;
  final double principalAmount;
  final double totalPayable;
  final double interestRate;
  final int tenure;
  final String frequency;
  final List<BorrowerInstalment> instalments;
  final DateTime? disbursedAt;
  final String? customerName;
  final String? collectionPoint;

  double get totalPaid =>
      instalments.fold<double>(0, (s, i) => s + i.receivedAmount);
  double get outstandingBalance =>
      (totalPayable - totalPaid).clamp(0, double.infinity);
  double get paidPercent =>
      totalPayable > 0 ? (totalPaid / totalPayable * 100).clamp(0, 100) : 0;
  int get overdueCount => instalments.where((i) => i.isOverdue).length;
  double get overdueAmount => instalments
      .where((i) => i.isOverdue)
      .fold<double>(0, (s, i) => s + i.outstanding);
  BorrowerInstalment? get nextDue {
    final pending = instalments.where((i) => !i.isPaid).toList()
      ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
    return pending.isEmpty ? null : pending.first;
  }

  factory BorrowerLoan.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return BorrowerLoan(
      id: json['id'] as String,
      loanCode: (json['loanCode'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'active',
      principalAmount: n(json['principalAmount']),
      totalPayable: n(json['totalPayable']),
      interestRate: n(json['interestRate']),
      tenure: (json['tenure'] as num?)?.toInt() ?? 0,
      frequency: (json['frequency'] as String?) ?? 'daily',
      disbursedAt: json['disbursedAt'] == null
          ? null
          : DateTime.tryParse(json['disbursedAt'] as String),
      customerName: json['customerName'] as String?,
      collectionPoint: json['collectionPoint'] as String?,
      instalments: (json['instalments'] as List<dynamic>? ?? const [])
          .map((dynamic e) =>
              BorrowerInstalment.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

class PaymentSettings {
  const PaymentSettings({this.upiId, this.upiQrUrl});
  final String? upiId;
  final String? upiQrUrl;

  factory PaymentSettings.fromJson(Map<String, dynamic> json) {
    return PaymentSettings(
      upiId: json['upiId'] as String?,
      upiQrUrl: json['upiQrUrl'] as String?,
    );
  }
}

// ─── Portal (module-aware) ────────────────────────────────────────────────

/// Which modules this customer belongs to, plus chit memberships — from
/// GET /borrower/portal. The app routes on this instead of assuming every
/// customer is a loan borrower.
class BorrowerPortal {
  const BorrowerPortal({
    required this.loanCount,
    required this.chitCount,
    required this.chitMemberships,
  });

  final int loanCount;
  final int chitCount;
  final List<BorrowerChitMembership> chitMemberships;

  bool get hasLoans => loanCount > 0;
  bool get hasChits => chitCount > 0;

  factory BorrowerPortal.fromJson(Map<String, dynamic> json) {
    final modules = (json['modules'] as Map<String, dynamic>?) ?? const {};
    double? n(dynamic v) =>
        v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);
    return BorrowerPortal(
      loanCount: n(modules['loans'])?.toInt() ?? 0,
      chitCount: n(modules['chits'])?.toInt() ?? 0,
      chitMemberships: ((json['chitMemberships'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(BorrowerChitMembership.fromJson)
          .toList(growable: false),
    );
  }
}

class BorrowerChitMembership {
  const BorrowerChitMembership({
    required this.memberId,
    required this.ticketNo,
    required this.hasWon,
    required this.subscriberStatus,
    required this.groupId,
    required this.groupName,
    required this.groupCode,
    required this.chitValue,
    required this.monthlyContrib,
    required this.durationMonths,
    required this.groupStatus,
    this.nextAuctionPeriod,
    this.nextAuctionDate,
    this.nextAuctionRoomStatus,
    this.nextDueDate,
    this.nextDueAmount,
    this.nextDuePaid,
    this.nextDueStatus,
  });

  final String memberId;
  final String? ticketNo;
  final bool hasWon;
  final String subscriberStatus;
  final String groupId;
  final String groupName;
  final String? groupCode;
  final double chitValue;
  final double monthlyContrib;
  final int durationMonths;
  final String groupStatus;
  final int? nextAuctionPeriod;
  final DateTime? nextAuctionDate;
  final String? nextAuctionRoomStatus;
  final DateTime? nextDueDate;
  final double? nextDueAmount;
  final double? nextDuePaid;
  final String? nextDueStatus;

  double get nextDueOutstanding =>
      ((nextDueAmount ?? 0) - (nextDuePaid ?? 0)).clamp(0, double.infinity);

  factory BorrowerChitMembership.fromJson(Map<String, dynamic> json) {
    double? n(dynamic v) =>
        v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);
    final group = (json['group'] as Map<String, dynamic>?) ?? const {};
    final auction = json['nextAuction'] as Map<String, dynamic>?;
    final due = json['nextDue'] as Map<String, dynamic>?;
    return BorrowerChitMembership(
      memberId: (json['memberId'] as String?) ?? '',
      ticketNo: json['ticketNo']?.toString(),
      hasWon: (json['hasWon'] as bool?) ?? false,
      subscriberStatus: (json['subscriberStatus'] as String?) ?? 'active',
      groupId: (group['id'] as String?) ?? '',
      groupName: (group['name'] as String?) ?? '',
      groupCode: group['groupCode'] as String?,
      chitValue: n(group['chitValue']) ?? 0,
      monthlyContrib: n(group['monthlyContrib']) ?? 0,
      durationMonths: n(group['durationMonths'])?.toInt() ?? 0,
      groupStatus: (group['status'] as String?) ?? 'active',
      nextAuctionPeriod: n(auction?['periodNumber'])?.toInt(),
      nextAuctionDate: DateTime.tryParse(
        (auction?['scheduledAt'] ?? auction?['auctionDate'] ?? '') as String,
      ),
      nextAuctionRoomStatus: auction?['roomStatus'] as String?,
      nextDueDate: DateTime.tryParse((due?['dueDate'] ?? '') as String),
      nextDueAmount: n(due?['dueAmount']),
      nextDuePaid: n(due?['paidAmount']),
      nextDueStatus: due?['status'] as String?,
    );
  }
}
