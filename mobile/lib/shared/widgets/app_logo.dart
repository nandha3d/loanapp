import 'package:flutter/material.dart';

/// Available brand logo display geometries.
enum LogoVariant {
  /// 1:1 square icon variant for app bars, badges, and compact spaces.
  square,

  /// ~3.17:1 wide horizontal variant for headers, titles, splash screens, and cards.
  horizontal,
}

/// Universal ZoloFund logo widget that automatically switches between
/// dark and light theme assets based on the active [ThemeData] brightness,
/// or accepts an explicit [isDark] override.
class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.variant = LogoVariant.horizontal,
    this.isDark,
    this.height,
    this.width,
    this.fit = BoxFit.contain,
    this.semanticLabel = 'ZoloFund',
  });

  /// Convenient constructor for square / icon placement.
  const AppLogo.square({
    super.key,
    this.isDark,
    double? size,
    double? height,
    double? width,
    this.fit = BoxFit.contain,
    this.semanticLabel = 'ZoloFund',
  })  : variant = LogoVariant.square,
        height = size ?? height,
        width = size ?? width;

  /// Convenient constructor for horizontal / lengthy title placement.
  const AppLogo.horizontal({
    super.key,
    this.isDark,
    this.height,
    this.width,
    this.fit = BoxFit.contain,
    this.semanticLabel = 'ZoloFund',
  }) : variant = LogoVariant.horizontal;

  final LogoVariant variant;

  /// Explicit theme override. When null, resolves from `Theme.of(context).brightness == Brightness.dark`.
  final bool? isDark;

  final double? height;
  final double? width;
  final BoxFit fit;
  final String semanticLabel;

  /// Resolves the concrete asset path based on variant and dark/light mode.
  static String assetPath({
    required LogoVariant variant,
    required bool isDark,
  }) {
    switch (variant) {
      case LogoVariant.square:
        return isDark
            ? 'assets/images/logo-square-dark.png'
            : 'assets/images/logo-square-light.png';
      case LogoVariant.horizontal:
        return isDark
            ? 'assets/images/logo-horizontal-dark.png'
            : 'assets/images/logo-horizontal-light.png';
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveDark =
        isDark ?? (Theme.of(context).brightness == Brightness.dark);
    final path = assetPath(variant: variant, isDark: effectiveDark);

    return Image.asset(
      path,
      height: height,
      width: width,
      fit: fit,
      semanticLabel: semanticLabel,
    );
  }
}
