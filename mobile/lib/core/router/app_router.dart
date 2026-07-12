import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/features/accounting/accounting_screen.dart';
import 'package:loantrack/features/accounting/bank_reconciliation_screen.dart';
import 'package:loantrack/features/analytics/analytics_screen.dart';
import 'package:loantrack/features/approvals/approvals_screen.dart';
import 'package:loantrack/features/auth/biometric_lock_screen.dart';
import 'package:loantrack/features/admin/tracking/agent_tracking_screen.dart';
import 'package:loantrack/features/auth/forgot_password_screen.dart';
import 'package:loantrack/features/auth/login_screen.dart';
import 'package:loantrack/features/auth/registration_screen.dart';
import 'package:loantrack/features/auth/splash_screen.dart';
import 'package:loantrack/features/auth/totp_screen.dart';
import 'package:loantrack/features/chits/chits_screen.dart';
import 'package:loantrack/features/chits/chit_detail_screen.dart';
import 'package:loantrack/features/chits/chit_form_screen.dart';
import 'package:loantrack/features/borrower/borrower_login_screen.dart';
import 'package:loantrack/features/borrower/borrower_dashboard_screen.dart';
import 'package:loantrack/features/borrower/borrower_pay_screen.dart';
import 'package:loantrack/features/collection/collection_screen.dart';
import 'package:loantrack/features/collection/collection_runs_screen.dart';
import 'package:loantrack/features/collection/run_sheet_screen.dart';
import 'package:loantrack/features/settings/payment_gateway_screen.dart';
import 'package:loantrack/features/settings/integrations_settings_screen.dart';
import 'package:loantrack/features/settings/settings_detail_screen.dart';
import 'package:loantrack/features/customers/customer_detail_screen.dart';
import 'package:loantrack/features/customers/customers_screen.dart';
import 'package:loantrack/features/customers/new_customer_screen.dart';
import 'package:loantrack/data/repositories/dashboard_repository.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/features/dashboard/dashboard_screen.dart';
import 'package:loantrack/features/loans/edit_loan_screen.dart';
import 'package:loantrack/features/loans/gold_reports_screen.dart';
import 'package:loantrack/features/loans/loan_detail_screen.dart';
import 'package:loantrack/features/loans/loans_screen.dart';
import 'package:loantrack/features/loans/new_loan_screen.dart';
import 'package:loantrack/features/more/more_screen.dart';
import 'package:loantrack/features/notifications/notifications_screen.dart';
import 'package:loantrack/features/npa/npa_screen.dart';
import 'package:loantrack/features/penalties/penalties_screen.dart';
import 'package:loantrack/features/profile/superadmin_profile_screen.dart';
import 'package:loantrack/features/profile/account_profile_screen.dart';
import 'package:loantrack/features/reports/reports_screen.dart';
import 'package:loantrack/features/wallet/wallet_screen.dart';
import 'package:loantrack/features/settings/settings_screen.dart';
import 'package:loantrack/features/vehicles/vehicles_screen.dart';
import 'package:loantrack/features/vehicles/vehicle_detail_screen.dart';
import 'package:loantrack/features/vehicles/new_vehicle_screen.dart';
import 'package:loantrack/features/kyc/kyc_review_screen.dart';
import 'package:loantrack/features/settings/system_settings_screen.dart';
import 'package:loantrack/features/settings/penalty_settings_screen.dart';
import 'package:loantrack/features/settings/payment_settings_screen.dart';
import 'package:loantrack/features/settings/notification_settings_screen.dart';
import 'package:loantrack/features/admin/developer_admin_screen.dart';
import 'package:loantrack/features/admin/portal_screen.dart';
import 'package:loantrack/features/admin/team_management_screen.dart';
import 'package:loantrack/features/admin/branch_management_screen.dart';
import 'package:loantrack/features/admin/tenant_billing_screen.dart';
import 'package:loantrack/features/admin/pricing_catalog_screen.dart';
import 'package:loantrack/features/admin/affiliate_admin_screen.dart';
import 'package:loantrack/features/admin/admin_requests_screen.dart';

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
    // Start at the branded splash so the role-based entry redirect always runs
    // on cold start (admins/superadmins → /portal, agents → /dashboard,
    // developer → /admin). Starting directly at /dashboard skipped that
    // redirect, stranding admins on the lending dashboard instead of the portal.
    initialLocation: '/splash',
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final stage = auth.stage;

      // Session bootstrap in progress → branded splash, never a flash of the
      // login or dashboard screens.
      if (stage == AuthStage.unknown) {
        return loc == '/splash' ? null : '/splash';
      }

      final atLogin = loc == '/login';
      final atRegister = loc == '/register';
      final atBorrower = loc.startsWith('/borrower');
      final atTotp = loc == '/2fa';
      final atLock = loc == '/lock';
      final atSplash = loc == '/splash';

      if (stage == AuthStage.unauthenticated) {
        if (atRegister || atBorrower) return null;
        return atLogin ? null : '/login';
      }
      if (stage == AuthStage.pendingTotp) {
        return atTotp ? null : '/2fa';
      }
      if (stage == AuthStage.locked) {
        return atLock ? null : '/lock';
      }
      // Authenticated redirect.
      final user = auth.user;
      if (user != null) {
        if (atLogin ||
            atRegister ||
            atTotp ||
            atLock ||
            atSplash ||
            loc == '/') {
          if (user.role == UserRole.developer) return '/admin';
          if (user.role == UserRole.superadmin || user.role == UserRole.admin) {
            return '/portal';
          }
          return '/dashboard';
        }
        // Redirect developer from dashboard to admin
        if (loc == '/dashboard' && user.role == UserRole.developer) {
          return '/admin';
        }
        // Module-level guard.
        final blocked = _moduleBlocked(loc, user);
        if (blocked) {
          if (user.role == UserRole.developer) return '/admin';
          if (user.role == UserRole.superadmin || user.role == UserRole.admin) {
            return '/portal';
          }
          return '/dashboard';
        }
      }
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (_, state) {
          final googleEmail = state.uri.queryParameters['googleEmail'];
          final googleName = state.uri.queryParameters['googleName'];
          final googleId = state.uri.queryParameters['googleId'];
          final googleIdToken = state.uri.queryParameters['googleIdToken'];
          final referralCode = state.uri.queryParameters['ref'] ??
              state.uri.queryParameters['referralCode'];
          return RegistrationScreen(
            googleEmail: googleEmail,
            googleName: googleName,
            googleId: googleId,
            googleIdToken: googleIdToken,
            referralCode: referralCode,
          );
        },
      ),
      GoRoute(path: '/2fa', builder: (_, __) => const TotpScreen()),
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/lock', builder: (_, __) => const BiometricLockScreen()),
      GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
      GoRoute(
        path: '/gold-reports',
        builder: (_, __) => const GoldReportsScreen(),
      ),
      GoRoute(path: '/admin', builder: (_, __) => const DeveloperAdminScreen()),
      GoRoute(
        path: '/profile',
        builder: (_, __) {
          final user = auth.user;
          if (user?.role == UserRole.superadmin) {
            return const SuperadminProfileScreen();
          }
          return const AccountProfileScreen();
        },
      ),
      GoRoute(path: '/portal', builder: (_, __) => const PortalScreen()),
      GoRoute(
        path: '/admin/team',
        builder: (_, __) => const TeamManagementScreen(),
      ),
      GoRoute(
        path: '/admin/users',
        builder: (_, __) => const TeamManagementScreen(isSuperadmin: true),
      ),
      GoRoute(
        path: '/admin/branches',
        builder: (_, __) => const BranchManagementScreen(),
      ),
      GoRoute(
        path: '/admin/billing',
        builder: (_, __) => const TenantBillingScreen(),
      ),
      GoRoute(
        path: '/portal/billing',
        builder: (_, __) => const TenantBillingScreen(),
      ),
      GoRoute(
        path: '/microlending/subscription',
        builder: (_, __) => const TenantBillingScreen(isSubscriptionOnly: true),
      ),
      GoRoute(
        path: '/admin/billing/pricing',
        builder: (_, __) => const PricingCatalogScreen(),
      ),
      GoRoute(
        path: '/admin/affiliates',
        builder: (_, __) => const AffiliateAdminScreen(),
      ),
      GoRoute(
        path: '/admin/branch-requests',
        builder: (_, __) => const AdminRequestsScreen(canReview: true),
      ),
      GoRoute(
        path: '/admin/module-requests',
        builder: (_, __) => const AdminRequestsScreen(
          isModuleOnly: true,
          canReview: true,
        ),
      ),
      GoRoute(
        path: '/microlending/affiliate',
        builder: (_, __) => const AffiliateAdminScreen(),
      ),
      GoRoute(
        path: '/microlending/branch-requests',
        builder: (_, __) => const AdminRequestsScreen(),
      ),
      GoRoute(
        path: '/microlending/module-requests',
        builder: (_, __) => const AdminRequestsScreen(isModuleOnly: true),
      ),
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
      GoRoute(
        path: '/collection',
        builder: (_, __) {
          final user = auth.user;
          if (AppType.userIsChit(user)) return const ChitsScreen();
          return const CollectionScreen();
        },
        routes: [
          GoRoute(
            path: 'runs',
            builder: (_, __) => const CollectionRunsScreen(),
          ),
          GoRoute(
            path: 'runs/:id',
            builder: (_, state) =>
                RunSheetScreen(runId: state.pathParameters['id'] ?? ''),
          ),
        ],
      ),
      GoRoute(path: '/penalties', builder: (_, __) => const PenaltiesScreen()),
      GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
      GoRoute(path: '/approvals', builder: (_, __) => const ApprovalsScreen()),
      GoRoute(path: '/kyc-review', builder: (_, __) => const KycReviewScreen()),
      GoRoute(path: '/analytics', builder: (_, __) => const AnalyticsScreen()),
      GoRoute(
        path: '/chits',
        builder: (_, __) => const ChitsScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (_, __) => const ChitGroupFormScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (_, state) =>
                ChitDetailScreen(id: state.pathParameters['id']!),
            routes: [
              GoRoute(
                path: 'edit',
                builder: (_, state) => ChitGroupFormScreen(
                  editData: state.extra as Map<String, dynamic>?,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/borrower/login',
        builder: (_, __) => const BorrowerLoginScreen(),
      ),
      GoRoute(
        path: '/borrower/dashboard',
        builder: (_, __) => const BorrowerDashboardScreen(),
      ),
      GoRoute(
        path: '/borrower/pay',
        builder: (_, __) => const BorrowerPayScreen(),
      ),
      GoRoute(path: '/npa', builder: (_, __) => const NpaScreen()),
      GoRoute(
        path: '/accounting',
        builder: (_, __) => const AccountingScreen(),
      ),
      GoRoute(
        path: '/accounting/bank-rec',
        builder: (_, __) => const BankReconciliationScreen(),
      ),
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
            path: 'payment-gateway',
            builder: (_, __) => const PaymentGatewayScreen(),
          ),
          GoRoute(
            path: 'integrations',
            builder: (_, __) => const IntegrationsSettingsScreen(),
          ),
          GoRoute(
            path: 'notifications',
            builder: (_, __) => const NotificationSettingsScreen(),
          ),
          GoRoute(
            path: 'packages',
            builder: (_, __) => const SettingsDetailScreen(
              title: 'Loan Packages',
              type: 'packages',
            ),
          ),
          GoRoute(
            path: 'bulk',
            builder: (_, __) => const SettingsDetailScreen(
              title: 'Bulk Collection',
              type: 'bulk',
            ),
          ),
          GoRoute(
            path: 'bureau',
            builder: (_, __) => const SettingsDetailScreen(
              title: 'Bureau Configuration',
              type: 'bureau',
            ),
          ),
          GoRoute(
            path: 'npa',
            builder: (_, __) =>
                const SettingsDetailScreen(title: 'NPA Settings', type: 'npa'),
          ),
          GoRoute(
            path: 'security',
            builder: (_, __) => const SettingsDetailScreen(
              title: 'Security & Locks',
              type: 'security',
            ),
          ),
          GoRoute(
            path: 'branding',
            builder: (_, __) => const SettingsDetailScreen(
              title: 'Branding & Documents',
              type: 'branding',
            ),
          ),
        ],
      ),
      GoRoute(path: '/more', builder: (_, __) => const MoreScreen()),
      GoRoute(
        path: '/tracking',
        builder: (_, __) => const AgentTrackingScreen(),
      ),
      GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),
      GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsScreen(),
      ),
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
  if (AppType.userIsChit(user) && location.startsWith('/loans/new')) {
    return true;
  }
  if (AppType.userIsChit(user) && location.startsWith('/wallet')) {
    return true;
  }

  // First, check administrative / developer routes.
  // /admin (root developer dashboard)
  if (location == '/admin') {
    return user.role != UserRole.developer;
  }

  // /admin/team (team management)
  if (location == '/admin/team') {
    return user.role != UserRole.admin &&
        user.role != UserRole.superadmin &&
        user.role != UserRole.developer;
  }

  // /admin/users (user management)
  if (location == '/admin/users') {
    return user.role != UserRole.superadmin && user.role != UserRole.developer;
  }

  // /admin/branches (branch management)
  if (location == '/admin/branches') {
    return user.role != UserRole.superadmin && user.role != UserRole.developer;
  }

  // /admin/billing and subroutes (developer billing/pricing)
  if (location.startsWith('/admin/billing')) {
    return user.role != UserRole.developer;
  }

  // /admin/affiliates (developer affiliates)
  if (location == '/admin/affiliates') {
    return user.role != UserRole.developer;
  }

  // /admin/branch-requests and /admin/module-requests
  if (location == '/admin/branch-requests' ||
      location == '/admin/module-requests') {
    return user.role != UserRole.developer;
  }

  // /portal (app selector/hub)
  if (location == '/portal') {
    return user.role != UserRole.superadmin && user.role != UserRole.admin;
  }

  // /profile — superadmin gets the richer account/subscription/security
  // screen; every other authenticated role gets the generic account
  // profile (see the GoRoute builder below). No role block here.

  // /portal/billing
  if (location == '/portal/billing') {
    return user.role != UserRole.superadmin;
  }

  // /microlending/subscription
  if (location == '/microlending/subscription') {
    return user.role != UserRole.superadmin;
  }

  // /microlending/affiliate
  if (location == '/microlending/affiliate') {
    return user.role != UserRole.superadmin;
  }

  // /microlending/branch-requests and /microlending/module-requests
  if (location.startsWith('/microlending/branch-requests') ||
      location.startsWith('/microlending/module-requests')) {
    return user.role != UserRole.superadmin;
  }

  if (location.startsWith('/npa')) {
    return user.role != UserRole.admin &&
        user.role != UserRole.superadmin &&
        user.role != UserRole.developer;
  }

  // /settings/system mirrors the developer-only web system tab.
  if (location == '/settings/system') {
    return user.role != UserRole.developer;
  }

  // Privileged roles always have full access to business modules.
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
      (prev, next) {
        // The main list/dashboard providers are cached (no autoDispose) for
        // instant navigation. Clear them when the session ends so the next
        // user never sees the previous user's cached data.
        if (prev?.stage == AuthStage.authenticated &&
            next.stage != AuthStage.authenticated) {
          _ref.invalidate(dashboardSummaryProvider);
          _ref.invalidate(customerListProvider);
          _ref.invalidate(loansProvider);
          _ref.invalidate(collectionTodayProvider);
        }
        notifyListeners();
      },
    );
  }
  final Ref _ref;
}
