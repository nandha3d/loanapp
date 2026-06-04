import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/instalment.dart';

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
    this.customer,
    this.endDate,
    this.voucherRef,
    this.loanType,
    this.collateralDetails,
    this.dueDay,
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
  final Customer? customer;
  final String? voucherRef;
  final String? loanType; // cheque | gold | property | other
  final String? collateralDetails;
  final int? dueDay;
  final double totalPayable;
  final double totalCollected;
  final double perInstalment;

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
      instalments: (json['instalments'] as List<dynamic>? ?? const [])
          .map((dynamic e) => Instalment.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      customer: json['customer'] is Map<String, dynamic>
          ? Customer.fromJson(json['customer'] as Map<String, dynamic>)
          : null,
    );
  }
}
