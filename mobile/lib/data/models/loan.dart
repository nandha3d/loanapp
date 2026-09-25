import 'package:zolofund/data/models/customer.dart';
import 'package:zolofund/data/models/instalment.dart';
import 'package:zolofund/data/models/penalty.dart';

/// "Extend term" default projection — same server-side calc the web page's
/// heatmap tail cells use (see lib/restructure.ts#computeExtendedSchedule):
/// keep paying the normal per-instalment amount and let the finish date
/// slide out by one period for every unpaid due.
class ExtendedSchedule {
  const ExtendedSchedule({
    required this.remainingPayments,
    required this.extraPeriods,
    required this.projectedEndDate,
  });

  final int remainingPayments;
  final int extraPeriods;
  final DateTime? projectedEndDate;

  factory ExtendedSchedule.fromJson(Map<String, dynamic> json) {
    return ExtendedSchedule(
      remainingPayments: (json['remainingPayments'] as num?)?.toInt() ?? 0,
      extraPeriods: (json['extraPeriods'] as num?)?.toInt() ?? 0,
      projectedEndDate: json['projectedEndDate'] == null
          ? null
          : DateTime.tryParse(json['projectedEndDate'] as String),
    );
  }
}

class LoanMetrics {
  const LoanMetrics({
    required this.totalOutstanding,
    required this.overdueAmount,
    required this.missedCount,
    required this.paidCount,
  });

  final double totalOutstanding;
  final double overdueAmount;
  final int missedCount;
  final int paidCount;

  factory LoanMetrics.fromJson(Map<String, dynamic> json) {
    double num$(dynamic v) =>
        (v is num) ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;
    return LoanMetrics(
      totalOutstanding: num$(json['totalOutstanding']),
      overdueAmount: num$(json['overdueAmount']),
      missedCount: (json['missedCount'] as num?)?.toInt() ?? 0,
      paidCount: (json['paidCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class LoanRestructure {
  const LoanRestructure({
    required this.restructuredRate,
    required this.arrears,
    required this.futureInstalmentsCount,
    required this.isApplicable,
    this.message,
  });

  final double restructuredRate;
  final double arrears;
  final int futureInstalmentsCount;
  final bool isApplicable;
  final String? message;

  factory LoanRestructure.fromJson(Map<String, dynamic> json) {
    double num$(dynamic v) =>
        (v is num) ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;
    return LoanRestructure(
      restructuredRate: num$(json['restructuredRate']),
      arrears: num$(json['arrears']),
      futureInstalmentsCount:
          (json['futureInstalmentsCount'] as num?)?.toInt() ?? 0,
      isApplicable: json['isApplicable'] == true,
      message: json['message'] as String?,
    );
  }
}

class LoanPayment {
  const LoanPayment({
    required this.id,
    required this.paymentDate,
    required this.amount,
    required this.paymentMode,
    this.referenceNumber,
    this.receiptNo,
  });

  final String id;
  final DateTime paymentDate;
  final double amount;
  final String paymentMode;
  final String? referenceNumber;
  final String? receiptNo;

  factory LoanPayment.fromJson(Map<String, dynamic> json) {
    double num$(dynamic v) =>
        (v is num) ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;
    return LoanPayment(
      id: (json['id'] as String?) ?? '',
      paymentDate: DateTime.parse(json['paymentDate'] as String).toLocal(),
      amount: num$(json['amount']),
      paymentMode: (json['paymentMode'] as String?) ?? 'cash',
      referenceNumber: json['referenceNumber'] as String?,
      receiptNo: json['receiptNo'] as String?,
    );
  }
}

/// Loan model — spec §3.3.
class Loan {
  const Loan({
    required this.id,
    required this.loanCode,
    required this.customerId,
    required this.principalAmount,
    required this.disbursedAmount,
    required this.interestRate,
    required this.frequency,
    required this.status,
    required this.startDate,
    required this.instalmentCount,
    required this.penaltyRate,
    required this.instalments,
    required this.totalPayable,
    required this.totalCollected,
    required this.perInstalment,
    this.penalties = const [],
    this.extendedSchedule,
    this.customer,
    this.endDate,
    this.voucherRef,
    this.loanType,
    this.collateralDetails,
    this.dueDay,
    this.propertyCollateral,
    this.productFinanceItem,
    this.goldCollateral,
    this.collaterals = const [],
    this.guarantor,
    this.metrics,
    this.restructure,
    this.payments = const [],
    this.npaStatus,
    this.npaClassifiedAt,
    this.paidCount = 0,
    this.closedAt,
    this.deduction,
    this.deductionType,
  });

  final String id;
  final String loanCode;
  final String customerId;
  final double principalAmount;
  final double disbursedAmount;
  final double interestRate;
  final String frequency; // daily | weekly | monthly
  final String status; // pending_review | active | overdue | closed
  final DateTime startDate;
  final DateTime? endDate;
  final int instalmentCount;
  final double penaltyRate;
  final List<Instalment> instalments;
  final List<Penalty> penalties;
  final ExtendedSchedule? extendedSchedule;
  final Customer? customer;
  final String? voucherRef;
  final String? loanType; // cheque | gold | property | other
  final String? collateralDetails;
  final int? dueDay;
  final double totalPayable;
  final double totalCollected;
  final double perInstalment;
  final Map<String, dynamic>? propertyCollateral;
  final Map<String, dynamic>? productFinanceItem;
  final Map<String, dynamic>? goldCollateral;
  final List<dynamic> collaterals;
  final Guarantor? guarantor;
  final LoanMetrics? metrics;
  final LoanRestructure? restructure;
  final List<LoanPayment> payments;
  final String? npaStatus;
  final DateTime? npaClassifiedAt;
  final int paidCount;
  final DateTime? closedAt;
  final double? deduction;
  final String? deductionType;

  factory Loan.fromJson(Map<String, dynamic> json) {
    double num$(dynamic v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0;
    }
    int int$(dynamic v) {
      if (v == null) return 0;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString()) ?? 0;
    }
    return Loan(
      id: json['id'] as String,
      loanCode: (json['loanCode'] as String?) ?? '',
      customerId: (json['customerId'] as String?) ?? '',
      principalAmount: num$(json['principalAmount'] ?? json['principal']),
      disbursedAmount: num$(json['disbursedAmount'] ?? json['disbursed']),
      interestRate: num$(json['interestRate']),
      frequency: (json['frequency'] as String?) ?? 'daily',
      status: (json['status'] as String?) ?? 'active',
      startDate: json['startDate'] == null
          ? DateTime.now()
          : DateTime.tryParse(json['startDate'] as String) ?? DateTime.now(),
      endDate: json['endDate'] == null
          ? null
          : DateTime.tryParse(json['endDate'] as String),
      instalmentCount:
          int$(json['instalmentCount'] ?? json['totalInstalments'] ?? json['tenure']),
      penaltyRate: num$(json['penaltyRate']),
      voucherRef: json['voucherRef'] as String?,
      loanType: json['loanType'] as String?,
      collateralDetails: json['collateralDetails'] as String?,
      dueDay: json['dueDay'] as int?,
      totalPayable: num$(json['totalPayable']),
      totalCollected: num$(json['totalCollected']),
      perInstalment: num$(json['perInstalment']),
      propertyCollateral: json['propertyCollateral'] as Map<String, dynamic>?,
      productFinanceItem: json['productFinanceItem'] as Map<String, dynamic>?,
      goldCollateral: json['goldCollateral'] as Map<String, dynamic>?,
      collaterals: (json['collaterals'] as List<dynamic>?) ?? const [],
      guarantor: json['guarantor'] is Map<String, dynamic>
          ? Guarantor.fromJson(json['guarantor'] as Map<String, dynamic>)
          : null,
      metrics: json['metrics'] is Map<String, dynamic>
          ? LoanMetrics.fromJson(json['metrics'] as Map<String, dynamic>)
          : null,
      restructure: json['restructure'] is Map<String, dynamic>
          ? LoanRestructure.fromJson(json['restructure'] as Map<String, dynamic>)
          : null,
      payments: (json['payments'] as List<dynamic>? ?? const [])
          .map((dynamic e) => LoanPayment.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      npaStatus: json['npaStatus'] as String?,
      npaClassifiedAt: json['npaClassifiedAt'] == null
          ? null
          : DateTime.tryParse(json['npaClassifiedAt'] as String),
      paidCount: int$(json['paidCount']),
      closedAt: json['closedAt'] == null
          ? null
          : DateTime.tryParse(json['closedAt'] as String),
      deduction: json['deduction'] == null ? null : num$(json['deduction']),
      deductionType: json['deductionType'] as String?,
      instalments: (json['instalments'] as List<dynamic>? ?? const [])
          .map((dynamic e) => Instalment.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      penalties: (json['penalties'] as List<dynamic>? ?? const [])
          .map((dynamic e) => Penalty.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      extendedSchedule: json['extendedSchedule'] is Map<String, dynamic>
          ? ExtendedSchedule.fromJson(
              json['extendedSchedule'] as Map<String, dynamic>,)
          : null,
      customer: json['customer'] is Map<String, dynamic>
          ? Customer.fromJson(json['customer'] as Map<String, dynamic>)
          : null,
    );
  }
}
