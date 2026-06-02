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
  });

  final String id;
  final String entityType; // loan | customer | branch_request | other
  final String action; // create | update | delete
  final String status; // pending | approved | rejected
  final String payload; // raw JSON snapshot
  final String requestedByName;
  final DateTime createdAt;
  final String? reviewNote;

  factory Approval.fromJson(Map<String, dynamic> json) {
    final req = json['requestedBy'] as Map<String, dynamic>?;
    return Approval(
      id: json['id'] as String,
      entityType: (json['entityType'] as String?) ?? 'other',
      action: (json['requestType'] as String?) ?? (json['action'] as String?) ?? 'update',
      status: (json['status'] as String?) ?? 'pending',
      payload: (json['requestedChanges'] as String?) ?? (json['payload'] as String?) ?? '{}',
      requestedByName: (req?['name'] as String?) ?? 'Unknown',
      createdAt: DateTime.parse(json['createdAt'] as String),
      reviewNote: (json['reviewNotes'] as String?) ?? (json['reviewNote'] as String?),
    );
  }
}
