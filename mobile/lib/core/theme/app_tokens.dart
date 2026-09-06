import 'package:flutter/material.dart';

import 'package:zolofund/core/theme/app_colors.dart';

/// Spacing, radius, shadow, transition tokens.
/// Verbatim from design.md.
class AppTokens {
  AppTokens._();

  // Spacing (base unit 8px)
  static const double space1 = 4.0;
  static const double space2 = 8.0;
  static const double space3 = 12.0;
  static const double space4 = 16.0;
  static const double space5 = 20.0;
  static const double space6 = 24.0;
  static const double space7 = 28.0;
  static const double space8 = 32.0;

  static const double topbarHeight = 64.0;
  static const double sidebarWidth = 260.0;

  // Radius
  static const double radius = 12.0;
  static const double radiusSm = 8.0;
  static const double radiusTab = 7.0;
  static const double radiusBadge = 20.0;
  static const double radiusKpiIcon = 10.0;

  // Shadows
  static const List<BoxShadow> shadow = [
    BoxShadow(color: Color(0x14000000), offset: Offset(0, 1), blurRadius: 3),
    BoxShadow(color: Color(0x0A000000), offset: Offset(0, 4), blurRadius: 12),
  ];

  static const List<BoxShadow> shadowLg = [
    BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 24),
  ];

  static const List<BoxShadow> shadowPrimaryHover = [
    BoxShadow(color: Color(0x4DF5A623), offset: Offset(0, 4), blurRadius: 12),
  ];

  // Transition
  static const Duration transition = Duration(milliseconds: 200);
  static const Curve transitionCurve = Cubic(0.4, 0.0, 0.2, 1.0);

  // Border helper
  static const Border thinBorder = Border.fromBorderSide(
    BorderSide(color: AppColors.border, width: 1),
  );
}
