/// User model — spec §3.1. Field names and nullability exact.
enum UserRole {
  developer,
  superadmin,
  admin,
  agent;

  static UserRole fromJson(String raw) {
    return UserRole.values.firstWhere(
      (r) => r.name == raw,
      orElse: () => UserRole.agent,
    );
  }

  String toJson() => name;
}

class AppType {
  const AppType._();

  static const microlending = 'microlending';
  static const autofinance = 'autofinance';
  static const chitfunds = 'chitfunds';
  static const goldloan = 'goldloan';
  static const property = 'property';
  static const productfinance = 'productfinance';
  static const legacyChit = 'chit';

  static const all = <String>{
    microlending,
    autofinance,
    chitfunds,
    goldloan,
    property,
    productfinance,
  };

  static bool isChit(String? value) =>
      value == chitfunds || value == legacyChit;

  static bool userIsChit(User? user) => isChit(user?.appType);

  static bool userHasChits(User? user) =>
      userIsChit(user) || (user?.hasModule(chitfunds) ?? false);

  static String normalize(String module) =>
      module == legacyChit ? chitfunds : module;

  static bool isSupported(String module) => all.contains(normalize(module));

  static String label(String module) {
    switch (normalize(module)) {
      case microlending:
        return 'Microlending';
      case autofinance:
        return 'Auto Finance';
      case chitfunds:
        return 'Chit Funds';
      case goldloan:
        return 'Gold Loan';
      case property:
        return 'Property Loan';
      case productfinance:
        return 'Product Finance';
      default:
        return module;
    }
  }

  static String landingRoute(String module) {
    switch (normalize(module)) {
      case autofinance:
        return '/vehicles';
      case chitfunds:
        return '/chits';
      default:
        return '/dashboard';
    }
  }
}

class User {
  const User({
    required this.id,
    required this.name,
    required this.phone,
    required this.username,
    required this.role,
    required this.appType,
    required this.status,
    required this.totpEnabled,
    required this.enabledModules,
    this.email,
    this.branchId,
    this.tenantSlug,
    this.biometricLockRequired = false,
    this.gpsTrackingEnabled = false,
    this.npaEnabled = false,
    this.kycEnabled = false,
    this.bureauEnabled = false,
    this.premiumAccountingEnabled = false,
    this.whatsappSmsEnabled = false,
    this.foreclosureEnabled = false,
    this.verticals = const [],
  });

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String username;
  final UserRole role;
  final String? branchId;
  final String appType; // See AppType constants.
  final String status; // "active" | "suspended"
  final bool totpEnabled;

  /// Server-driven module visibility list (spec §5).
  final List<String> enabledModules;

  /// Subscribed application verticals (microlending, chitfunds, autofinance, etc.)
  final List<String> verticals;

  /// Tenant slug — needed for X-Tenant-Slug header.
  final String? tenantSlug;

  /// Tenant security policy (Settings → Security): only when true does the
  /// app gate a stored session behind the biometric lock screen.
  final bool biometricLockRequired;

  /// Whether the tenant subscribed to GPS tracking add-on.
  final bool gpsTrackingEnabled;

  /// Subscription add-on flags
  final bool npaEnabled;
  final bool kycEnabled;
  final bool bureauEnabled;
  final bool premiumAccountingEnabled;
  final bool whatsappSmsEnabled;
  final bool foreclosureEnabled;

  bool hasModule(String module) => enabledModules.contains(module);

  bool isAddonSubscribed(String addonKey) {
    if (role == UserRole.developer) return true;
    switch (addonKey.toLowerCase()) {
      case 'npa':
      case 'npaenabled':
        return npaEnabled;
      case 'gps_tracking':
      case 'gpstrackingenabled':
        return gpsTrackingEnabled;
      case 'kyc':
      case 'kycenabled':
        return kycEnabled;
      case 'bureau':
      case 'bureauenabled':
        return bureauEnabled;
      case 'premium_accounting':
      case 'premiumaccountingenabled':
      case 'accounting':
        return premiumAccountingEnabled;
      case 'whatsapp_sms':
      case 'whatsappsmsenabled':
        return whatsappSmsEnabled;
      case 'foreclosure':
      case 'foreclosureenabled':
        return foreclosureEnabled;
      default:
        return false;
    }
  }

  User copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? username,
    UserRole? role,
    String? branchId,
    String? appType,
    String? status,
    bool? totpEnabled,
    List<String>? enabledModules,
    String? tenantSlug,
    bool? biometricLockRequired,
    bool? gpsTrackingEnabled,
    bool? npaEnabled,
    bool? kycEnabled,
    bool? bureauEnabled,
    bool? premiumAccountingEnabled,
    bool? whatsappSmsEnabled,
    bool? foreclosureEnabled,
    List<String>? verticals,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      username: username ?? this.username,
      role: role ?? this.role,
      branchId: branchId ?? this.branchId,
      appType: appType ?? this.appType,
      status: status ?? this.status,
      totpEnabled: totpEnabled ?? this.totpEnabled,
      enabledModules: enabledModules ?? this.enabledModules,
      verticals: verticals ?? this.verticals,
      tenantSlug: tenantSlug ?? this.tenantSlug,
      biometricLockRequired:
          biometricLockRequired ?? this.biometricLockRequired,
      gpsTrackingEnabled: gpsTrackingEnabled ?? this.gpsTrackingEnabled,
      npaEnabled: npaEnabled ?? this.npaEnabled,
      kycEnabled: kycEnabled ?? this.kycEnabled,
      bureauEnabled: bureauEnabled ?? this.bureauEnabled,
      premiumAccountingEnabled:
          premiumAccountingEnabled ?? this.premiumAccountingEnabled,
      whatsappSmsEnabled: whatsappSmsEnabled ?? this.whatsappSmsEnabled,
      foreclosureEnabled: foreclosureEnabled ?? this.foreclosureEnabled,
    );
  }

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String?,
      username: json['username'] as String,
      role: UserRole.fromJson(json['role'] as String),
      branchId: json['branchId'] as String?,
      appType: json['appType'] as String,
      status: json['status'] as String,
      totpEnabled: (json['totpEnabled'] as bool?) ?? false,
      enabledModules:
          (json['enabledModules'] as List<dynamic>? ?? const <dynamic>[])
              .map((dynamic e) => e as String)
              .toList(growable: false),
      verticals:
          (json['verticals'] as List<dynamic>? ?? const <dynamic>[])
              .map((dynamic e) => e.toString())
              .toList(growable: false),
      tenantSlug: json['tenantSlug'] as String?,
      biometricLockRequired: (json['biometricLockRequired'] as bool?) ?? false,
      gpsTrackingEnabled: (json['gpsTrackingEnabled'] as bool?) ?? false,
      npaEnabled: (json['npaEnabled'] as bool?) ?? false,
      kycEnabled: (json['kycEnabled'] as bool?) ?? false,
      bureauEnabled: (json['bureauEnabled'] as bool?) ?? false,
      premiumAccountingEnabled:
          (json['premiumAccountingEnabled'] as bool?) ?? false,
      whatsappSmsEnabled: (json['whatsappSmsEnabled'] as bool?) ?? false,
      foreclosureEnabled: (json['foreclosureEnabled'] as bool?) ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'username': username,
        'role': role.toJson(),
        'branchId': branchId,
        'appType': appType,
        'status': status,
        'totpEnabled': totpEnabled,
        'enabledModules': enabledModules,
        'verticals': verticals,
        'tenantSlug': tenantSlug,
        'biometricLockRequired': biometricLockRequired,
        'gpsTrackingEnabled': gpsTrackingEnabled,
        'npaEnabled': npaEnabled,
        'kycEnabled': kycEnabled,
        'bureauEnabled': bureauEnabled,
        'premiumAccountingEnabled': premiumAccountingEnabled,
        'whatsappSmsEnabled': whatsappSmsEnabled,
        'foreclosureEnabled': foreclosureEnabled,
      };
}
