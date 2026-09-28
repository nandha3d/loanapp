import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/data/models/chit_dashboard_summary.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';
import 'package:zolofund/data/services/dashboard_service.dart';

class DashboardRepository {
  DashboardRepository(this._service);
  final DashboardService _service;

  static DashboardSummary? _cachedSummary;
  static ChitDashboardSummary? _cachedChitSummary;

  static DashboardSummary? get cachedSummary => _cachedSummary;
  static ChitDashboardSummary? get cachedChitSummary => _cachedChitSummary;

  Future<DashboardSummary> getSummary() async {
    try {
      final summary = await _service.getSummary();
      _cachedSummary = summary;
      return summary;
    } catch (e) {
      if (_cachedSummary != null) {
        return _cachedSummary!;
      }
      rethrow;
    }
  }

  Future<ChitDashboardSummary> getChitSummary() async {
    try {
      final chit = await _service.getChitSummary();
      _cachedChitSummary = chit;
      return chit;
    } catch (e) {
      if (_cachedChitSummary != null) {
        return _cachedChitSummary!;
      }
      rethrow;
    }
  }

  Future<TodaysActivityBundle> getActivities({DateTime? from, DateTime? to}) =>
      _service.getActivities(from: from, to: to);
}

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepository(ref.watch(dashboardServiceProvider)),
);

/// FutureProvider consumed by dashboard screen. NOT autoDispose — the cache
/// persists across tab switches so returning to the dashboard is instant.
/// Pull-to-refresh calls ref.refresh(dashboardSummaryProvider.future) to
/// force a network round-trip when the user explicitly requests it.
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
