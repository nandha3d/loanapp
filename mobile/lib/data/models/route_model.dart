class AppRoute {
  const AppRoute({
    required this.id,
    required this.name,
    required this.status,
    required this.customerCount,
    this.agentId,
    this.agentName,
    this.branchId,
    this.sharedAgents = const [],
  });
  final String id;
  final String name;
  final String status;
  final int customerCount;
  final String? agentId;
  final String? agentName;
  final String? branchId;
  final List<RouteAssignedAgent> sharedAgents;

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
      branchId: json['branchId'] as String?,
      sharedAgents: (json['routeAgents'] as List<dynamic>? ?? const [])
          .map((dynamic item) => RouteAssignedAgent.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

class RouteAssignedAgent {
  const RouteAssignedAgent({required this.id, required this.name});
  final String id;
  final String name;

  factory RouteAssignedAgent.fromJson(Map<String, dynamic> json) {
    final agent = json['agent'] as Map<String, dynamic>? ?? const {};
    return RouteAssignedAgent(
      id: json['agentId'] as String,
      name: agent['name'] as String? ?? '',
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
    required this.deduction,
    required this.deductionType,
    required this.status,
    this.branchId,
  });

  final String id;
  final String name;
  final double principal;
  final int tenure;
  final String frequency;
  final double perInstalment;
  final double penaltyRate;
  final double deduction;
  final String deductionType;
  final String status;
  final String? branchId;

  factory LoanPackage.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return LoanPackage(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      principal: n(json['principal']),
      tenure: (json['tenure'] as num?)?.toInt() ?? 0,
      frequency: (json['frequency'] as String?) ?? 'daily',
      perInstalment: n(json['perInstalment']),
      penaltyRate: n(json['penaltyRate']),
      deduction: n(json['deduction']),
      deductionType: json['deductionType'] as String? ?? 'fixed',
      status: json['status'] as String? ?? 'active',
      branchId: json['branchId'] as String?,
    );
  }
}
