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
    this.net,
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
  /// DEC-03 (B): server net due (gross − settled − waived); null on old payloads.
  final double? net;
  final String status; // pending | settled | waived
  final DateTime createdAt;
  final int missedDays;
  final String? routeId;
  final String? routeName;

  double get netDue => net ?? (grossPenalty - settledAmount - waivedAmount).clamp(0, double.infinity);

  factory Penalty.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final loan = (json['loan'] as Map<String, dynamic>?) ?? const {};
    final customer = (json['customer'] as Map<String, dynamic>?) ??
        (loan['customer'] as Map<String, dynamic>?) ?? const {};
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
      net: json['net'] == null ? null : toDouble(json['net']),
      status: (json['status'] as String?) ?? 'pending',
      createdAt: DateTime.parse(json['createdAt'] as String),
      missedDays: (json['missedDays'] as num?)?.toInt() ?? 0,
      routeId: (customer['routeId'] as String?) ?? (route['id'] as String?),
      routeName: (route['name'] as String?),
    );
  }
}

/// DEC-03 (B): one loan's penalties with the server's totals — each loan's
/// figures come from that loan's own missed dates (GET /penalties?groupBy=loan).
class LoanPenaltyGroup {
  const LoanPenaltyGroup({
    required this.loanId,
    required this.loanCode,
    required this.customerName,
    required this.customerCode,
    required this.gross,
    required this.settled,
    required this.waived,
    required this.net,
    required this.missedDays,
    required this.status,
    required this.open,
  });

  final String loanId;
  final String loanCode;
  final String customerName;
  final String customerCode;
  final double gross;
  final double settled;
  final double waived;
  final double net;
  final int missedDays;
  final String status; // pending | partial | waived | settled
  /// Open penalty rows (oldest first) with their server net due.
  final List<({String id, double net})> open;

  factory LoanPenaltyGroup.fromJson(Map<String, dynamic> json) {
    double d(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);
    final rows = (json['penalties'] as List<dynamic>? ?? const [])
        .map((dynamic e) => Map<String, dynamic>.from(e as Map))
        .where((p) => p['status'] == 'pending' || p['status'] == 'partial')
        .map((p) => (id: '${p['id']}', net: d(p['net'])))
        .toList(growable: false);
    return LoanPenaltyGroup(
      loanId: (json['loanId'] as String?) ?? '',
      loanCode: (json['loanCode'] as String?) ?? '',
      customerName: (json['customerName'] as String?) ?? '',
      customerCode: (json['customerCode'] as String?) ?? '',
      gross: d(json['gross']),
      settled: d(json['settled']),
      waived: d(json['waived']),
      net: d(json['net']),
      missedDays: (json['missedDays'] as num?)?.toInt() ?? 0,
      status: (json['status'] as String?) ?? 'settled',
      open: rows,
    );
  }
}
