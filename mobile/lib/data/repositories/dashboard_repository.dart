import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/data/models/chit_dashboard_summary.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';
import 'package:zolofund/data/services/dashboard_service.dart';

class DashboardRepository {
  DashboardRepository(this._service);
  final DashboardService _service;

  static const String _kBoxName = 'dashboard_cache';
  static String? _cachedScopeKey;
  static DashboardSummary? _cachedSummary;
  static ChitDashboardSummary? _cachedChitSummary;

  static Future<Box<dynamic>> _getBox() async {
    if (Hive.isBoxOpen(_kBoxName)) {
      return Hive.box<dynamic>(_kBoxName);
    }
    return Hive.openBox<dynamic>(_kBoxName);
  }

  static DashboardSummary? cachedSummaryFor(String? scopeKey) {
    if (_cachedSummary != null) {
      if (scopeKey == null || _cachedScopeKey == scopeKey || _cachedScopeKey == null) {
        return _cachedSummary;
      }
    }
    if (scopeKey == null) return _cachedSummary;
    // Instant disk read from Hive if box is already open
    if (Hive.isBoxOpen(_kBoxName)) {
      try {
        final box = Hive.box<dynamic>(_kBoxName);
        final rawStr = box.get('summary_$scopeKey') as String?;
        if (rawStr != null && rawStr.isNotEmpty) {
          final decoded = jsonDecode(rawStr) as Map<String, dynamic>;
          _cachedScopeKey = scopeKey;
          _cachedSummary = DashboardSummary.fromJson(decoded);
          return _cachedSummary;
        }
      } catch (e) {
        debugPrint('[DashboardRepository] Error reading cached summary from disk: $e');
      }
    }
    return null;
  }

  static ChitDashboardSummary? cachedChitSummaryFor(String? scopeKey) {
    if (_cachedChitSummary != null) {
      if (scopeKey == null || _cachedScopeKey == scopeKey || _cachedScopeKey == null) {
        return _cachedChitSummary;
      }
    }
    if (scopeKey == null) return _cachedChitSummary;
    if (Hive.isBoxOpen(_kBoxName)) {
      try {
        final box = Hive.box<dynamic>(_kBoxName);
        final rawStr = box.get('chit_summary_$scopeKey') as String?;
        if (rawStr != null && rawStr.isNotEmpty) {
          final decoded = jsonDecode(rawStr) as Map<String, dynamic>;
          _cachedScopeKey = scopeKey;
          _cachedChitSummary = ChitDashboardSummary.fromJson(decoded);
          return _cachedChitSummary;
        }
      } catch (e) {
        debugPrint('[DashboardRepository] Error reading cached chit summary from disk: $e');
      }
    }
    return null;
  }

  static DashboardSummary? get cachedSummary => _cachedSummary;
  static ChitDashboardSummary? get cachedChitSummary => _cachedChitSummary;

  static void clearCache() {
    _cachedScopeKey = null;
    _cachedSummary = null;
    _cachedChitSummary = null;
    if (Hive.isBoxOpen(_kBoxName)) {
      try {
        Hive.box<dynamic>(_kBoxName).clear();
      } catch (_) {}
    }
  }

  Future<DashboardSummary> getSummary({String? scopeKey}) async {
    // Check disk cache immediately if memory is empty
    if (scopeKey != null && _cachedSummary == null) {
      final disk = cachedSummaryFor(scopeKey);
      if (disk != null) _cachedSummary = disk;
    }

    try {
      final summary = await _service.getSummary(
        onRawData: (rawMap) async {
          if (scopeKey != null) {
            try {
              final box = await _getBox();
              await box.put('summary_$scopeKey', jsonEncode(rawMap));
            } catch (_) {}
          }
        },
      );
      if (scopeKey != null) {
        _cachedScopeKey = scopeKey;
        _cachedSummary = summary;
      }
      return summary;
    } catch (e) {
      if (scopeKey != null) {
        final fallback = cachedSummaryFor(scopeKey);
        if (fallback != null) return fallback;
      }
      if (_cachedSummary != null) return _cachedSummary!;
      rethrow;
    }
  }

  Future<ChitDashboardSummary> getChitSummary({String? scopeKey}) async {
    if (scopeKey != null && _cachedChitSummary == null) {
      final disk = cachedChitSummaryFor(scopeKey);
      if (disk != null) _cachedChitSummary = disk;
    }

    try {
      final chit = await _service.getChitSummary(
        onRawData: (rawMap) async {
          if (scopeKey != null) {
            try {
              final box = await _getBox();
              await box.put('chit_summary_$scopeKey', jsonEncode(rawMap));
            } catch (_) {}
          }
        },
      );
      if (scopeKey != null) {
        _cachedScopeKey = scopeKey;
        _cachedChitSummary = chit;
      }
      return chit;
    } catch (e) {
      if (scopeKey != null) {
        final fallback = cachedChitSummaryFor(scopeKey);
        if (fallback != null) return fallback;
      }
      if (_cachedChitSummary != null) return _cachedChitSummary!;
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
