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
    double _n(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return LoanCalcInstalment(
      instalmentNo: (json['instalmentNo'] as num).toInt(),
      dueDate: DateTime.parse(json['dueDate'] as String),
      dueAmount: _n(json['dueAmount']),
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
    double _n(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return LoanCalculation(
      perInstalment: _n(json['perInstalment']),
      totalRepayable: _n(json['totalRepayable']),
      totalInterest: _n(json['totalInterest']),
      endDate: DateTime.parse(json['endDate'] as String),
      instalments: (json['instalments'] as List<dynamic>? ?? const [])
          .map((dynamic e) =>
              LoanCalcInstalment.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}
