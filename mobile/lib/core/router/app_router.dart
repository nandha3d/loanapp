import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/features/accounting/accounting_screen.dart';
import 'package:loantrack/features/analytics/analytics_screen.dart';
import 'package:loantrack/features/approvals/approvals_screen.dart';
import 'package:loantrack/features/auth/biometric_lock_screen.dart';
import 'package:loantrack/features/admin/tracking/agent_tracking_screen.dart';
import 'package:loantrack/features/auth/login_screen.dart';
import 'package:loantrack/features/auth/registration_screen.dart';
import 'package:loantrack/features/auth/totp_screen.dart';
import 'package:loantrack/features/chits/chits_screen.dart';
import 'package:loantrack/features/collection/collection_screen.dart';
import 'package:loantrack/features/customers/customer_detail_screen.dart';
import 'package:loantrack/features/customers/customers_screen.dart';
import 'package:loantrack/features/customers/new_customer_screen.dart';
import 'package:loantrack/features/dashboard/dashboard_screen.dart';
import 'package:loantrack/features/loans/edit_loan_screen.dart';
import 'package:loantrack/features/loans/loan_detail_screen.dart';
import 'package:loantrack/features/loans/loans_screen.dart';
import 'package:loantrack/features/loans/new_loan_screen.dart';
import 'package:loantrack/features/more/more_screen.dart';
import 'package:loantrack/features/notifications/notifications_screen.dart';
import 'package:loantrack/features/penalties/penalties_screen.dart';
import 'package:loantrack/features/reports/reports_screen.dart';
import 'package:loantrack/features/settings/settings_screen.dart';
import 'package:loantrack/features/vehicles/vehicles_screen.dart';
import 'package:loantrack/features/vehicles/vehicle_detail_screen.dart';
import 'package:loantrack/features/vehicles/new_vehicle_screen.dart';
import 'package:loantrack/features/kyc/kyc_review_screen.dart';
import 'package:loantrack/features/settings/system_settings_screen.dart';
import 'package:loantrack/features/settings/penalty_settings_screen.dart';
import 'package:loantrack/features/settings/payment_settings_screen.dart';
import 'package:loantrack/features/settings/notification_settings_screen.dart';

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
  static const vehicles = 'vehicles';
  static const notifications = 'notifications';
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
      final atRegister = loc == '/register';
      final atTotp = loc == '/2fa';
      final atLock = loc == '/lock';

      if (stage == AuthStage.unauthenticated) {
        if (atRegister) return null;
        return atLogin ? null : '/login';
      }
      if (stage == AuthStage.pendingTotp) {
        return atTotp ? null : '/2fa';
      }
      if (stage == AuthStage.locked) {
        return atLock ? null : '/lock';
      }
      // Authenticated
      if (atLogin || atRegister || atTotp || atLock) return '/dashboard';

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
      GoRoute(
        path: '/register',
        builder: (_, state) {
          final googleEmail = state.uri.queryParameters['googleEmail'];
          final googleName = state.uri.queryParameters['googleName'];
          final googleId = state.uri.queryParameters['googleId'];
          final referralCode = state.uri.queryParameters['ref'] ??
              state.uri.queryParameters['referralCode'];
          return RegistrationScreen(
            googleEmail: googleEmail,
            googleName: googleName,
            googleId: googleId,
            referralCode: referralCode,
          );
        },
      ),
      GoRoute(path: '/2fa', builder: (_, __) => const TotpScreen()),
      GoRoute(path: '/lock', builder: (_, __) => const BiometricLockScreen()),
      GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
      GoRoute(
        path: '/customers',
        builder: (_, __) => const CustomersScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (_, state) {
              final returnTo = state.uri.queryParameters['returnTo'];
              return NewCustomerScreen(returnTo: returnTo);
            },
          ),
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                CustomerDetailScreen(id: state.pathParameters['id']!),
            routes: [
              GoRoute(
                path: 'edit',
                builder: (_, state) => NewCustomerScreen(
                  editCustomer: state.extra as Customer?,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/loans',
        builder: (_, __) => const LoansScreen(),
        routes: [
          GoRoute(path: 'new', builder: (_, __) => const NewLoanScreen()),
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                LoanDetailScreen(id: state.pathParameters['id']!),
            routes: [
              GoRoute(
                path: 'edit',
                builder: (_, state) => EditLoanScreen(
                  loan: state.extra as Loan,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(path: '/collection', builder: (_, __) => const CollectionScreen()),
      GoRoute(path: '/penalties', builder: (_, __) => const PenaltiesScreen()),
      GoRoute(path: '/approvals', builder: (_, __) => const ApprovalsScreen()),
      GoRoute(path: '/kyc-review', builder: (_, __) => const KycReviewScreen()),
      GoRoute(path: '/analytics', builder: (_, __) => const AnalyticsScreen()),
      GoRoute(path: '/chits', builder: (_, __) => const ChitsScreen()),
      GoRoute(path: '/accounting', builder: (_, __) => const AccountingScreen()),
      GoRoute(
        path: '/settings',
        builder: (_, __) => const SettingsScreen(),
        routes: [
          GoRoute(
            path: 'system',
            builder: (_, __) => const SystemSettingsScreen(),
          ),
          GoRoute(
            path: 'penalty',
            builder: (_, __) => const PenaltySettingsScreen(),
          ),
          GoRoute(
            path: 'payment',
            builder: (_, __) => const PaymentSettingsScreen(),
          ),
          GoRoute(
            path: 'notifications',
            builder: (_, __) => const NotificationSettingsScreen(),
          ),
        ],
      ),
      GoRoute(path: '/more', builder: (_, __) => const MoreScreen()),
      GoRoute(path: '/tracking', builder: (_, __) => const AgentTrackingScreen()),
      GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(
        path: '/vehicles',
        builder: (_, __) => const VehiclesScreen(),
        routes: [
          GoRoute(path: 'new', builder: (_, __) => const NewVehicleScreen()),
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                VehicleDetailScreen(id: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
    errorBuilder: (_, __) =>
        const Scaffold(body: Center(child: Text('Route not found'))),
  );
});

bool _moduleBlocked(String location, User user) {
  // Privileged roles always have full access — never module-gated.
  if (user.role == UserRole.admin ||
      user.role == UserRole.superadmin ||
      user.role == UserRole.developer) {
    return false;
  }
  String? required;
  if (location.startsWith('/approvals')) required = ModuleKey.approvals;
  if (location.startsWith('/analytics')) required = ModuleKey.analytics;
  if (location.startsWith('/chits')) required = ModuleKey.chits;
  if (location.startsWith('/accounting')) required = ModuleKey.accounting;
  if (location.startsWith('/settings')) required = ModuleKey.settings;
  if (location.startsWith('/reports')) required = ModuleKey.reports;
  if (location.startsWith('/vehicles')) required = ModuleKey.vehicles;
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
