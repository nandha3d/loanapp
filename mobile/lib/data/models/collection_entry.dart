/// Collection entry as returned by `POST /api/v1/collection/entry`.
class CollectionEntry {
  const CollectionEntry({
    required this.id,
    required this.idempotencyKey,
    required this.instalmentId,
    required this.receivedAmount,
    required this.paymentMode,
  });
  final String id;
  final String idempotencyKey;
  final String? instalmentId;
  final double receivedAmount;
  final String paymentMode;

  factory CollectionEntry.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return CollectionEntry(
      id: json['id'] as String,
      idempotencyKey: (json['idempotencyKey'] as String?) ?? '',
      instalmentId: json['instalmentId'] as String?,
      receivedAmount: n(json['receivedAmount']),
      paymentMode: (json['paymentMode'] as String?) ?? 'cash',
    );
  }
}

/// One row in today's collection list — joined instalment + customer + loan.
class CollectionRow {
  const CollectionRow({
    required this.instalmentId,
    required this.loanId,
    required this.loanCode,
    required this.customerId,
    required this.customerName,
    required this.customerCode,
    required this.routeName,
    required this.dueAmount,
    required this.receivedAmount,
    required this.dueDate,
    required this.status,
    this.lat,
    this.lng,
    this.collectionEntryId,
    this.frequency,
  });

  final String instalmentId;
  final String loanId;
  final String loanCode;
  final String customerId;
  final String customerName;
  final String customerCode;
  final String? routeName;
  final double dueAmount;
  final double receivedAmount;
  final DateTime dueDate;
  final String status;
  final double? lat;
  final double? lng;
  final String? collectionEntryId;
  final String? frequency;

  double get outstanding => dueAmount - receivedAmount;
  int get daysOverdue {
    final today = DateTime.now();
    final due = DateTime(dueDate.year, dueDate.month, dueDate.day);
    final t = DateTime(today.year, today.month, today.day);
    return t.difference(due).inDays;
  }

  factory CollectionRow.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final loan = (json['loan'] as Map<String, dynamic>?) ?? const {};
    final customer = (loan['customer'] as Map<String, dynamic>?) ?? const {};
    final route = customer['route'] as Map<String, dynamic>?;
    return CollectionRow(
      instalmentId: json['id'] as String,
      loanId: (loan['id'] as String?) ?? '',
      loanCode: (loan['loanCode'] as String?) ?? '',
      customerId: (customer['id'] as String?) ?? '',
      customerName: (customer['name'] as String?) ?? '—',
      customerCode: (customer['customerCode'] as String?) ?? '',
      routeName: route?['name'] as String?,
      dueAmount: n(json['dueAmount']),
      receivedAmount: n(json['receivedAmount']),
      dueDate: DateTime.parse(json['dueDate'] as String).toLocal(),
      status: (json['status'] as String?) ?? 'upcoming',
      lat: customer['lat'] == null ? null : n(customer['lat']),
      lng: customer['lng'] == null ? null : n(customer['lng']),
      collectionEntryId: json['collectionEntryId'] as String?,
      frequency: loan['frequency'] as String?,
    );
  }
}
