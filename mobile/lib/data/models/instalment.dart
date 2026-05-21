/// Instalment model — spec §3.4.
class Instalment {
  const Instalment({
    required this.id,
    required this.loanId,
    required this.instalmentNo,
    required this.dueDate,
    required this.dueAmount,
    required this.receivedAmount,
    required this.status,
    this.paidAt,
    this.paymentMode,
  });

  final String id;
  final String loanId;
  final int instalmentNo;
  final DateTime dueDate;
  final double dueAmount;
  final double receivedAmount; // default 0
  final String status; // upcoming | paid | partial | missed
  final DateTime? paidAt;
  final String? paymentMode; // cash | upi | bank

  factory Instalment.fromJson(Map<String, dynamic> json) {
    double _num(dynamic v) => v is num ? v.toDouble() : double.parse(v as String);
    return Instalment(
      id: json['id'] as String,
      loanId: json['loanId'] as String,
      instalmentNo: (json['instalmentNo'] as num).toInt(),
      dueDate: DateTime.parse(json['dueDate'] as String),
      dueAmount: _num(json['dueAmount']),
      receivedAmount: _num(json['receivedAmount'] ?? 0),
      status: json['status'] as String,
      paidAt: json['paidAt'] == null
          ? null
          : DateTime.parse(json['paidAt'] as String),
      paymentMode: json['paymentMode'] as String?,
    );
  }
}
