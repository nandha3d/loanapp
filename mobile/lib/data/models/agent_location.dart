double? _dOrNull(dynamic v) =>
    v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
double _d(dynamic v) => _dOrNull(v) ?? 0.0;

class AgentLocation {
  const AgentLocation({
    required this.agentId,
    required this.agentName,
    required this.agentPhone,
    required this.online,
    required this.todayCollected,
    required this.todayEntries,
    this.lat,
    this.lng,
    this.capturedAt,
  });

  final String agentId;
  final String agentName;
  final String agentPhone;
  final bool online;
  final double todayCollected;
  final int todayEntries;
  final double? lat;
  final double? lng;
  final DateTime? capturedAt;

  bool get hasLocation => lat != null && lng != null;

  factory AgentLocation.fromJson(Map<String, dynamic> json) {
    return AgentLocation(
      agentId: json['agentId'] as String,
      agentName: (json['agentName'] as String?) ?? '—',
      agentPhone: (json['agentPhone'] as String?) ?? '',
      online: (json['online'] as bool?) ?? false,
      todayCollected: _d(json['todayCollected']),
      todayEntries: (json['todayEntries'] as num?)?.toInt() ?? 0,
      lat: _dOrNull(json['lat']),
      lng: _dOrNull(json['lng']),
      capturedAt: json['capturedAt'] == null
          ? null
          : DateTime.parse(json['capturedAt'] as String).toLocal(),
    );
  }
}

/// One of an agent's collection entries for today (customer, due, collected).
class AgentCollection {
  const AgentCollection({
    required this.id,
    required this.customerName,
    required this.customerCode,
    required this.dueAmount,
    required this.receivedAmount,
    this.paymentMode,
    this.submittedAt,
    this.customerPhoto,
    this.lat,
    this.lng,
  });

  final String id;
  final String customerName;
  final String customerCode;
  final double dueAmount;
  final double receivedAmount;
  final String? paymentMode;
  final DateTime? submittedAt;
  final String? customerPhoto;
  // Where the entry was collected — photo pin position on the tracking map.
  final double? lat;
  final double? lng;

  bool get hasLocation => lat != null && lng != null;

  factory AgentCollection.fromJson(Map<String, dynamic> json) {
    return AgentCollection(
      id: json['id'] as String,
      customerName: (json['customerName'] as String?) ?? '—',
      customerCode: (json['customerCode'] as String?) ?? '',
      dueAmount: _d(json['dueAmount']),
      receivedAmount: _d(json['receivedAmount']),
      paymentMode: json['paymentMode'] as String?,
      submittedAt: json['submittedAt'] == null
          ? null
          : DateTime.parse(json['submittedAt'] as String).toLocal(),
      customerPhoto: json['customerPhoto'] as String?,
      lat: _dOrNull(json['lat']),
      lng: _dOrNull(json['lng']),
    );
  }
}

/// One raw location ping from the agent's trail (history endpoint).
class AgentPing {
  const AgentPing({
    required this.lat,
    required this.lng,
    required this.capturedAt,
    this.accuracyM,
    this.speedMps,
    this.isMocked = false,
  });

  final double lat;
  final double lng;
  final DateTime capturedAt;
  final double? accuracyM;
  final double? speedMps;
  final bool isMocked;

  factory AgentPing.fromJson(Map<String, dynamic> json) {
    return AgentPing(
      lat: _d(json['lat']),
      lng: _d(json['lng']),
      capturedAt: DateTime.parse(json['capturedAt'] as String).toLocal(),
      accuracyM: _dOrNull(json['accuracyM']),
      speedMps: _dOrNull(json['speedMps']),
      isMocked: (json['isMocked'] as bool?) ?? false,
    );
  }
}
