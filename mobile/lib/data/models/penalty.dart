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
    this.missedDays = 0,
    this.routeId,
    this.routeName,
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
  final int missedDays;
  final String? routeId;
  final String? routeName;

  factory Penalty.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final loan = (json['loan'] as Map<String, dynamic>?) ?? const {};
    final customer = (loan['customer'] as Map<String, dynamic>?) ?? const {};
    final route = (customer['route'] as Map<String, dynamic>?) ?? const {};
    return Penalty(
      id: json['id'] as String,
      loanId: (loan['id'] as String?) ?? (json['loanId'] as String? ?? ''),
      loanCode: (loan['loanCode'] as String?) ?? '',
      customerName: (customer['name'] as String?) ?? '—',
      customerCode: (customer['customerCode'] as String?) ?? '',
      grossPenalty: toDouble(json['grossPenalty']),
      settledAmount: toDouble(json['settledAmount']),
      waivedAmount: toDouble(json['waivedAmount']),
      status: (json['status'] as String?) ?? 'pending',
      createdAt: DateTime.parse(json['createdAt'] as String),
      missedDays: (json['missedDays'] as num?)?.toInt() ?? 0,
      routeId: (customer['routeId'] as String?) ?? (route['id'] as String?),
      routeName: (route['name'] as String?),
    );
  }
}
