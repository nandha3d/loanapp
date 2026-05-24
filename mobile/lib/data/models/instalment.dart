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
    this.receivedAt,
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
  final DateTime? receivedAt;
  final String? paymentMode; // cash | upi | bank

  Instalment copyWith({
    String? id,
    String? loanId,
    int? instalmentNo,
    DateTime? dueDate,
    double? dueAmount,
    double? receivedAmount,
    String? status,
    DateTime? paidAt,
    DateTime? receivedAt,
    String? paymentMode,
  }) {
    return Instalment(
      id: id ?? this.id,
      loanId: loanId ?? this.loanId,
      instalmentNo: instalmentNo ?? this.instalmentNo,
      dueDate: dueDate ?? this.dueDate,
      dueAmount: dueAmount ?? this.dueAmount,
      receivedAmount: receivedAmount ?? this.receivedAmount,
      status: status ?? this.status,
      paidAt: paidAt ?? this.paidAt,
      receivedAt: receivedAt ?? this.receivedAt,
      paymentMode: paymentMode ?? this.paymentMode,
    );
  }

  /// Computes the real display status by comparing dueDate to today,
  /// mirroring the web interface's dynamic status logic.
  /// Returns: paid | partial | missed | due_today | upcoming
  String get dynamicStatus {
    // If the server already marked it paid or partial, honour that.
    if (status == 'paid' || status == 'partial') return status;

    // Client-side checks based on amounts.
    final isPaid = receivedAmount >= dueAmount && dueAmount > 0;
    final isPartial = receivedAmount > 0 && receivedAmount < dueAmount;
    if (isPaid) return 'paid';
    if (isPartial) return 'partial';

    // Compare due date to today (start of day, local time).
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final due = DateTime(dueDate.year, dueDate.month, dueDate.day);

    if (due.isBefore(today)) return 'missed';
    if (due.isAtSameMomentAs(today)) return 'due_today';
    return 'upcoming';
  }

  factory Instalment.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0;
    }
    final paidRaw = json['paidAt'] ?? json['receivedAt'];
    final receivedAtRaw = json['receivedAt'];
    return Instalment(
      id: json['id'] as String,
      loanId: (json['loanId'] as String?) ?? '',
      instalmentNo: ((json['instalmentNo'] as num?) ?? 0).toInt(),
      dueDate: DateTime.parse(json['dueDate'] as String).toLocal(),
      dueAmount: toNum(json['dueAmount']),
      receivedAmount: toNum(json['receivedAmount'] ?? 0),
      status: (json['status'] as String?) ?? 'upcoming',
      paidAt: paidRaw == null ? null : DateTime.parse(paidRaw as String).toLocal(),
      receivedAt: receivedAtRaw == null
          ? null
          : DateTime.parse(receivedAtRaw as String).toLocal(),
      paymentMode: json['paymentMode'] as String?,
    );
  }
}
