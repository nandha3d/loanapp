class Penalty {
  const Penalty({
    required this.id,
    required this.loanId,
    required this.loanCode,
    required this.customerName,
    required this.customerCode,
    required this.grossPenalty,
    required this.settledAmount,
    required this.waivedAmount,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String loanId;
  final String loanCode;
  final String customerName;
  final String customerCode;
  final double grossPenalty;
  final double settledAmount;
  final double waivedAmount;
  final String status; // pending | settled | waived
  final DateTime createdAt;

  factory Penalty.fromJson(Map<String, dynamic> json) {
    double _num(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final loan = (json['loan'] as Map<String, dynamic>?) ?? const {};
    final customer = (loan['customer'] as Map<String, dynamic>?) ?? const {};
    return Penalty(
      id: json['id'] as String,
      loanId: (loan['id'] as String?) ?? (json['loanId'] as String? ?? ''),
      loanCode: (loan['loanCode'] as String?) ?? '',
      customerName: (customer['name'] as String?) ?? '—',
      customerCode: (customer['customerCode'] as String?) ?? '',
      grossPenalty: _num(json['grossPenalty']),
      settledAmount: _num(json['settledAmount']),
      waivedAmount: _num(json['waivedAmount']),
      status: (json['status'] as String?) ?? 'pending',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
