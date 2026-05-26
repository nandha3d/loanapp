class AgentLocation {
  const AgentLocation({
    required this.agentId,
    required this.agentName,
    required this.agentPhone,
    required this.lat,
    required this.lng,
    required this.capturedAt,
  });

  final String agentId;
  final String agentName;
  final String agentPhone;
  final double lat;
  final double lng;
  final DateTime capturedAt;

  factory AgentLocation.fromJson(Map<String, dynamic> json) {
    return AgentLocation(
      agentId: json['agentId'] as String,
      agentName: json['agentName'] as String,
      agentPhone: json['agentPhone'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      capturedAt: DateTime.parse(json['capturedAt'] as String).toLocal(),
    );
  }
}
