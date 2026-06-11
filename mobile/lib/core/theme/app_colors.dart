import 'package:flutter/material.dart';

/// Color tokens — verbatim from design.md.
/// DO NOT modify; these must match the web app's globals.css.
class AppColors {
  AppColors._();

  // Primary palette. Mutable (NOT const): the tenant theme picked by the
  // superadmin (web Settings → Theme, served by /api/v1/theme) is applied at
  // runtime by ThemeController. Defaults below match the web globals.css.
  static const Color defaultPrimary = Color(0xFFF5A623);
  static const Color defaultPrimaryDark = Color(0xFFE8930C);
  static const Color defaultPrimaryLight = Color(0xFFFFF3E0);
  static Color primary = defaultPrimary;
  static Color primaryDark = defaultPrimaryDark;
  static Color primaryLight = defaultPrimaryLight;

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

  // ── Modern dark "ink" surfaces ──────────────────────────────────────
  // Used to give heavy-touch screens (collection cards) a modern dark look
  // paired with the amber `primary` accent. These are app-local (NOT mirrored
  // from the web globals.css) and are reusable anywhere a dark surface is
  // wanted. Do not hardcode these hex values in widgets — reference the token.
  static const Color ink = Color(0xFF15171E);          // near-black card base
  static const Color inkElevated = Color(0xFF20242E);  // raised block on ink
  static const Color inkBorder = Color(0x1FFFFFFF);    // hairline divider on ink (white 12%)
  static const Color onInk = Color(0xFFF8FAFC);        // primary text/icon on ink
  static const Color onInkMuted = Color(0xFF9AA4B2);   // secondary text on ink
  static const Color onPrimary = Color(0xFF1A1206);    // text/icon on amber primary

  // Dark hero-card gradient — matches the home/dashboard hero so other hero
  // cards (e.g. collection's today summary) can share the exact same look.
  static const Color heroDarkFrom = Color(0xFF1F2937);
  static const Color heroDarkTo = Color(0xFF111827);
}
