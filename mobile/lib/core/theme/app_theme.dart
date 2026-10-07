import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';

class AppTheme {
  AppTheme._();

  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.lightBackground,
      colorScheme: ColorScheme.light(
        primary: AppColors.primary,
        onPrimary: AppColors.onPrimary,
        secondary: AppColors.primaryDark,
        surface: AppColors.lightSurface,
        onSurface: AppColors.lightTextPrimary,
        error: AppColors.danger,
        onError: AppColors.onPrimary,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.lightSurface,
        selectedColor: AppColors.primary,
        checkmarkColor: AppColors.onPrimary,
        side: BorderSide(color: AppColors.primary, width: 1.2),
        labelStyle: TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.w600,
        ),
        secondaryLabelStyle: const TextStyle(
          color: AppColors.onPrimary,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: BorderSide(color: AppColors.primary, width: 1.2),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          ),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith<Color>((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.primary;
            }
            return AppColors.lightSurface;
          }),
          foregroundColor: WidgetStateProperty.resolveWith<Color>((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.onPrimary;
            }
            return AppColors.primary;
          }),
          iconColor: WidgetStateProperty.resolveWith<Color>((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.onPrimary;
            }
            return AppColors.primary;
          }),
          side: WidgetStateProperty.resolveWith<BorderSide>((states) {
            return BorderSide(color: AppColors.primary, width: 1.2);
          }),
          textStyle: WidgetStateProperty.resolveWith<TextStyle>((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(fontWeight: FontWeight.w700, fontSize: 13);
            }
            return const TextStyle(fontWeight: FontWeight.w600, fontSize: 13);
          }),
        ),
      ),
      textTheme: (!kIsWeb && Platform.environment.containsKey('FLUTTER_TEST'))
          ? base.textTheme.apply(
              bodyColor: AppColors.lightTextPrimary,
              displayColor: AppColors.lightTextPrimary,
            )
          : GoogleFonts.interTextTheme(base.textTheme).apply(
              bodyColor: AppColors.lightTextPrimary,
              displayColor: AppColors.lightTextPrimary,
            ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.lightSurface,
        foregroundColor: AppColors.lightTextPrimary,
        elevation: 0,
        toolbarHeight: AppTokens.topbarHeight,
        scrolledUnderElevation: 0,
        titleTextStyle: AppTypography.sectionTitle
            .copyWith(color: AppColors.lightTextPrimary),
        iconTheme: const IconThemeData(color: AppColors.lightTextPrimary),
        shape: const Border(
          bottom: BorderSide(color: AppColors.lightBorder, width: 1),
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.lightSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radius),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.lightSurface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.lightBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: const BorderSide(color: AppColors.lightBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
        labelStyle:
            AppTypography.label.copyWith(color: AppColors.lightTextPrimary),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.lightBorder,
        thickness: 1,
        space: 1,
      ),
      iconTheme:
          const IconThemeData(color: AppColors.lightTextSecondary, size: 20),
    );
  }

  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    final accent = AppColors.readableOnDark(AppColors.primary);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.ink,
      colorScheme: ColorScheme.dark(
        primary: accent,
        onPrimary: AppColors.ink,
        secondary: accent,
        onSecondary: AppColors.ink,
        primaryContainer:
            Color.alphaBlend(accent.withAlpha(30), AppColors.inkElevated),
        onPrimaryContainer: accent,
        surface: AppColors.inkElevated,
        onSurface: AppColors.onInk,
        onSurfaceVariant: AppColors.onInkMuted,
        surfaceContainerLowest: AppColors.ink,
        surfaceContainerLow: AppColors.inkElevated,
        surfaceContainer: AppColors.darkRowHover,
        surfaceContainerHigh: AppColors.darkRowHover,
        surfaceContainerHighest: const Color(0xFF343D4D),
        outline: AppColors.darkTextLight,
        outlineVariant: AppColors.chartGrid,
        error: const Color(0xFFFFB4AB),
        onError: AppColors.ink,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.inkElevated,
        selectedColor: AppColors.primary,
        checkmarkColor: AppColors.onPrimary,
        side: BorderSide(color: accent, width: 1.2),
        labelStyle: const TextStyle(
          color: AppColors.onInk,
          fontWeight: FontWeight.w600,
        ),
        secondaryLabelStyle: const TextStyle(
          color: AppColors.onPrimary,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: accent,
          side: BorderSide(color: accent, width: 1.2),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          ),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith<Color>((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.primary;
            }
            return AppColors.inkElevated;
          }),
          foregroundColor: WidgetStateProperty.resolveWith<Color>((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.onPrimary;
            }
            return AppColors.onInk;
          }),
          iconColor: WidgetStateProperty.resolveWith<Color>((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.onPrimary;
            }
            return AppColors.onInk;
          }),
          side: WidgetStateProperty.resolveWith<BorderSide>((states) {
            return BorderSide(color: accent, width: 1.2);
          }),
          textStyle: WidgetStateProperty.resolveWith<TextStyle>((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(fontWeight: FontWeight.w700, fontSize: 13);
            }
            return const TextStyle(fontWeight: FontWeight.w600, fontSize: 13);
          }),
        ),
      ),
      textTheme: (!kIsWeb && Platform.environment.containsKey('FLUTTER_TEST'))
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
          borderSide: BorderSide(color: accent, width: 1.5),
        ),
        labelStyle: AppTypography.label.copyWith(color: AppColors.onInkMuted),
        hintStyle: const TextStyle(color: AppColors.darkTextLight),
        helperStyle: const TextStyle(color: AppColors.onInkMuted),
        prefixIconColor: AppColors.onInkMuted,
        suffixIconColor: AppColors.onInkMuted,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: accent,
        selectionColor: accent.withAlpha(70),
        selectionHandleColor: accent,
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
