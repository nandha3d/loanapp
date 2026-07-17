// Doc 22b — current/overdue/upcoming/history grouped borrower contributions,
// and doc 19's payment-proof intents. Mirrors
// lib/chits/customerPortal.ts#getMyChitContributionsGrouped and
// lib/chits/paymentIntents.ts's serialized shapes. fromJson-only, matching
// the rest of this package's null-safe model style.

double _num(dynamic v) => v == null ? 0 : (v as num).toDouble();

class ChitContribution {
  const ChitContribution({
    required this.subscriptionId,
    required this.groupId,
    required this.groupName,
    required this.periodNumber,
    required this.dueDate,
    required this.baseDueAmount,
    required this.dividendAmount,
    required this.penaltyAmount,
    required this.netDue,
    required this.paidAmount,
    required this.outstanding,
    required this.status,
    this.ticketNo,
  });

  final String subscriptionId;
  final String groupId;
  final String groupName;
  final String? ticketNo;
  final int periodNumber;
  final DateTime dueDate;
  final double baseDueAmount;
  final double dividendAmount;
  final double penaltyAmount;
  final double netDue;
  final double paidAmount;
  final double outstanding;
  final String status;

  factory ChitContribution.fromJson(Map<String, dynamic> json) {
    return ChitContribution(
      subscriptionId: json['subscriptionId'] as String,
      groupId: json['groupId'] as String,
      groupName: (json['groupName'] as String?) ?? '',
      ticketNo: json['ticketNo'] as String?,
      periodNumber: (json['periodNumber'] as num).toInt(),
      dueDate: DateTime.parse(json['dueDate'] as String),
      baseDueAmount: _num(json['baseDueAmount']),
      dividendAmount: _num(json['dividendAmount']),
      penaltyAmount: _num(json['penaltyAmount']),
      netDue: _num(json['netDue']),
      paidAmount: _num(json['paidAmount']),
      outstanding: _num(json['outstanding']),
      status: (json['status'] as String?) ?? 'upcoming',
    );
  }
}

class ChitContributionGroup {
  const ChitContributionGroup({
    required this.groupId,
    required this.groupName,
    required this.overdue,
    required this.upcoming,
    required this.history,
    this.current,
  });

  final String groupId;
  final String groupName;
  final ChitContribution? current;
  final List<ChitContribution> overdue;
  final List<ChitContribution> upcoming;
  final List<ChitContribution> history;

  factory ChitContributionGroup.fromJson(Map<String, dynamic> json) {
    List<ChitContribution> parseList(String key) => ((json[key] as List<dynamic>?) ?? [])
        .map((dynamic e) => ChitContribution.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
    return ChitContributionGroup(
      groupId: json['groupId'] as String,
      groupName: (json['groupName'] as String?) ?? '',
      current: json['current'] != null ? ChitContribution.fromJson(json['current'] as Map<String, dynamic>) : null,
      overdue: parseList('overdue'),
      upcoming: parseList('upcoming'),
      history: parseList('history'),
    );
  }
}

class ChitReceiptSummary {
  const ChitReceiptSummary({
    required this.id,
    required this.receiptNo,
    required this.receiptType,
    required this.amount,
    required this.paymentMode,
    required this.issuedAt,
  });

  final String id;
  final String receiptNo;
  final String receiptType;
  final double amount;
  final String paymentMode;
  final DateTime issuedAt;

  factory ChitReceiptSummary.fromJson(Map<String, dynamic> json) {
    return ChitReceiptSummary(
      id: json['id'] as String,
      receiptNo: json['receiptNo'] as String,
      receiptType: (json['receiptType'] as String?) ?? '',
      amount: _num(json['amount']),
      paymentMode: (json['paymentMode'] as String?) ?? '',
      issuedAt: DateTime.parse(json['issuedAt'] as String),
    );
  }
}

/// Staff-side view of a customer "I've paid" claim — richer than the
/// borrower's own [ChitPaymentIntent] (member/group/period context plus the
/// duplicate-reference advisory flag). Mirrors
/// lib/chits/paymentIntents.ts#listChitPaymentIntentsForStaff.
class ChitStaffPaymentIntent {
  const ChitStaffPaymentIntent({
    required this.id,
    required this.status,
    required this.paymentMode,
    required this.createdAt,
    required this.memberName,
    required this.groupId,
    required this.groupName,
    required this.isDuplicateReference,
    this.amount,
    this.referenceNo,
    this.ticketNo,
    this.memberPhone,
    this.periodNumber,
    this.periodDueAmount,
    this.periodPaidAmount,
    this.proofUrl,
    this.rejectionReason,
    this.receiptNo,
  });

  final String id;
  final String status;
  final String paymentMode;
  final DateTime createdAt;
  final String memberName;
  final String groupId;
  final String groupName;
  final bool isDuplicateReference;
  final double? amount;
  final String? referenceNo;
  final String? ticketNo;
  final String? memberPhone;
  final int? periodNumber;
  final double? periodDueAmount;
  final double? periodPaidAmount;
  final String? proofUrl;
  final String? rejectionReason;
  final String? receiptNo;

  double? get periodOutstanding => periodDueAmount == null
      ? null
      : (periodDueAmount! - (periodPaidAmount ?? 0)).clamp(0, double.infinity);

  factory ChitStaffPaymentIntent.fromJson(Map<String, dynamic> json) {
    final period = json['period'] as Map<String, dynamic>?;
    return ChitStaffPaymentIntent(
      id: json['id'] as String,
      status: (json['status'] as String?) ?? 'pending',
      paymentMode: (json['paymentMode'] as String?) ?? 'upi',
      createdAt: DateTime.parse(json['createdAt'] as String),
      memberName: (json['memberName'] as String?) ?? '-',
      groupId: (json['groupId'] as String?) ?? '',
      groupName: (json['groupName'] as String?) ?? '',
      isDuplicateReference: (json['isDuplicateReference'] as bool?) ?? false,
      amount: json['amount'] != null ? _num(json['amount']) : null,
      referenceNo: json['referenceNo'] as String?,
      ticketNo: json['ticketNo'] as String?,
      memberPhone: json['memberPhone'] as String?,
      periodNumber: period != null ? (period['periodNumber'] as num?)?.toInt() : null,
      periodDueAmount: period != null ? _num(period['dueAmount']) : null,
      periodPaidAmount: period != null ? _num(period['paidAmount']) : null,
      proofUrl: json['proofUrl'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      receiptNo: json['receiptNo'] as String?,
    );
  }
}

class ChitPaymentIntent {
  const ChitPaymentIntent({
    required this.id,
    required this.subscriptionId,
    required this.status,
    required this.createdAt,
    this.amount,
    this.paymentMode,
    this.referenceNo,
    this.rejectionReason,
    this.receiptNo,
  });

  final String id;
  final String subscriptionId;
  final double? amount;
  final String? paymentMode;
  final String? referenceNo;
  final String status;
  final String? rejectionReason;
  final String? receiptNo;
  final DateTime createdAt;

  factory ChitPaymentIntent.fromJson(Map<String, dynamic> json) {
    return ChitPaymentIntent(
      id: json['id'] as String,
      subscriptionId: json['subscriptionId'] as String,
      amount: json['amount'] != null ? _num(json['amount']) : null,
      paymentMode: json['paymentMode'] as String?,
      referenceNo: json['referenceNo'] as String?,
      status: (json['status'] as String?) ?? 'pending',
      rejectionReason: json['rejectionReason'] as String?,
      receiptNo: json['receiptNo'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
