import 'package:flutter_test/flutter_test.dart';

import 'package:zolofund/core/router/app_router.dart';
import 'package:zolofund/data/models/user.dart';

User _user({
  UserRole role = UserRole.agent,
  List<String> modules = const <String>[],
}) {
  return User(
    id: 'user_1',
    name: 'QA User',
    phone: '9000000000',
    username: 'qa_user',
    role: role,
    appType: 'microlending',
    status: 'active',
    totpEnabled: false,
    enabledModules: modules,
    tenantSlug: 'qa',
  );
}

void main() {
  group('MOB-RBAC router guard contracts', () {
    test('MOB-RBAC-UNIT-001 module constants match server entitlement keys', () {
      expect(ModuleKey.dashboard, 'dashboard');
      expect(ModuleKey.customers, 'customers');
      expect(ModuleKey.loans, 'loans');
      expect(ModuleKey.collection, 'collection');
      expect(ModuleKey.analytics, 'analytics');
      expect(ModuleKey.vehicles, 'vehicles');
      expect(ModuleKey.accounting, 'accounting');
    });

    test('MOB-RBAC-UNIT-002 user module entitlement helper is exact match',
        () {
      final agent = _user(modules: const ['vehicles', 'reports']);

      expect(agent.hasModule(ModuleKey.vehicles), isTrue);
      expect(agent.hasModule(ModuleKey.reports), isTrue);
      expect(agent.hasModule(ModuleKey.analytics), isFalse);
      expect(agent.hasModule('vehicle'), isFalse);
    });

    test('MOB-RBAC-UNIT-003 privileged roles are represented in model', () {
      expect(_user(role: UserRole.developer).role, UserRole.developer);
      expect(_user(role: UserRole.superadmin).role, UserRole.superadmin);
      expect(_user(role: UserRole.admin).role, UserRole.admin);
      expect(_user(role: UserRole.agent).role, UserRole.agent);
    });
  });
}
