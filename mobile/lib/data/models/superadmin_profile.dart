class SuperadminProfile {
  const SuperadminProfile({
    required this.account,
    required this.tenant,
    required this.subscription,
    required this.usage,
    required this.invoices,
  });

  final ProfileAccount account;
  final ProfileTenant tenant;
  final ProfileSubscription? subscription;
  final ProfileUsage usage;
  final List<ProfileInvoice> invoices;

  factory SuperadminProfile.fromJson(Map<String, dynamic> json) {
    return SuperadminProfile(
      account: ProfileAccount.fromJson(json['account'] as Map<String, dynamic>),
      tenant: ProfileTenant.fromJson(json['tenant'] as Map<String, dynamic>),
      subscription: json['subscription'] == null
          ? null
          : ProfileSubscription.fromJson(
              json['subscription'] as Map<String, dynamic>,
            ),
      usage: ProfileUsage.fromJson(json['usage'] as Map<String, dynamic>),
      invoices: (json['invoices'] as List<dynamic>? ?? const <dynamic>[])
          .map((dynamic e) => ProfileInvoice.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

class ProfileAccount {
  const ProfileAccount({
    required this.id,
    required this.name,
    required this.phone,
    required this.username,
    required this.role,
    required this.status,
    required this.appType,
    required this.createdAt,
    required this.totpEnabled,
    this.email,
    this.branchName,
    this.lastLoginAt,
  });

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String username;
  final String role;
  final String status;
  final String appType;
  final String? branchName;
  final DateTime createdAt;
  final DateTime? lastLoginAt;
  final bool totpEnabled;

  factory ProfileAccount.fromJson(Map<String, dynamic> json) {
    return ProfileAccount(
      id: json['id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String?,
      username: json['username'] as String,
      role: json['role'] as String,
      status: json['status'] as String,
      appType: json['appType'] as String,
      branchName: json['branchName'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      lastLoginAt: _dateOrNull(json['lastLoginAt']),
      totpEnabled: (json['totpEnabled'] as bool?) ?? false,
    );
  }
}

class ProfileTenant {
  const ProfileTenant({
    required this.id,
    required this.name,
    required this.slug,
    required this.status,
    required this.createdAt,
    this.customDomain,
  });

  final String id;
  final String name;
  final String slug;
  final String? customDomain;
  final String status;
  final DateTime createdAt;

  factory ProfileTenant.fromJson(Map<String, dynamic> json) {
    return ProfileTenant(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      customDomain: json['customDomain'] as String?,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
    );
  }
}

class ProfileSubscription {
  const ProfileSubscription({
    required this.plan,
    required this.planLabel,
    required this.status,
    required this.maxActiveLoans,
    required this.maxAgents,
    required this.maxBranches,
    required this.enabledModules,
    required this.addOns,
    required this.pricing,
    this.planDescription,
    this.trialEndsAt,
    this.currentPeriodEnd,
  });

  final String plan;
  final String planLabel;
  final String? planDescription;
  final String status;
  final DateTime? trialEndsAt;
  final DateTime? currentPeriodEnd;
  final int maxActiveLoans;
  final int maxAgents;
  final int maxBranches;
  final List<ProfileKeyLabel> enabledModules;
  final List<ProfileAddon> addOns;
  final ProfilePricing pricing;

  factory ProfileSubscription.fromJson(Map<String, dynamic> json) {
    return ProfileSubscription(
      plan: json['plan'] as String,
      planLabel: json['planLabel'] as String,
      planDescription: json['planDescription'] as String?,
      status: json['status'] as String,
      trialEndsAt: _dateOrNull(json['trialEndsAt']),
      currentPeriodEnd: _dateOrNull(json['currentPeriodEnd']),
      maxActiveLoans: _int(json['maxActiveLoans']),
      maxAgents: _int(json['maxAgents']),
      maxBranches: _int(json['maxBranches']),
      enabledModules:
          (json['enabledModules'] as List<dynamic>? ?? const <dynamic>[])
              .map((dynamic e) => ProfileKeyLabel.fromJson(e as Map<String, dynamic>))
              .toList(growable: false),
      addOns: (json['addOns'] as List<dynamic>? ?? const <dynamic>[])
          .map((dynamic e) => ProfileAddon.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      pricing: ProfilePricing.fromJson(json['pricing'] as Map<String, dynamic>),
    );
  }
}

class ProfileKeyLabel {
  const ProfileKeyLabel({required this.key, required this.label});

  final String key;
  final String label;

  factory ProfileKeyLabel.fromJson(Map<String, dynamic> json) {
    return ProfileKeyLabel(
      key: json['key'] as String,
      label: json['label'] as String,
    );
  }
}

class ProfileAddon {
  const ProfileAddon({
    required this.key,
    required this.label,
    required this.enabled,
  });

  final String key;
  final String label;
  final bool enabled;

  factory ProfileAddon.fromJson(Map<String, dynamic> json) {
    return ProfileAddon(
      key: json['key'] as String,
      label: json['label'] as String,
      enabled: (json['enabled'] as bool?) ?? false,
    );
  }
}

class ProfilePricing {
  const ProfilePricing({
    required this.basePlanPrice,
    required this.modulesPrice,
    required this.addonsPrice,
    required this.totalMonthlyPrice,
  });

  final int basePlanPrice;
  final int modulesPrice;
  final int addonsPrice;
  final int totalMonthlyPrice;

  factory ProfilePricing.fromJson(Map<String, dynamic> json) {
    return ProfilePricing(
      basePlanPrice: _int(json['basePlanPrice']),
      modulesPrice: _int(json['modulesPrice']),
      addonsPrice: _int(json['addonsPrice']),
      totalMonthlyPrice: _int(json['totalMonthlyPrice']),
    );
  }
}

class ProfileUsage {
  const ProfileUsage({
    required this.activeLoans,
    required this.activeAgents,
    required this.activeBranches,
    required this.limits,
  });

  final int activeLoans;
  final int activeAgents;
  final int activeBranches;
  final ProfileLimits limits;

  factory ProfileUsage.fromJson(Map<String, dynamic> json) {
    return ProfileUsage(
      activeLoans: _int(json['activeLoans']),
      activeAgents: _int(json['activeAgents']),
      activeBranches: _int(json['activeBranches']),
      limits: ProfileLimits.fromJson(json['limits'] as Map<String, dynamic>),
    );
  }
}

class ProfileLimits {
  const ProfileLimits({
    required this.activeLoans,
    required this.agents,
    required this.branches,
  });

  final String activeLoans;
  final String agents;
  final String branches;

  factory ProfileLimits.fromJson(Map<String, dynamic> json) {
    return ProfileLimits(
      activeLoans: json['activeLoans'] as String,
      agents: json['agents'] as String,
      branches: json['branches'] as String,
    );
  }
}

class ProfileInvoice {
  const ProfileInvoice({
    required this.id,
    required this.amount,
    required this.total,
    required this.status,
    required this.dueDate,
    required this.billingPeriod,
    required this.createdAt,
    this.paidAt,
    this.invoiceUrl,
  });

  final String id;
  final double amount;
  final double total;
  final String status;
  final DateTime dueDate;
  final DateTime? paidAt;
  final String? invoiceUrl;
  final String billingPeriod;
  final DateTime createdAt;

  factory ProfileInvoice.fromJson(Map<String, dynamic> json) {
    return ProfileInvoice(
      id: json['id'] as String,
      amount: _double(json['amount']),
      total: _double(json['total']),
      status: json['status'] as String,
      dueDate: DateTime.parse(json['dueDate'] as String).toLocal(),
      paidAt: _dateOrNull(json['paidAt']),
      invoiceUrl: json['invoiceUrl'] as String?,
      billingPeriod: json['billingPeriod'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
    );
  }
}

DateTime? _dateOrNull(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toLocal();
}

int _int(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

double _double(Object? value) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}
