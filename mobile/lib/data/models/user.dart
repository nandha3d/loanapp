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
  });

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String username;
  final UserRole role;
  final String? branchId;
  final String appType; // "microlending" | "chit"
  final String status; // "active" | "suspended"
  final bool totpEnabled;

  /// Server-driven module visibility list (spec §5).
  final List<String> enabledModules;

  /// Tenant slug — needed for X-Tenant-Slug header.
  final String? tenantSlug;

  bool hasModule(String module) => enabledModules.contains(module);

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
      tenantSlug: json['tenantSlug'] as String?,
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
        'tenantSlug': tenantSlug,
      };
}
