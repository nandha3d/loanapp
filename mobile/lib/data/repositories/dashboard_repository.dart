import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/data/models/chit_dashboard_summary.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';
import 'package:zolofund/data/services/dashboard_service.dart';

class DashboardRepository {
  DashboardRepository(this._service);
  final DashboardService _service;

  static String? _cachedScopeKey;
  static DashboardSummary? _cachedSummary;
  static ChitDashboardSummary? _cachedChitSummary;

  static DashboardSummary? cachedSummaryFor(String? scopeKey) {
    if (scopeKey == null || _cachedScopeKey != scopeKey) return null;
    return _cachedSummary;
  }

  static ChitDashboardSummary? cachedChitSummaryFor(String? scopeKey) {
    if (scopeKey == null || _cachedScopeKey != scopeKey) return null;
    return _cachedChitSummary;
  }

  static DashboardSummary? get cachedSummary => _cachedSummary;
  static ChitDashboardSummary? get cachedChitSummary => _cachedChitSummary;

  static void clearCache() {
    _cachedScopeKey = null;
    _cachedSummary = null;
    _cachedChitSummary = null;
  }

  Future<DashboardSummary> getSummary({String? scopeKey}) async {
    try {
      final summary = await _service.getSummary();
      if (scopeKey != null) {
        _cachedScopeKey = scopeKey;
        _cachedSummary = summary;
      }
      return summary;
    } catch (e) {
      if (scopeKey != null &&
          _cachedScopeKey == scopeKey &&
          _cachedSummary != null) {
        return _cachedSummary!;
      }
      rethrow;
    }
  }

  Future<ChitDashboardSummary> getChitSummary({String? scopeKey}) async {
    try {
      final chit = await _service.getChitSummary();
      if (scopeKey != null) {
        _cachedScopeKey = scopeKey;
        _cachedChitSummary = chit;
      }
      return chit;
    } catch (e) {
      if (scopeKey != null &&
          _cachedScopeKey == scopeKey &&
          _cachedChitSummary != null) {
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
/// Watches authControllerProvider so that tenant/user changes immediately
/// invalidate and re-evaluate with the active session's scope key.
final dashboardSummaryProvider = FutureProvider<DashboardSummary>((ref) {
  final user = ref.watch(authControllerProvider).user;
  final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
  return ref.watch(dashboardRepositoryProvider).getSummary(scopeKey: scopeKey);
});

/// Chit-funds home dashboard (GET /dashboard/chits) — watched only when the
/// signed-in user is a chit tenant (AppType.userIsChit).
final chitDashboardSummaryProvider =
    FutureProvider<ChitDashboardSummary>((ref) {
  final user = ref.watch(authControllerProvider).user;
  final scopeKey = user != null ? '${user.tenantSlug}_${user.id}' : null;
  return ref.watch(dashboardRepositoryProvider).getChitSummary(scopeKey: scopeKey);
});
