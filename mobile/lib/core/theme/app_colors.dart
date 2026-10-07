import 'package:flutter/material.dart';

/// Shared brand tokens and brightness-aware mobile presentation colours.
class AppColors {
  AppColors._();

  // Primary palette. Mutable (NOT const): the tenant theme picked by the
  // superadmin (web Settings → Theme, served by /api/v1/theme) is applied at
  // runtime by ThemeController. Defaults below match the web globals.css.
  // Primary palette — ZoloFund brand colors from official logo
  static const Color defaultPrimary = Color(0xFF7D287E);
  static const Color defaultPrimaryDark = Color(0xFF5E1B5F);
  static const Color defaultPrimaryLight = Color(0xFFF6E8F7);
  static Color primary = defaultPrimary;
  static Color primaryDark = defaultPrimaryDark;
  static Color primaryLight = defaultPrimaryLight;

  // Brand accents from ZoloFund logo
  static const Color brandYellow = Color(0xFFFCF6AB); // Logo '₹und' pill accent
  static const Color brandYellowDark = Color(0xFFE8DE70);
  static const Color brandPurple = Color(0xFF7D287E);
  static const Color brandPurpleLight = Color(0xFFF6E8F7);

  // ── Brightness-aware neutrals ───────────────────────────────────────
  // `background`, `surface`, `text*`, `border` and `rowHover` resolve against
  // [isDark], which App sets from the dark-mode preference before every
  // build. Screens keep referencing `AppColors.surface` etc. and get the
  // right palette in both modes. [AppTheme.light] must use the `light*`
  // constants (not these getters) so the light ThemeData never goes dark.
  static bool isDark = false;

  static const Color lightBackground = Color(0xFFF4F6F9);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightTextPrimary = Color(0xFF1E293B);
  static const Color lightTextSecondary = Color(0xFF64748B);
  static const Color lightTextLight = Color(0xFF94A3B8);
  static const Color lightBorder = Color(0xFFE2E8F0);
  static const Color lightRowHover = Color(0xFFFAFBFC);

  static const Color darkTextLight = Color(0xFFADB8C8);
  static const Color darkRowHover = Color(0xFF262B36);

  // Surfaces
  static Color get background => isDark ? ink : lightBackground;
  static Color get surface => isDark ? inkElevated : lightSurface;

  // Sidebar / dark surfaces
  static const Color sidebarBg = Color(0xFF1A1D23);
  static const Color sidebarHover = Color(0xFF2A2D35);

  // Text
  static Color get textPrimary => isDark ? onInk : lightTextPrimary;
  static Color get textSecondary => isDark ? onInkMuted : lightTextSecondary;
  static Color get textLight => isDark ? darkTextLight : lightTextLight;

  /// Foreground accent on neutral surfaces. Keep the tenant's original
  /// primary for filled controls; a dark brand colour is not readable text.
  static Color get accent => isDark ? readableOnDark(primary) : primary;
  static Color get accentSoft => isDark
      ? Color.alphaBlend(accent.withAlpha(30), inkElevated)
      : primaryLight;

  static Color readableOnDark(Color color) {
    final backgroundLuminance = darkRowHover.computeLuminance();
    for (var step = 0; step <= 100; step++) {
      final candidate = Color.lerp(color, onInk, step / 100)!;
      final ratio =
          (candidate.computeLuminance() + 0.05) / (backgroundLuminance + 0.05);
      if (ratio >= 4.5) return candidate;
    }
    return onInk;
  }

  static Color get chartExpected => isDark ? onInkMuted : lightTextLight;
  static Color get chartCollected =>
      isDark ? const Color(0xFFC4B5FD) : const Color(0xFF7C3AED);
  static Color get chartSuccess =>
      isDark ? const Color(0xFF34D399) : const Color(0xFF10B981);
  static Color get chartOverdue =>
      isDark ? const Color(0xFFFB7185) : const Color(0xFFEF4444);
  static Color get chartGrid => isDark ? const Color(0xFF465166) : lightBorder;

  // Border
  static Color get border => isDark ? inkBorder : lightBorder;

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
  static Color get rowHover => isDark ? darkRowHover : lightRowHover;

  // ── Modern dark "ink" surfaces ──────────────────────────────────────
  // Used to give heavy-touch screens (collection cards) a modern dark look
  // paired with the amber `primary` accent. These are app-local (NOT mirrored
  // from the web globals.css) and are reusable anywhere a dark surface is
  // wanted. Do not hardcode these hex values in widgets — reference the token.
  static const Color ink = Color(0xFF15171E); // near-black card base
  static const Color inkElevated = Color(0xFF20242E); // raised block on ink
  static const Color inkBorder =
      Color(0x1FFFFFFF); // hairline divider on ink (white 12%)
  static const Color onInk = Color(0xFFF8FAFC); // primary text/icon on ink
  static const Color onInkMuted = Color(0xFFC0CAD8); // secondary text on ink
  static const Color onPrimary =
      Color(0xFFFFFFFF); // text/icon on purple primary

  // Theme hero-card gradient — rich ZoloFund brand purple gradient matching the official theme
  static const Color heroDarkFrom = Color(0xFF4A134B);
  static const Color heroDarkTo = Color(0xFF230724);
}
