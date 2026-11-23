// Doc 22b — current/overdue/upcoming/history grouped borrower contributions,
// and doc 19's payment-proof intents. Mirrors
// lib/chits/customerPortal.ts#getMyChitContributionsGrouped and
// lib/chits/paymentIntents.ts's serialized shapes. fromJson-only, matching
// the rest of this package's null-safe model style.

double _num(dynamic v) =>
    v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;

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
    this.deferredDividendAmount = 0,
    this.dividendForfeited = false,
    this.premiumAmount = 0,
    this.interestAmount = 0,
    this.goldRateApplied,
    this.goldGramsCredited = 0,
  });

  final String subscriptionId;
  final String groupId;
  final String groupName;
  final String? ticketNo;
  final int periodNumber;
  final DateTime dueDate;
  final double baseDueAmount;
  final double dividendAmount;
  final double deferredDividendAmount;
  final bool dividendForfeited;
  final double premiumAmount;
  final double interestAmount;
  final double penaltyAmount;
  final double netDue;
  final double paidAmount;
  final double outstanding;
  final double? goldRateApplied;
  final double goldGramsCredited;
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
      deferredDividendAmount: _num(json['deferredDividendAmount']),
      dividendForfeited: (json['dividendForfeited'] as bool?) ?? false,
      premiumAmount: _num(json['premiumAmount']),
      interestAmount: _num(json['interestAmount']),
      penaltyAmount: _num(json['penaltyAmount']),
      netDue: _num(json['netDue']),
      paidAmount: _num(json['paidAmount']),
      outstanding: _num(json['outstanding']),
      goldRateApplied: json['goldRateApplied'] != null ? _num(json['goldRateApplied']) : null,
      goldGramsCredited: _num(json['goldGramsCredited']),
      status: (json['status'] as String?) ?? 'upcoming',
    );
  }
}

class ChitMemberDividendSummary {
  const ChitMemberDividendSummary({
    required this.totalGrossBaseDue,
    required this.totalDividendEarned,
    required this.totalDeferredDividend,
    required this.totalForfeitedDividend,
    required this.totalPremiumCharged,
    required this.totalWinnerInterest,
    required this.totalNetPayable,
    required this.totalPaid,
    required this.totalOutstanding,
    required this.prizeWonAmount,
    required this.goldTotalGrams,
    required this.netFinancialOutcome,
    required this.effectiveSavingsPct,
    this.hasWon = false,
  });

  final bool hasWon;
  final double prizeWonAmount;
  final double totalGrossBaseDue;
  final double totalDividendEarned;
  final double totalDeferredDividend;
  final double totalForfeitedDividend;
  final double totalPremiumCharged;
  final double totalWinnerInterest;
  final double totalNetPayable;
  final double totalPaid;
  final double totalOutstanding;
  final double goldTotalGrams;
  final double netFinancialOutcome;
  final double effectiveSavingsPct;

  factory ChitMemberDividendSummary.fromJson(Map<String, dynamic> json) {
    return ChitMemberDividendSummary(
      hasWon: (json['hasWon'] as bool?) ?? false,
      prizeWonAmount: _num(json['prizeWonAmount']),
      totalGrossBaseDue: _num(json['totalGrossBaseDue']),
      totalDividendEarned: _num(json['totalDividendEarned']),
      totalDeferredDividend: _num(json['totalDeferredDividend']),
      totalForfeitedDividend: _num(json['totalForfeitedDividend']),
      totalPremiumCharged: _num(json['totalPremiumCharged']),
      totalWinnerInterest: _num(json['totalWinnerInterest']),
      totalNetPayable: _num(json['totalNetPayable']),
      totalPaid: _num(json['totalPaid']),
      totalOutstanding: _num(json['totalOutstanding']),
      goldTotalGrams: _num(json['goldTotalGrams']),
      netFinancialOutcome: _num(json['netFinancialOutcome']),
      effectiveSavingsPct: _num(json['effectiveSavingsPct']),
    );
  }
}

class ChitCompletedPeriodBreakdown {
  const ChitCompletedPeriodBreakdown({
    required this.auctionId,
    required this.periodNumber,
    required this.chitValue,
    required this.prizeAmount,
    required this.bidDiscount,
    required this.commissionPct,
    required this.commissionBasis,
    required this.commission,
    required this.gstAmount,
    required this.distributableDividend,
    required this.dividendEligibleMembers,
    required this.dividendPerTicket,
    required this.roundingIncome,
    required this.myDividend,
    required this.myDeferredDividend,
    this.gstPct,
    this.winnerTicketNo,
    this.iWon = false,
    this.excludedFromDividend = false,
    this.forfeitedOnLate = false,
    this.myNextDue,
    this.foremanCompensationMode,
    this.reserveFloorAmount,
  });

  final String auctionId;
  final int periodNumber;
  final String? winnerTicketNo;
  final bool iWon;
  final bool excludedFromDividend;
  final bool forfeitedOnLate;
  final double chitValue;
  final double prizeAmount;
  final double bidDiscount;
  final double commissionPct;
  final String commissionBasis;
  final double commission;
  final double? gstPct;
  final double gstAmount;
  final double distributableDividend;
  final int dividendEligibleMembers;
  final double dividendPerTicket;
  final double roundingIncome;
  final double myDividend;
  final double myDeferredDividend;
  final double? myNextDue;
  final String? foremanCompensationMode;
  final double? reserveFloorAmount;

  factory ChitCompletedPeriodBreakdown.fromJson(Map<String, dynamic> json) {
    return ChitCompletedPeriodBreakdown(
      auctionId: (json['auctionId'] as String?) ?? '',
      periodNumber: (json['periodNumber'] as num?)?.toInt() ?? 0,
      winnerTicketNo: json['winnerTicketNo'] as String?,
      iWon: (json['iWon'] as bool?) ?? false,
      excludedFromDividend: (json['excludedFromDividend'] as bool?) ?? false,
      forfeitedOnLate: (json['forfeitedOnLate'] as bool?) ?? false,
      chitValue: _num(json['chitValue']),
      prizeAmount: _num(json['prizeAmount']),
      bidDiscount: _num(json['bidDiscount']),
      commissionPct: _num(json['commissionPct']),
      commissionBasis: (json['commissionBasis'] as String?) ?? 'BID_DISCOUNT',
      commission: _num(json['commission']),
      gstPct: json['gstPct'] != null ? _num(json['gstPct']) : null,
      gstAmount: _num(json['gstAmount']),
      distributableDividend: _num(json['distributableDividend']),
      dividendEligibleMembers: (json['dividendEligibleMembers'] as num?)?.toInt() ?? 0,
      dividendPerTicket: _num(json['dividendPerTicket']),
      roundingIncome: _num(json['roundingIncome']),
      myDividend: _num(json['myDividend']),
      myDeferredDividend: _num(json['myDeferredDividend']),
      myNextDue: json['myNextDue'] != null ? _num(json['myNextDue']) : null,
      foremanCompensationMode: json['foremanCompensationMode'] as String?,
      reserveFloorAmount: json['reserveFloorAmount'] != null ? _num(json['reserveFloorAmount']) : null,
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
    this.chitEngineType = 'AUCTION_STANDARD',
    this.engineName = '',
    this.payoutAssetType = 'CASH',
    this.dividendPolicy = 'ALL_MEMBERS',
    this.dividendDistribution = 'ADJUST_NEXT_DUE',
    this.isCompleted = false,
    this.completedPeriodsCount = 0,
    this.totalPeriods = 0,
    this.memberSummary,
    this.completedPeriodBreakdowns = const [],
  });

  final String groupId;
  final String groupName;
  final String chitEngineType;
  final String engineName;
  final String payoutAssetType;
  final String dividendPolicy;
  final String dividendDistribution;
  final bool isCompleted;
  final int completedPeriodsCount;
  final int totalPeriods;
  final ChitMemberDividendSummary? memberSummary;
  final List<ChitCompletedPeriodBreakdown> completedPeriodBreakdowns;
  final ChitContribution? current;
  final List<ChitContribution> overdue;
  final List<ChitContribution> upcoming;
  final List<ChitContribution> history;

  factory ChitContributionGroup.fromJson(Map<String, dynamic> json) {
    List<ChitContribution> parseList(String key) => ((json[key] as List<dynamic>?) ?? [])
        .map((dynamic e) => ChitContribution.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
    final rawBreakdowns = (json['completedPeriodBreakdowns'] as List<dynamic>?) ?? const [];
    return ChitContributionGroup(
      groupId: json['groupId'] as String,
      groupName: (json['groupName'] as String?) ?? '',
      chitEngineType: (json['chitEngineType'] as String?) ?? 'AUCTION_STANDARD',
      engineName: (json['engineName'] as String?) ?? '',
      payoutAssetType: (json['payoutAssetType'] as String?) ?? 'CASH',
      dividendPolicy: (json['dividendPolicy'] as String?) ?? 'ALL_MEMBERS',
      dividendDistribution: (json['dividendDistribution'] as String?) ?? 'ADJUST_NEXT_DUE',
      isCompleted: (json['isCompleted'] as bool?) ?? false,
      completedPeriodsCount: (json['completedPeriodsCount'] as num?)?.toInt() ?? 0,
      totalPeriods: (json['totalPeriods'] as num?)?.toInt() ?? 0,
      memberSummary: json['memberSummary'] is Map<String, dynamic>
          ? ChitMemberDividendSummary.fromJson(json['memberSummary'] as Map<String, dynamic>)
          : null,
      completedPeriodBreakdowns: rawBreakdowns
          .whereType<Map<String, dynamic>>()
          .map(ChitCompletedPeriodBreakdown.fromJson)
          .toList(growable: false),
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
