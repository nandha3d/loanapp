class AppRoute {
  const AppRoute({
    required this.id,
    required this.name,
    required this.status,
    required this.customerCount,
    this.agentId,
    this.agentName,
  });
  final String id;
  final String name;
  final String status;
  final int customerCount;
  final String? agentId;
  final String? agentName;

  factory AppRoute.fromJson(Map<String, dynamic> json) {
    final agent = json['assignedAgent'] as Map<String, dynamic>?;
    final counts = (json['_count'] as Map<String, dynamic>?) ?? const {};
    return AppRoute(
      id: json['id'] as String,
      name: json['name'] as String,
      status: (json['status'] as String?) ?? 'active',
      customerCount: (counts['customers'] as num?)?.toInt() ?? 0,
      agentId: agent?['id'] as String?,
      agentName: agent?['name'] as String?,
    );
  }
}

class LoanPackage {
  const LoanPackage({
    required this.id,
    required this.name,
    required this.principal,
    required this.tenure,
    required this.frequency,
    required this.perInstalment,
    required this.penaltyRate,
  });

  final String id;
  final String name;
  final double principal;
  final int tenure;
  final String frequency;
  final double perInstalment;
  final double penaltyRate;

  factory LoanPackage.fromJson(Map<String, dynamic> json) {
    double _n(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return LoanPackage(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      principal: _n(json['principal']),
      tenure: (json['tenure'] as num?)?.toInt() ?? 0,
      frequency: (json['frequency'] as String?) ?? 'daily',
      perInstalment: _n(json['perInstalment']),
      penaltyRate: _n(json['penaltyRate']),
    );
  }
}
