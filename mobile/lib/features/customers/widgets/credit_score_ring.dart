import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';

class CreditScoreRing extends StatelessWidget {
  const CreditScoreRing({
    super.key,
    required this.score,
    this.diameter = 64,
    this.strokeWidth = 6,
    this.textColor,
  });

  final int? score;
  final double diameter;
  final double strokeWidth;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    final s = score ?? 0;
    final color = s >= 70
        ? AppColors.success
        : s >= 40
            ? AppColors.warning
            : AppColors.danger;
    return SizedBox(
      width: diameter,
      height: diameter,
      child: CustomPaint(
        painter: _RingPainter(
          progress: s / 100,
          color: color,
          strokeWidth: strokeWidth,
        ),
        child: Center(
          child: Text(
            score == null ? '—' : '$s',
            style: AppTypography.bodyLarge.copyWith(
              color: textColor ?? AppColors.textPrimary,
              fontSize: diameter * 0.3,
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.color,
    required this.strokeWidth,
  });

  final double progress;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.width - strokeWidth) / 2;

    final bg = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = AppColors.border;
    canvas.drawCircle(center, radius, bg);

    final fg = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = color;
    final sweep = 2 * math.pi * progress.clamp(0.0, 1.0);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      sweep,
      false,
      fg,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress || old.color != color;
}
