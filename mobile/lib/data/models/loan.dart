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
    this.endDate,
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

  factory Loan.fromJson(Map<String, dynamic> json) {
    double _num(dynamic v) => v is num ? v.toDouble() : double.parse(v as String);
    return Loan(
      id: json['id'] as String,
      loanCode: json['loanCode'] as String,
      customerId: json['customerId'] as String,
      principalAmount: _num(json['principalAmount'] ?? json['principal']),
      disbursedAmount: _num(json['disbursedAmount'] ?? json['disbursed']),
      interestRate: _num(json['interestRate']),
      frequency: json['frequency'] as String,
      status: json['status'] as String,
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: json['endDate'] == null
          ? null
          : DateTime.parse(json['endDate'] as String),
      instalmentCount: (json['instalmentCount'] as num).toInt(),
      penaltyRate: _num(json['penaltyRate']),
      instalments: (json['instalments'] as List<dynamic>? ?? const [])
          .map((dynamic e) => Instalment.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}
