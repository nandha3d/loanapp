import 'package:flutter/material.dart';

import 'package:zolofund/core/theme/app_colors.dart';

/// Reusable modern card widget with a single solid surface color.
///
/// Features:
/// - Smooth squircle geometry (16px default radius)
/// - Solid single background color (zero gradients)
/// - Crisp hairline border
/// - Subtle multi-layered ambient shadow
/// - High-fidelity ripple feedback on tap via Material + InkWell
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.themeColor,
    this.onTap,
    this.padding,
    this.margin,
    this.borderRadius,
    this.borderWidth = 1.0,
    this.borderColor,
    this.backgroundColor,
  });

  final Widget child;
  final Color? themeColor;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final double borderWidth;
  final Color? borderColor;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(16);
    final bg = backgroundColor ?? AppColors.surface;

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: radius,
        border: Border.all(
          color: borderColor ?? const Color(0xFFE2E8F0),
          width: borderWidth,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
          BoxShadow(
            color: Colors.black.withAlpha(3),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Padding(
            padding: padding ?? const EdgeInsets.all(16),
            child: child,
          ),
        ),
      ),
    );
  }
}
