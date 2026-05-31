class PlanCatalogItem {
  const PlanCatalogItem({
    required this.id,
    required this.plan,
    required this.displayName,
    required this.monthlyPrice,
    required this.maxBranches,
    required this.maxAgents,
    required this.maxActiveLoans,
    required this.features,
    this.description,
    this.razorpayPlanId,
    required this.isActive,
  });

  final String id;
  final String plan;
  final String displayName;
  final String? description;
  final int monthlyPrice;
  final int maxBranches;
  final int maxAgents;
  final int maxActiveLoans;
  final List<String> features;
  final String? razorpayPlanId;
  final bool isActive;

  factory PlanCatalogItem.fromJson(Map<String, dynamic> json) {
    return PlanCatalogItem(
      id: json['id'] as String,
      plan: json['plan'] as String,
      displayName: json['displayName'] as String,
      description: json['description'] as String?,
      monthlyPrice: (json['monthlyPrice'] as num).toInt(),
      maxBranches: (json['maxBranches'] as num).toInt(),
      maxAgents: (json['maxAgents'] as num).toInt(),
      maxActiveLoans: (json['maxActiveLoans'] as num).toInt(),
      features: (json['features'] as List<dynamic>? ?? const <dynamic>[])
          .map((dynamic e) => e as String)
          .toList(),
      razorpayPlanId: json['razorpayPlanId'] as String?,
      isActive: (json['isActive'] as bool?) ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'plan': plan,
        'displayName': displayName,
        'description': description,
        'monthlyPrice': monthlyPrice,
        'maxBranches': maxBranches,
        'maxAgents': maxAgents,
        'maxActiveLoans': maxActiveLoans,
        'features': features,
        'razorpayPlanId': razorpayPlanId,
        'isActive': isActive,
      };
}

class ModuleCatalogItem {
  const ModuleCatalogItem({
    required this.id,
    required this.module,
    required this.displayName,
    this.description,
    required this.monthlyPrice,
    required this.isActive,
  });

  final String id;
  final String module;
  final String displayName;
  final String? description;
  final int monthlyPrice;
  final bool isActive;

  factory ModuleCatalogItem.fromJson(Map<String, dynamic> json) {
    return ModuleCatalogItem(
      id: json['id'] as String,
      module: json['module'] as String,
      displayName: json['displayName'] as String,
      description: json['description'] as String?,
      monthlyPrice: (json['monthlyPrice'] as num).toInt(),
      isActive: (json['isActive'] as bool?) ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'module': module,
        'displayName': displayName,
        'description': description,
        'monthlyPrice': monthlyPrice,
        'isActive': isActive,
      };
}

class AddonCatalogItem {
  const AddonCatalogItem({
    required this.id,
    required this.addon,
    required this.displayName,
    this.description,
    required this.monthlyPrice,
    required this.isActive,
  });

  final String id;
  final String addon;
  final String displayName;
  final String? description;
  final int monthlyPrice;
  final bool isActive;

  factory AddonCatalogItem.fromJson(Map<String, dynamic> json) {
    return AddonCatalogItem(
      id: json['id'] as String,
      addon: json['addon'] as String,
      displayName: json['displayName'] as String,
      description: json['description'] as String?,
      monthlyPrice: (json['monthlyPrice'] as num).toInt(),
      isActive: (json['isActive'] as bool?) ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'addon': addon,
        'displayName': displayName,
        'description': description,
        'monthlyPrice': monthlyPrice,
        'isActive': isActive,
      };
}

class PricingCatalog {
  const PricingCatalog({
    required this.plans,
    required this.modules,
    required this.addons,
  });

  final List<PlanCatalogItem> plans;
  final List<ModuleCatalogItem> modules;
  final List<AddonCatalogItem> addons;

  factory PricingCatalog.fromJson(Map<String, dynamic> json) {
    return PricingCatalog(
      plans: (json['plans'] as List<dynamic>? ?? const <dynamic>[])
          .map((dynamic e) => PlanCatalogItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      modules: (json['modules'] as List<dynamic>? ?? const <dynamic>[])
          .map((dynamic e) => ModuleCatalogItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      addons: (json['addons'] as List<dynamic>? ?? const <dynamic>[])
          .map((dynamic e) => AddonCatalogItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
