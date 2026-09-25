import 'dart:convert';

class Approval {
  const Approval({
    required this.id,
    required this.entityType,
    required this.action,
    required this.status,
    required this.payload,
    required this.requestedByName,
    required this.createdAt,
    this.reviewNote,
    this.insufficientFloat = false,
    this.agentFloat,
    this.floatDeficit,
    this.floatWarning,
  });

  final String id;
  final String entityType; // loan | customer | branch_request | other
  final String action; // create | update | delete
  final String status; // pending | approved | rejected
  final String payload; // raw JSON snapshot
  final String requestedByName;
  final DateTime createdAt;
  final String? reviewNote;
  final bool insufficientFloat;
  final double? agentFloat;
  final double? floatDeficit;
  final String? floatWarning;

  factory Approval.fromJson(Map<String, dynamic> json) {
    final req = json['requestedBy'] as Map<String, dynamic>?;
    final payloadStr = (json['requestedChanges'] as String?) ?? (json['payload'] as String?) ?? '{}';
    bool insufficient = json['insufficientFloat'] == true;
    String? warning = json['floatWarning'] as String?;
    double? agentF = json['agentFloat'] != null ? (json['agentFloat'] as num).toDouble() : null;
    double? deficit = json['floatDeficit'] != null ? (json['floatDeficit'] as num).toDouble() : null;

    if (!insufficient && payloadStr.isNotEmpty && payloadStr != '{}') {
      try {
        final parsed = jsonDecode(payloadStr);
        if (parsed is Map<String, dynamic>) {
          if (parsed['insufficientFloat'] == true) insufficient = true;
          if (warning == null && parsed['floatWarning'] != null) warning = parsed['floatWarning'] as String;
          if (agentF == null && parsed['agentFloat'] != null) agentF = (parsed['agentFloat'] as num).toDouble();
          if (deficit == null && parsed['floatDeficit'] != null) deficit = (parsed['floatDeficit'] as num).toDouble();
        }
      } catch (_) {}
    }

    return Approval(
      id: json['id'] as String,
      entityType: (json['entityType'] as String?) ?? 'other',
      action: (json['requestType'] as String?) ?? (json['action'] as String?) ?? 'update',
      status: (json['status'] as String?) ?? 'pending',
      payload: payloadStr,
      requestedByName: (req?['name'] as String?) ?? 'Unknown',
      createdAt: DateTime.parse(json['createdAt'] as String),
      reviewNote: (json['reviewNotes'] as String?) ?? (json['reviewNote'] as String?),
      insufficientFloat: insufficient,
      agentFloat: agentF,
      floatDeficit: deficit,
      floatWarning: warning,
    );
  }
}

