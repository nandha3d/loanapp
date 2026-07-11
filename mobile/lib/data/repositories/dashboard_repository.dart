import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/data/models/chit_dashboard_summary.dart';
import 'package:loantrack/data/models/dashboard_summary.dart';
import 'package:loantrack/data/services/dashboard_service.dart';

class DashboardRepository {
  DashboardRepository(this._service);
  final DashboardService _service;

  Future<DashboardSummary> getSummary() => _service.getSummary();

  Future<ChitDashboardSummary> getChitSummary() => _service.getChitSummary();
}

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepository(ref.watch(dashboardServiceProvider)),
);

/// FutureProvider consumed by dashboard screen. `autoDispose` so the dashboard
/// refetches when navigated back to after, e.g., adding a customer.
final dashboardSummaryProvider =
    FutureProvider<DashboardSummary>((ref) {
  return ref.watch(dashboardRepositoryProvider).getSummary();
});

/// Chit-funds home dashboard (GET /dashboard/chits) — watched only when the
/// signed-in user is a chit tenant (AppType.userIsChit).
final chitDashboardSummaryProvider =
    FutureProvider<ChitDashboardSummary>((ref) {
  return ref.watch(dashboardRepositoryProvider).getChitSummary();
});
