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
      id: json['id']?.toString() ?? '',
      idempotencyKey: json['idempotencyKey']?.toString() ?? '',
      instalmentId: json['instalmentId']?.toString(),
      receivedAmount: n(json['receivedAmount']),
      paymentMode: json['paymentMode']?.toString() ?? 'cash',
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
    this.customerPhoto,
    required this.customerPhone,
    required this.routeName,
    required this.dueAmount,
    required this.receivedAmount,
    required this.dueDate,
    required this.status,
    this.lat,
    this.lng,
    this.collectionEntryId,
    this.frequency,
    this.routeId,
  });

  final String instalmentId;
  final String loanId;
  final String loanCode;
  final String customerId;
  final String customerName;
  final String customerCode;
  final String? customerPhoto;
  final String customerPhone;
  final String? routeName;
  final double dueAmount;
  final double receivedAmount;
  final DateTime dueDate;
  final String status;
  final double? lat;
  final double? lng;
  final String? collectionEntryId;
  final String? frequency;
  final String? routeId;

  String get cadence {
    switch (frequency?.toLowerCase()) {
      case null:
      case 'daily':
        return 'daily';
      case 'weekly':
      case 'biweekly':
      case 'monthly':
      case 'single_payment':
      case 'custom_duration':
        return frequency!.toLowerCase();
      default:
        return 'custom';
    }
  }

  double get outstanding {
    final value = dueAmount - receivedAmount;
    return value > 0 ? value : 0;
  }

  bool get isResolved => status == 'paid' || outstanding <= 0;

  int get daysOverdue {
    final today = DateTime.now();
    final due = DateTime(dueDate.year, dueDate.month, dueDate.day);
    final t = DateTime(today.year, today.month, today.day);
    return t.difference(due).inDays;
  }

  bool get isTodayBucket => daysOverdue <= 0;

  bool get isOverdueBucket => daysOverdue > 0;

  double get todayOutstanding => !isResolved && isTodayBucket ? outstanding : 0;

  double get overdueOutstanding =>
      !isResolved && isOverdueBucket ? outstanding : 0;

  factory CollectionRow.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    final loan = json['loan'] is Map<String, dynamic>
        ? (json['loan'] as Map<String, dynamic>)
        : const <String, dynamic>{};
    final customer = loan['customer'] is Map<String, dynamic>
        ? (loan['customer'] as Map<String, dynamic>)
        : const <String, dynamic>{};
    final rawRoute = customer['route'];
    final String? routeName = rawRoute is Map<String, dynamic>
        ? rawRoute['name']?.toString()
        : (rawRoute != null ? rawRoute.toString() : null);

    final rawDueDate = json['dueDate']?.toString();
    final parsedDueDate = rawDueDate != null
        ? (DateTime.tryParse(rawDueDate)?.toLocal() ?? DateTime.now())
        : DateTime.now();

    return CollectionRow(
      instalmentId: json['id']?.toString() ?? '',
      loanId: loan['id']?.toString() ?? '',
      loanCode: loan['loanCode']?.toString() ?? '',
      customerId: customer['id']?.toString() ?? '',
      customerName: customer['name']?.toString() ?? '—',
      customerCode: customer['customerCode']?.toString() ?? '',
      customerPhoto: customer['profilePhoto']?.toString(),
      customerPhone: customer['phone']?.toString() ?? '',
      routeName: routeName,
      dueAmount: n(json['dueAmount']),
      receivedAmount: n(json['receivedAmount']),
      dueDate: parsedDueDate,
      status: json['status']?.toString() ?? 'upcoming',
      lat: customer['lat'] == null ? null : n(customer['lat']),
      lng: customer['lng'] == null ? null : n(customer['lng']),
      // /collection/dashboard nests the receipt entry (COL-01).
      collectionEntryId: (json['collectionEntry'] is Map
              ? (json['collectionEntry'] as Map)['id']
              : json['collectionEntryId'])
          ?.toString(),
      frequency: loan['frequency']?.toString(),
      routeId: customer['routeId']?.toString() ??
          (rawRoute is Map<String, dynamic> ? rawRoute['id']?.toString() : null),
    );
  }
}

/// Server worklist totals (lib/collectionSummary.ts) — rendered as-is, never
/// recomputed on the device (COL-01, MONEY-1).
class CollectionSummary {
  const CollectionSummary({
    this.todayExpected = 0,
    this.todayCollected = 0,
    this.todayOutstanding = 0,
    this.todayPendingCount = 0,
    this.todayPaidCount = 0,
    this.overdueTotalTillToday = 0,
    this.overdueCollectedToday = 0,
    this.overdueOutstanding = 0,
    this.overduePendingCount = 0,
  });
  final double todayExpected;
  final double todayCollected;
  final double todayOutstanding;
  final int todayPendingCount;
  final int todayPaidCount;
  final double overdueTotalTillToday;
  final double overdueCollectedToday;
  final double overdueOutstanding;
  final int overduePendingCount;

  factory CollectionSummary.fromJson(Map<String, dynamic>? json) {
    final j = json ?? const <String, dynamic>{};
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return CollectionSummary(
      todayExpected: n(j['todayExpected']),
      todayCollected: n(j['todayCollected']),
      todayOutstanding: n(j['todayOutstanding']),
      todayPendingCount: n(j['todayPendingCount']).toInt(),
      todayPaidCount: n(j['todayPaidCount']).toInt(),
      overdueTotalTillToday: n(j['overdueTotalTillToday']),
      overdueCollectedToday: n(j['overdueCollectedToday']),
      overdueOutstanding: n(j['overdueOutstanding']),
      overduePendingCount: n(j['overduePendingCount']).toInt(),
    );
  }
}

/// GET /api/v1/collection/dashboard — the same payload web Collection Entry uses.
class CollectionDashboard {
  const CollectionDashboard({
    required this.rows,
    required this.summary,
    required this.summaryByRoute,
  });
  final List<CollectionRow> rows;
  final CollectionSummary summary;
  /// routeId ('' = no route) → summary.
  final Map<String, CollectionSummary> summaryByRoute;

  factory CollectionDashboard.fromJson(Map<String, dynamic> json) {
    final seen = <String>{};
    final rows = <CollectionRow>[];
    for (final key in ['todayInstalments', 'overdueInstalments']) {
      for (final e in (json[key] as List<dynamic>? ?? const [])) {
        final row = CollectionRow.fromJson(e as Map<String, dynamic>);
        if (seen.add(row.instalmentId)) rows.add(row);
      }
    }
    final byRoute = <String, CollectionSummary>{};
    final rawByRoute = json['collectionSummaryByRoute'];
    if (rawByRoute is Map) {
      rawByRoute.forEach((k, v) {
        if (v is Map<String, dynamic>) byRoute['$k'] = CollectionSummary.fromJson(v);
      });
    }
    return CollectionDashboard(
      rows: rows,
      summary: CollectionSummary.fromJson(
        json['collectionSummary'] as Map<String, dynamic>?,
      ),
      summaryByRoute: byRoute,
    );
  }
}

class SelfPayQueueItem {
  const SelfPayQueueItem({
    required this.token,
    required this.amount,
    required this.status,
    required this.channel,
    required this.createdAt,
    required this.expiresAt,
    required this.loanCode,
    required this.customerName,
    required this.customerCode,
    required this.phone,
  });

  final String token;
  final double amount;
  final String status;
  final String channel;
  final DateTime createdAt;
  final DateTime expiresAt;
  final String loanCode;
  final String customerName;
  final String customerCode;
  final String phone;

  factory SelfPayQueueItem.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return SelfPayQueueItem(
      token: (json['token'] as String?) ?? '',
      amount: n(json['amount']),
      status: (json['status'] as String?) ?? 'active',
      channel: (json['channel'] as String?) ?? 'upi',
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      expiresAt: DateTime.parse(json['expiresAt'] as String).toLocal(),
      loanCode: (json['loanCode'] as String?) ?? '',
      customerName: (json['customerName'] as String?) ?? '-',
      customerCode: (json['customerCode'] as String?) ?? '',
      phone: (json['phone'] as String?) ?? '',
    );
  }
}
