import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';

class AppTheme {
  AppTheme._();

  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: ColorScheme.light(
        primary: AppColors.primary,
        onPrimary: Colors.white,
        secondary: AppColors.primaryDark,
        surface: AppColors.surface,
        onSurface: AppColors.textPrimary,
        error: AppColors.danger,
        onError: Colors.white,
      ),
      textTheme: (!kIsWeb && Platform.environment.containsKey('FLUTTER_TEST'))
          ? base.textTheme.apply(
              bodyColor: AppColors.textPrimary,
              displayColor: AppColors.textPrimary,
            )
          : GoogleFonts.interTextTheme(base.textTheme).apply(
              bodyColor: AppColors.textPrimary,
              displayColor: AppColors.textPrimary,
            ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        toolbarHeight: AppTokens.topbarHeight,
        scrolledUnderElevation: 0,
        titleTextStyle: AppTypography.sectionTitle,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        shape: const Border(
          bottom: BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
        labelStyle: AppTypography.label,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),
      iconTheme: const IconThemeData(color: AppColors.textSecondary, size: 20),
    );
  }

  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.ink,
      colorScheme: ColorScheme.dark(
        primary: AppColors.primary,
        onPrimary: AppColors.onPrimary,
        secondary: AppColors.primaryDark,
        surface: AppColors.inkElevated,
        onSurface: AppColors.onInk,
        error: AppColors.danger,
        onError: Colors.white,
      ),
      textTheme: Platform.environment.containsKey('FLUTTER_TEST')
          ? base.textTheme.apply(
              bodyColor: AppColors.onInk,
              displayColor: AppColors.onInk,
            )
          : GoogleFonts.interTextTheme(base.textTheme).apply(
              bodyColor: AppColors.onInk,
              displayColor: AppColors.onInk,
            ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.ink,
        foregroundColor: AppColors.onInk,
        elevation: 0,
        toolbarHeight: AppTokens.topbarHeight,
        scrolledUnderElevation: 0,
        titleTextStyle: AppTypography.sectionTitle.copyWith(
          color: AppColors.onInk,
        ),
        iconTheme: const IconThemeData(color: AppColors.onInk),
        shape: const Border(
          bottom: BorderSide(color: AppColors.inkBorder, width: 1),
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.inkElevated,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.inkElevated,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.inkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.inkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
        labelStyle: AppTypography.label.copyWith(color: AppColors.onInkMuted),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.inkBorder,
        thickness: 1,
        space: 1,
      ),
      iconTheme: const IconThemeData(color: AppColors.onInkMuted, size: 20),
    );
  }
}
