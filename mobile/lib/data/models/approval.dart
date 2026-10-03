import 'dart:convert';

import 'package:zolofund/data/models/loan_funding.dart';

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
    this.reason,
    this.reviewedByName,
    this.reviewedAt,
    this.insufficientFloat = false,
    this.agentFloat,
    this.floatDeficit,
    this.floatWarning,
    this.funding,
    this.changeLabels = const {},
  });

  final String id;
  final String entityType; // loan | customer | branch_request | other
  final String action; // create | update | delete
  final String status; // pending | approved | rejected
  final String payload; // raw JSON snapshot
  final String requestedByName;
  final DateTime createdAt;
  final String? reviewNote;
  final String? reason;
  final String? reviewedByName;
  /// When the request was approved or rejected.
  final DateTime? reviewedAt;
  final bool insufficientFloat;
  final double? agentFloat;
  final double? floatDeficit;
  final String? floatWarning;
  /// FUND-3: server-computed funding for a pending loan (null for other requests).
  final LoanFunding? funding;
  /// Server-resolved display names for id fields in [payload] (routeId, agentId, branchId).
  final Map<String, String> changeLabels;

  factory Approval.fromJson(Map<String, dynamic> json) {
    final req = json['requestedBy'] as Map<String, dynamic>?;
    final rawChanges = json['requestedChanges'] ?? json['payload'];
    final payloadStr = rawChanges is String
        ? rawChanges
        : rawChanges != null
            ? jsonEncode(rawChanges)
            : '{}';
    bool insufficient = json['insufficientFloat'] == true;
    String? warning = json['floatWarning'] as String?;
    double? toD(dynamic v) =>
        v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
    double? agentF = toD(json['agentFloat']);
    double? deficit = toD(json['floatDeficit']);

    if (!insufficient && payloadStr.isNotEmpty && payloadStr != '{}') {
      try {
        final parsed = jsonDecode(payloadStr);
        if (parsed is Map<String, dynamic>) {
          if (parsed['insufficientFloat'] == true) insufficient = true;
          if (warning == null && parsed['floatWarning'] != null) warning = parsed['floatWarning'] as String;
          if (agentF == null && parsed['agentFloat'] != null) agentF = toD(parsed['agentFloat']);
          if (deficit == null && parsed['floatDeficit'] != null) deficit = toD(parsed['floatDeficit']);
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
      createdAt: json['createdAt'] == null
          ? DateTime.now()
          : DateTime.tryParse(json['createdAt'] as String)?.toLocal() ?? DateTime.now(),
      reviewNote: (json['reviewNotes'] as String?) ?? (json['reviewNote'] as String?),
      reason: json['reason'] as String?,
      reviewedByName: (json['reviewedBy'] as Map<String, dynamic>?)?['name'] as String?,
      reviewedAt: json['reviewedAt'] == null
          ? null
          : DateTime.tryParse(json['reviewedAt'].toString())?.toLocal(),
      insufficientFloat: insufficient,
      agentFloat: agentF,
      floatDeficit: deficit,
      floatWarning: warning,
      funding: LoanFunding.tryParse(json['funding']),
      changeLabels: json['changeLabels'] is Map
          ? (json['changeLabels'] as Map).map((k, v) => MapEntry('$k', '$v'))
          : const {},
    );
  }
}

