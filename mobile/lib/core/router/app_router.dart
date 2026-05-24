import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/features/accounting/accounting_screen.dart';
import 'package:loantrack/features/analytics/analytics_screen.dart';
import 'package:loantrack/features/approvals/approvals_screen.dart';
import 'package:loantrack/features/auth/biometric_lock_screen.dart';
import 'package:loantrack/features/auth/login_screen.dart';
import 'package:loantrack/features/auth/totp_screen.dart';
import 'package:loantrack/features/chits/chit_detail_screen.dart';
import 'package:loantrack/features/chits/chits_screen.dart';
import 'package:loantrack/features/collection/collection_screen.dart';
import 'package:loantrack/features/customers/customer_detail_screen.dart';
import 'package:loantrack/features/customers/customers_screen.dart';
import 'package:loantrack/features/customers/new_customer_screen.dart';
import 'package:loantrack/features/dashboard/dashboard_screen.dart';
import 'package:loantrack/features/loans/loans_screen.dart';
import 'package:loantrack/features/notifications/notifications_screen.dart';
import 'package:loantrack/features/penalties/penalties_screen.dart';
import 'package:loantrack/features/reports/report_preview_screen.dart';
import 'package:loantrack/features/reports/reports_screen.dart';
import 'package:loantrack/features/more/more_screen.dart';
import 'package:loantrack/features/accounting/accounting_screen.dart';
import 'package:loantrack/features/settings/settings_screen.dart';
import 'package:loantrack/features/settings/settings_subscreens.dart';

/// Module keys — server returns these in `User.enabledModules` (spec §5).
class ModuleKey {
  ModuleKey._();
  static const dashboard = 'dashboard';
  static const customers = 'customers';
  static const loans = 'loans';
  static const collection = 'collection';
  static const penalties = 'penalties';
  static const approvals = 'approvals';
  static const analytics = 'analytics';
  static const chits = 'chits';
  static const reports = 'reports';
  static const accounting = 'accounting';
  static const settings = 'settings';
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final stage = auth.stage;

      if (stage == AuthStage.unknown) return null;

      final atLogin = loc == '/login';
      final atTotp = loc == '/2fa';
      final atLock = loc == '/lock';

      if (stage == AuthStage.unauthenticated) {
        return atLogin ? null : '/login';
      }
      if (stage == AuthStage.pendingTotp) {
        return atTotp ? null : '/2fa';
      }
      if (stage == AuthStage.locked) {
        return atLock ? null : '/lock';
      }
      // Authenticated
      if (atLogin || atTotp || atLock) return '/dashboard';

      // Module-level guard.
      final user = auth.user;
      if (user != null) {
        final blocked = _moduleBlocked(loc, user);
        if (blocked) return '/dashboard';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/2fa', builder: (_, __) => const TotpScreen()),
      GoRoute(path: '/lock', builder: (_, __) => const BiometricLockScreen()),
      GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
      GoRoute(
        path: '/customers',
        builder: (_, __) => const CustomersScreen(),
        routes: [
          GoRoute(path: 'new', builder: (_, __) => const NewCustomerScreen()),
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                CustomerDetailScreen(id: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(path: '/loans', builder: (_, __) => const LoansScreen()),
      GoRoute(path: '/collection', builder: (_, __) => const CollectionScreen()),
      GoRoute(path: '/penalties', builder: (_, __) => const PenaltiesScreen()),
      GoRoute(path: '/approvals', builder: (_, __) => const ApprovalsScreen()),
      GoRoute(path: '/analytics', builder: (_, __) => const AnalyticsScreen()),
      GoRoute(
        path: '/chits',
        builder: (_, __) => const ChitsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                ChitDetailScreen(id: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/reports',
        builder: (_, __) => const ReportsScreen(),
        routes: [
          GoRoute(
            path: 'preview',
            builder: (_, state) {
              final extra = (state.extra as Map<String, dynamic>?) ?? const {};
              return ReportPreviewScreen(
                type: (extra['type'] as String?) ?? 'daily',
                from: (extra['from'] as DateTime?) ??
                    DateTime.now().subtract(const Duration(days: 7)),
                to: (extra['to'] as DateTime?) ?? DateTime.now(),
              );
            },
          ),
        ],
      ),
      GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsScreen(),
      ),
      GoRoute(path: '/accounting', builder: (_, __) => const AccountingScreen()),
      GoRoute(path: '/more', builder: (_, __) => const MoreScreen()),
      GoRoute(
        path: '/settings',
        builder: (_, __) => const SettingsScreen(),
        routes: [
          GoRoute(path: 'routes', builder: (_, __) => const RoutesScreen()),
          GoRoute(path: 'packages', builder: (_, __) => const PackagesScreen()),
          GoRoute(
            path: 'penalty-rate',
            builder: (_, __) => const PenaltyRateScreen(),
          ),
          GoRoute(path: 'upi-qr', builder: (_, __) => const UpiQrScreen()),
          GoRoute(path: '2fa', builder: (_, __) => const TwoFactorScreen()),
          GoRoute(
            path: 'users',
            builder: (_, __) => const UserManagementStub(),
          ),
        ],
      ),
    ],
    errorBuilder: (_, __) =>
        const Scaffold(body: Center(child: Text('Route not found'))),
  );
});

bool _moduleBlocked(String location, User user) {
  String? required;
  if (location.startsWith('/approvals')) required = ModuleKey.approvals;
  if (location.startsWith('/analytics')) required = ModuleKey.analytics;
  if (location.startsWith('/chits')) required = ModuleKey.chits;
  if (location.startsWith('/accounting')) required = ModuleKey.accounting;
  if (location.startsWith('/settings')) required = ModuleKey.settings;
  if (required == null) return false;

  if (user.enabledModules.isNotEmpty) {
    return !user.hasModule(required);
  }
  // Fallback RBAC when server omits the list.
  switch (required) {
    case ModuleKey.approvals:
    case ModuleKey.analytics:
    case ModuleKey.settings:
      return user.role == UserRole.agent;
    default:
      return false;
  }
}

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(this._ref) {
    _ref.listen<AuthState>(
      authControllerProvider,
      (_, __) => notifyListeners(),
    );
  }
  final Ref _ref;
}
