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
    double? d(dynamic v) => v == null ? null : (v as num).toDouble();
    return AgentLocation(
      agentId: json['agentId'] as String,
      agentName: (json['agentName'] as String?) ?? '—',
      agentPhone: (json['agentPhone'] as String?) ?? '',
      online: (json['online'] as bool?) ?? false,
      todayCollected: (json['todayCollected'] as num?)?.toDouble() ?? 0,
      todayEntries: (json['todayEntries'] as num?)?.toInt() ?? 0,
      lat: d(json['lat']),
      lng: d(json['lng']),
      capturedAt: json['capturedAt'] == null
          ? null
          : DateTime.parse(json['capturedAt'] as String).toLocal(),
    );
  }
}
