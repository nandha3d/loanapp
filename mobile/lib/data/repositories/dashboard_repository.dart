import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/data/models/dashboard_summary.dart';
import 'package:loantrack/data/services/dashboard_service.dart';

class DashboardRepository {
  DashboardRepository(this._service);
  final DashboardService _service;

  Future<DashboardSummary> getSummary() => _service.getSummary();
}

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepository(ref.watch(dashboardServiceProvider)),
);

/// FutureProvider consumed by dashboard screen. `autoDispose` so the dashboard
/// refetches when navigated back to after, e.g., adding a customer.
final dashboardSummaryProvider =
    FutureProvider.autoDispose<DashboardSummary>((ref) {
  return ref.watch(dashboardRepositoryProvider).getSummary();
});
