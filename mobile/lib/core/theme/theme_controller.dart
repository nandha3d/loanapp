import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

/// Tenant colour theme, picked by the superadmin in the web app
/// (Settings → Theme) and served to every authenticated role by
/// `/api/v1/theme`. The controller mutates [AppColors]' primary palette and
/// bumps its state so the MaterialApp theme rebuilds.
class ThemeController extends StateNotifier<int> {
  ThemeController(this._dio) : super(0);

  final Dio _dio;

  Future<void> refresh() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(Endpoints.theme);
      final data = res.data?['data'] as Map<String, dynamic>?;
      if (data == null) return;

      final preset = (data['preset'] as String?) ?? 'default';
      if (preset == 'default') {
        _apply(
          AppColors.defaultPrimary,
          AppColors.defaultPrimaryDark,
          AppColors.defaultPrimaryLight,
        );
        return;
      }
      final primary = _parseHex(data['primary'] as String?);
      final dark = _parseHex(data['primaryDark'] as String?);
      final light = _parseHex(data['primaryLight'] as String?);
      if (primary == null || dark == null || light == null) return;
      _apply(primary, dark, light);
    } on Object {
      // Offline / unauthenticated — keep the current palette.
    }
  }

  void _apply(Color primary, Color dark, Color light) {
    if (AppColors.primary == primary &&
        AppColors.primaryDark == dark &&
        AppColors.primaryLight == light) {
      return;
    }
    AppColors.primary = primary;
    AppColors.primaryDark = dark;
    AppColors.primaryLight = light;
    state = state + 1;
  }

  static Color? _parseHex(String? hex) {
    if (hex == null) return null;
    final cleaned = hex.replaceFirst('#', '').trim();
    if (cleaned.length != 6) return null;
    final value = int.tryParse(cleaned, radix: 16);
    if (value == null) return null;
    return Color(0xFF000000 | value);
  }
}

/// Bumps whenever the tenant theme changes; watch it where the ThemeData is
/// built. Refreshes automatically once the user is signed in.
final themeControllerProvider =
    StateNotifierProvider<ThemeController, int>((ref) {
  final controller = ThemeController(ref.watch(dioProvider));
  ref.listen<AuthState>(authControllerProvider, (previous, next) {
    if (next.stage == AuthStage.authenticated ||
        next.stage == AuthStage.locked) {
      controller.refresh();
    }
  }, fireImmediately: true,);
  return controller;
});
