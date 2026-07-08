import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/instalment.dart';
import 'package:loantrack/data/models/penalty.dart';

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
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: json['endDate'] == null
          ? null
          : DateTime.parse(json['endDate'] as String),
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
