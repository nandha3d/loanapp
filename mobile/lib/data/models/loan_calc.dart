class LoanCalcInstalment {
  const LoanCalcInstalment({
    required this.instalmentNo,
    required this.dueDate,
    required this.dueAmount,
  });
  final int instalmentNo;
  final DateTime dueDate;
  final double dueAmount;

  factory LoanCalcInstalment.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final dueStr = json['dueDate']?.toString() ?? '';
    return LoanCalcInstalment(
      instalmentNo: (json['instalmentNo'] as num? ?? 0).toInt(),
      dueDate: DateTime.tryParse(dueStr) ?? DateTime.now(),
      dueAmount: n(json['dueAmount']),
    );
  }
}

class LoanCalculation {
  const LoanCalculation({
    required this.perInstalment,
    required this.totalRepayable,
    required this.totalInterest,
    required this.endDate,
    required this.instalments,
  });

  final double perInstalment;
  final double totalRepayable;
  final double totalInterest;
  final DateTime endDate;
  final List<LoanCalcInstalment> instalments;

  factory LoanCalculation.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);

    final instList = (json['instalments'] ?? json['schedule']) as List<dynamic>? ?? const [];
    final instalments = instList
        .map(
          (dynamic e) =>
              LoanCalcInstalment.fromJson(e as Map<String, dynamic>),
        )
        .toList(growable: false);

    final totalPayable = n(json['totalRepayable'] ?? json['totalPayable']);
    final principal = n(json['principal']);
    final totalInterest = n(json['totalInterest'] ?? json['deduction'] ?? (totalPayable - principal));

    final endStr = json['endDate']?.toString();
    final endDate = endStr != null
        ? (DateTime.tryParse(endStr) ?? DateTime.now())
        : (instalments.isNotEmpty ? instalments.last.dueDate : DateTime.now());

    return LoanCalculation(
      perInstalment: n(json['perInstalment']),
      totalRepayable: totalPayable,
      totalInterest: totalInterest,
      endDate: endDate,
      instalments: instalments,
    );
  }
}
