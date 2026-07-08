double _num(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

double? _nullableNum(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

DateTime? _date(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

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
    this.chitType = 'unregistered',
    this.auctionType = 'open_manual',
    this.commissionBasis = 'BID_DISCOUNT',
    this.dividendPolicy = 'ALL_MEMBERS',
    this.dividendDistribution = 'ADJUST_NEXT_DUE',
    this.tieBreakRule = 'EARLIEST_BID',
    this.complianceStatus = 'draft',
    this.registrationNo,
    this.registrationDate,
    this.registrarOffice,
    this.bylawNo,
    this.commencementCertificate,
    this.approvedBankName,
    this.foremanName,
    this.fixedDiscountPct,
    this.gstPct,
    this.minDiscountPct,
    this.maxDiscountPct,
    this.bidIncrement,
    this.dividendRounding = 0,
    this.hasForemanTicket = false,
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
  final String chitType;
  final String auctionType;
  final String commissionBasis;
  final String dividendPolicy;
  final String dividendDistribution;
  final String tieBreakRule;
  final String complianceStatus;
  final String? registrationNo;
  final DateTime? registrationDate;
  final String? registrarOffice;
  final String? bylawNo;
  final String? commencementCertificate;
  final String? approvedBankName;
  final String? foremanName;
  final double? fixedDiscountPct;
  final double? gstPct;
  final double? minDiscountPct;
  final double? maxDiscountPct;
  final double? bidIncrement;
  final int dividendRounding;
  final bool hasForemanTicket;

  factory ChitGroup.fromJson(Map<String, dynamic> json) {
    final counts = (json['_count'] as Map<String, dynamic>?) ?? const {};
    return ChitGroup(
      id: json['id'] as String,
      name: json['name'] as String,
      chitValue: _num(json['chitValue']),
      monthlyContrib: _num(json['monthlyContrib']),
      totalMembers: (json['totalMembers'] as num?)?.toInt() ?? 0,
      durationMonths: (json['durationMonths'] as num?)?.toInt() ?? 0,
      status: (json['status'] as String?) ?? 'draft',
      startDate: DateTime.parse(json['startDate'] as String),
      memberCount: (counts['members'] as num?)?.toInt() ?? 0,
      auctionCount: (counts['auctions'] as num?)?.toInt() ?? 0,
      commissionPct: _num(json['commissionPct']),
      chitType: (json['chitType'] as String?) ?? 'unregistered',
      auctionType: (json['auctionType'] as String?) ?? 'open_manual',
      commissionBasis: (json['commissionBasis'] as String?) ?? 'BID_DISCOUNT',
      dividendPolicy: (json['dividendPolicy'] as String?) ?? 'ALL_MEMBERS',
      dividendDistribution:
          (json['dividendDistribution'] as String?) ?? 'ADJUST_NEXT_DUE',
      tieBreakRule: (json['tieBreakRule'] as String?) ?? 'EARLIEST_BID',
      complianceStatus: (json['complianceStatus'] as String?) ?? 'draft',
      registrationNo: json['registrationNo'] as String?,
      registrationDate: _date(json['registrationDate']),
      registrarOffice: json['registrarOffice'] as String?,
      bylawNo: json['bylawNo'] as String?,
      commencementCertificate: json['commencementCertificate'] as String?,
      approvedBankName: json['approvedBankName'] as String?,
      foremanName: json['foremanName'] as String?,
      fixedDiscountPct: _nullableNum(json['fixedDiscountPct']),
      gstPct: _nullableNum(json['gstPct']),
      minDiscountPct: _nullableNum(json['minDiscountPct']),
      maxDiscountPct: _nullableNum(json['maxDiscountPct']),
      bidIncrement: _nullableNum(json['bidIncrement']),
      dividendRounding: (json['dividendRounding'] as num?)?.toInt() ?? 0,
      hasForemanTicket: (json['hasForemanTicket'] as bool?) ?? false,
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
    this.baseDueAmount,
    this.dividendAmount = 0,
    this.penaltyAmount = 0,
    this.collectorId,
    this.paymentMode,
    this.lastReceiptNo,
    this.lastPaymentRefNo,
    this.notes,
  });

  final String id;
  final int periodNumber;
  final DateTime dueDate;
  final double dueAmount;
  final double paidAmount;
  final String status;
  final String memberId;
  final String memberName;
  final double? baseDueAmount;
  final double dividendAmount;
  final double penaltyAmount;
  final String? collectorId;
  final String? paymentMode;
  final String? lastReceiptNo;
  final String? lastPaymentRefNo;
  final String? notes;

  double get outstanding =>
      (dueAmount + penaltyAmount - paidAmount).clamp(0, double.infinity);

  factory ChitSubscription.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>?;
    final customer = member?['customer'] as Map<String, dynamic>?;
    return ChitSubscription(
      id: json['id'] as String,
      periodNumber: (json['periodNumber'] as num).toInt(),
      dueDate: DateTime.parse(json['dueDate'] as String),
      dueAmount: _num(json['dueAmount']),
      paidAmount: _num(json['paidAmount']),
      status: (json['status'] as String?) ?? 'pending',
      memberId: (member?['id'] as String?) ?? '',
      memberName: (customer?['name'] as String?) ?? '-',
      baseDueAmount: _nullableNum(json['baseDueAmount']),
      dividendAmount: _num(json['dividendAmount']),
      penaltyAmount: _num(json['penaltyAmount']),
      collectorId: json['collectorId'] as String?,
      paymentMode: json['paymentMode'] as String?,
      lastReceiptNo: json['lastReceiptNo'] as String?,
      lastPaymentRefNo: json['lastPaymentRefNo'] as String?,
      notes: json['notes'] as String?,
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
    this.ticketNo,
    this.fractionNo,
    this.ticketShare = 1,
    this.subscriberStatus = 'active',
    this.agreementStatus = 'pending',
    this.agreementSignedAt,
    this.nomineeName,
    this.nomineeRelation,
    this.nomineePhone,
    this.introducedBy,
    this.isForemanTicket = false,
    this.wonAt,
  });

  final String id;
  final int memberNumber;
  final String customerName;
  final String customerCode;
  final bool hasWon;
  final String? ticketNo;
  final String? fractionNo;
  final double ticketShare;
  final String subscriberStatus;
  final String agreementStatus;
  final DateTime? agreementSignedAt;
  final String? nomineeName;
  final String? nomineeRelation;
  final String? nomineePhone;
  final String? introducedBy;
  final bool isForemanTicket;
  final DateTime? wonAt;

  factory ChitMember.fromJson(Map<String, dynamic> json) {
    final customer = (json['customer'] as Map<String, dynamic>?) ?? const {};
    return ChitMember(
      id: json['id'] as String,
      memberNumber: (json['memberNumber'] as num).toInt(),
      customerName: (customer['name'] as String?) ?? '-',
      customerCode: (customer['customerCode'] as String?) ?? '',
      hasWon: (json['hasWon'] as bool?) ?? false,
      ticketNo: json['ticketNo'] as String?,
      fractionNo: json['fractionNo'] as String?,
      ticketShare: _num(json['ticketShare']),
      subscriberStatus: (json['subscriberStatus'] as String?) ?? 'active',
      agreementStatus: (json['agreementStatus'] as String?) ?? 'pending',
      agreementSignedAt: _date(json['agreementSignedAt']),
      nomineeName: json['nomineeName'] as String?,
      nomineeRelation: json['nomineeRelation'] as String?,
      nomineePhone: json['nomineePhone'] as String?,
      introducedBy: json['introducedBy'] as String?,
      isForemanTicket: (json['isForemanTicket'] as bool?) ?? false,
      wonAt: _date(json['wonAt']),
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
    this.scheduledAt,
    this.startedAt,
    this.completedAt,
    this.noticeStatus = 'pending',
    this.minutesText,
    this.payoutStatus = 'not_ready',
    this.winnerMemberId,
    this.bidDiscount,
    this.commission,
    this.gstAmount = 0,
    this.roundingIncome = 0,
    this.bids = const <ChitBid>[],
    this.attendance = const <ChitAuctionAttendance>[],
  });

  final String id;
  final int periodNumber;
  final String status;
  final String? winnerName;
  final double? prizeAmount;
  final double? dividend;
  final DateTime? auctionDate;
  final DateTime? scheduledAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final String noticeStatus;
  final String? minutesText;
  final String payoutStatus;
  final String? winnerMemberId;
  final double? bidDiscount;
  final double? commission;
  final double gstAmount;
  final double roundingIncome;
  final List<ChitBid> bids;
  final List<ChitAuctionAttendance> attendance;

  factory ChitAuction.fromJson(Map<String, dynamic> json) {
    final winner = json['winnerMember'] as Map<String, dynamic>?;
    final winnerCustomer = winner?['customer'] as Map<String, dynamic>?;
    final bidRows = (json['bids'] as List<dynamic>? ?? const <dynamic>[])
        .map((dynamic e) => ChitBid.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
    final attendanceRows =
        (json['attendance'] as List<dynamic>? ?? const <dynamic>[])
            .map(
              (dynamic e) =>
                  ChitAuctionAttendance.fromJson(e as Map<String, dynamic>),
            )
            .toList(growable: false);

    return ChitAuction(
      id: json['id'] as String,
      periodNumber: (json['periodNumber'] as num).toInt(),
      status: (json['status'] as String?) ?? 'pending',
      winnerName: winnerCustomer?['name'] as String?,
      prizeAmount: _nullableNum(json['prizeAmount']),
      dividend: _nullableNum(json['dividend']),
      auctionDate: _date(json['auctionDate']),
      scheduledAt: _date(json['scheduledAt']),
      startedAt: _date(json['startedAt']),
      completedAt: _date(json['completedAt']),
      noticeStatus: (json['noticeStatus'] as String?) ?? 'pending',
      minutesText: json['minutesText'] as String?,
      payoutStatus: (json['payoutStatus'] as String?) ?? 'not_ready',
      winnerMemberId: json['winnerMemberId'] as String?,
      bidDiscount: _nullableNum(json['bidDiscount']),
      commission: _nullableNum(json['commission']),
      gstAmount: _num(json['gstAmount']),
      roundingIncome: _num(json['roundingIncome']),
      bids: bidRows,
      attendance: attendanceRows,
    );
  }
}

class ChitBid {
  const ChitBid({
    required this.id,
    required this.memberId,
    required this.bidAmount,
    required this.bidDiscount,
    required this.bidTime,
    required this.status,
    this.remarks,
    this.bidderName,
  });

  final String id;
  final String memberId;
  final double bidAmount;
  final double bidDiscount;
  final DateTime bidTime;
  final String status;
  final String? remarks;
  final String? bidderName;

  factory ChitBid.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>?;
    final customer = member?['customer'] as Map<String, dynamic>?;
    return ChitBid(
      id: json['id'] as String,
      memberId: json['memberId'] as String,
      bidAmount: _num(json['bidAmount']),
      bidDiscount: _num(json['bidDiscount']),
      bidTime: DateTime.parse(json['bidTime'] as String),
      status: (json['status'] as String?) ?? 'valid',
      remarks: json['remarks'] as String?,
      bidderName: customer?['name'] as String?,
    );
  }
}

class ChitAuctionAttendance {
  const ChitAuctionAttendance({
    required this.id,
    required this.memberId,
    required this.status,
    required this.markedAt,
    this.proxyName,
    this.remarks,
    this.memberName,
  });

  final String id;
  final String memberId;
  final String status;
  final DateTime markedAt;
  final String? proxyName;
  final String? remarks;
  final String? memberName;

  factory ChitAuctionAttendance.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>?;
    final customer = member?['customer'] as Map<String, dynamic>?;
    return ChitAuctionAttendance(
      id: json['id'] as String,
      memberId: json['memberId'] as String,
      status: (json['status'] as String?) ?? 'present',
      markedAt: DateTime.parse(json['markedAt'] as String),
      proxyName: json['proxyName'] as String?,
      remarks: json['remarks'] as String?,
      memberName: customer?['name'] as String?,
    );
  }
}
