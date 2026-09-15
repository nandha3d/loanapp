import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:zolofund/core/theme/app_colors.dart';

/// Typography scale — verbatim from design.md.
/// Base 14px = 1rem. All sizes computed from that base.
class AppTypography {
  AppTypography._();

  static const double _base = 14.0;

  static TextStyle _inter({
    required double size,
    required FontWeight weight,
    Color color = AppColors.textPrimary,
    double? height,
  }) {
    // Avoid GoogleFonts fetch failures in unit/widget tests
    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return TextStyle(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
        fontFamily: 'Roboto', // standard fallback
      );
    }
    return GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );
  }

  // Display / H1: 1.6rem (22.4px), 700
  static TextStyle get display => _inter(size: _base * 1.6, weight: FontWeight.w700);

  // Section title: 1.15rem (16.1px), 700
  static TextStyle get sectionTitle => _inter(size: _base * 1.15, weight: FontWeight.w700);

  // Body large: 0.9rem (12.6px), 600
  static TextStyle get bodyLarge => _inter(size: _base * 0.9, weight: FontWeight.w600);

  // Body: 0.85rem (11.9px), 400
  static TextStyle get body => _inter(size: _base * 0.85, weight: FontWeight.w400);

  // Body small: 0.82rem (11.5px), 400
  static TextStyle get bodySmall => _inter(size: _base * 0.82, weight: FontWeight.w400);

  // Label: 0.8rem (11.2px), 600
  static TextStyle get label => _inter(size: _base * 0.8, weight: FontWeight.w600);

  // Caption: 0.75rem (10.5px), 400
  static TextStyle get caption =>
      _inter(size: _base * 0.75, weight: FontWeight.w400, color: AppColors.textSecondary);

  // Tiny (badges): 0.72rem (10.1px), 600
  static TextStyle get tiny => _inter(size: _base * 0.72, weight: FontWeight.w600);

  // Extra tiny (timestamps): 0.7rem (9.8px), 400
  static TextStyle get extraTiny =>
      _inter(size: _base * 0.7, weight: FontWeight.w400, color: AppColors.textLight);

  // KPI value: 1.5rem, 700
  static TextStyle get kpiValue => _inter(size: _base * 1.5, weight: FontWeight.w700);

  // ── Low-literacy / customer-facing scale ────────────────────────────
  // Used on screens that field agents tap heavily. Larger, higher-contrast.

  // Hero numeric (balance / amount): 2.6rem, 800
  static TextStyle get heroNumber =>
      _inter(size: _base * 2.6, weight: FontWeight.w800);

  // Hero label: 1rem, 700
  static TextStyle get heroLabel =>
      _inter(size: _base * 1.0, weight: FontWeight.w700);

  // Name (customer name on cards): 1.05rem, 700
  static TextStyle get nameLg =>
      _inter(size: _base * 1.05, weight: FontWeight.w700);

  // Money on collection rows: 1.2rem, 800
  static TextStyle get moneyLg =>
      _inter(size: _base * 1.2, weight: FontWeight.w800);

  // Action button label: 1.05rem, 700
  static TextStyle get actionLabel =>
      _inter(size: _base * 1.05, weight: FontWeight.w700);

  // Big tappable label (number-pad keys, primary CTAs): 1.45rem, 800
  static TextStyle get bigKey =>
      _inter(size: _base * 1.45, weight: FontWeight.w800);

  // Helper meta beside hero numbers: 0.95rem, 500
  static TextStyle get heroMeta =>
      _inter(size: _base * 0.95, weight: FontWeight.w500);
}
