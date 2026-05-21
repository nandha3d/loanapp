import 'package:flutter/material.dart';

/// Color tokens — verbatim from design.md.
/// DO NOT modify; these must match the web app's globals.css.
class AppColors {
  AppColors._();

  // Primary palette
  static const Color primary = Color(0xFFF5A623);
  static const Color primaryDark = Color(0xFFE8930C);
  static const Color primaryLight = Color(0xFFFFF3E0);

  // Surfaces
  static const Color background = Color(0xFFF4F6F9);
  static const Color surface = Color(0xFFFFFFFF);

  // Sidebar / dark surfaces
  static const Color sidebarBg = Color(0xFF1A1D23);
  static const Color sidebarHover = Color(0xFF2A2D35);

  // Text
  static const Color textPrimary = Color(0xFF1E293B);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textLight = Color(0xFF94A3B8);

  // Border
  static const Color border = Color(0xFFE2E8F0);

  // Semantic
  static const Color success = Color(0xFF27AE60);
  static const Color successBg = Color(0xFFDCFCE7);
  static const Color successText = Color(0xFF166534);

  static const Color danger = Color(0xFFE74C3C);
  static const Color dangerBg = Color(0xFFFEE2E2);
  static const Color dangerText = Color(0xFF991B1B);

  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color warningText = Color(0xFF92400E);

  static const Color info = Color(0xFF2980B9);
  static const Color infoBg = Color(0xFFE0F2FE);
  static const Color infoText = Color(0xFF075985);

  static const Color purple = Color(0xFF8B5CF6);
  static const Color purpleBg = Color(0xFFF3E8FF);
  static const Color purpleText = Color(0xFF7C3AED);

  // Overlay
  static const Color overlay = Color(0x80000000);

  // Hover surface
  static const Color rowHover = Color(0xFFFAFBFC);
}
