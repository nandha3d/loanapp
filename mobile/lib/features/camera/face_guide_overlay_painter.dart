import 'dart:math' as math;
import 'package:flutter/material.dart';

enum FaceGuideStatus {
  searching,
  warning,
  fit,
}

/// Custom painter that creates a darkened camera overlay with a transparent
/// circular face guide in the center, animated borders, and progress indicator.
class FaceGuideOverlayPainter extends CustomPainter {
  FaceGuideOverlayPainter({
    required this.status,
    required this.progress,
    required this.pulseValue,
  });

  final FaceGuideStatus status;
  final double progress; // 0.0 to 1.0 for capture countdown
  final double pulseValue; // 0.0 to 1.0 for subtle breathing animation

  static const double guideYOffsetRatio = 0.42;

  static Rect getGuideCircleRect(Size size) {
    final double radius = math.min(size.width * 0.36, 145.0);
    final Offset center = Offset(size.width / 2, size.height * guideYOffsetRatio);
    return Rect.fromCircle(center: center, radius: radius);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final circleRect = getGuideCircleRect(size);
    final center = circleRect.center;
    final radius = circleRect.width / 2;

    // 1. Darkened outer mask (vignette cutout)
    final backgroundPath = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final circlePath = Path()..addOval(circleRect);
    final transparentHole = Path.combine(
      PathOperation.difference,
      backgroundPath,
      circlePath,
    );

    final maskPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.65)
      ..style = PaintingStyle.fill;
    canvas.drawPath(transparentHole, maskPaint);

    // 2. Select theme colors based on detection status
    Color ringColor;
    Color glowColor;
    double ringWidth = 3.5;

    switch (status) {
      case FaceGuideStatus.fit:
        ringColor = const Color(0xFF10B981); // Emerald green
        glowColor = const Color(0xFF10B981).withValues(alpha: 0.5 + 0.3 * pulseValue);
        ringWidth = 4.0;
        break;
      case FaceGuideStatus.warning:
        ringColor = const Color(0xFFF59E0B); // Amber warning
        glowColor = const Color(0xFFF59E0B).withValues(alpha: 0.3);
        break;
      case FaceGuideStatus.searching:
        ringColor = Colors.white.withValues(alpha: 0.8 + 0.2 * pulseValue);
        glowColor = Colors.white.withValues(alpha: 0.15);
        break;
    }

    // 3. Glow ring (if fit)
    if (status == FaceGuideStatus.fit) {
      final glowPaint = Paint()
        ..color = glowColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10.0
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
      canvas.drawCircle(center, radius, glowPaint);
    }

    // 4. Main guide circle border
    final borderPaint = Paint()
      ..color = ringColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = ringWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, borderPaint);

    // 5. Corner / Alignment ticks (4 tick brackets)
    const tickLength = 16.0;
    const tickOffset = 6.0;
    final tickPaint = Paint()
      ..color = ringColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    // Top tick
    canvas.drawLine(
      Offset(center.dx, circleRect.top - tickOffset),
      Offset(center.dx, circleRect.top - tickOffset - tickLength),
      tickPaint,
    );
    // Bottom tick
    canvas.drawLine(
      Offset(center.dx, circleRect.bottom + tickOffset),
      Offset(center.dx, circleRect.bottom + tickOffset + tickLength),
      tickPaint,
    );
    // Left tick
    canvas.drawLine(
      Offset(circleRect.left - tickOffset, center.dy),
      Offset(circleRect.left - tickOffset - tickLength, center.dy),
      tickPaint,
    );
    // Right tick
    canvas.drawLine(
      Offset(circleRect.right + tickOffset, center.dy),
      Offset(circleRect.right + tickOffset + tickLength, center.dy),
      tickPaint,
    );

    // 6. Progress arc when auto-capturing (status == fit and progress > 0)
    if (status == FaceGuideStatus.fit && progress > 0) {
      final progressPaint = Paint()
        ..color = const Color(0xFF34D399) // Bright mint
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6.0
        ..strokeCap = StrokeCap.round;

      const startAngle = -math.pi / 2;
      final sweepAngle = 2 * math.pi * progress.clamp(0.0, 1.0);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius + 2),
        startAngle,
        sweepAngle,
        false,
        progressPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant FaceGuideOverlayPainter oldDelegate) {
    return oldDelegate.status != status ||
        oldDelegate.progress != progress ||
        oldDelegate.pulseValue != pulseValue;
  }
}
