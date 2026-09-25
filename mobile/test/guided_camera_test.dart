import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:zolofund/features/camera/face_guide_overlay_painter.dart';

void main() {
  group('FaceGuideOverlayPainter & Geometry Tests', () {
    test('getGuideCircleRect computes centered circle with correct aspect ratio', () {
      const screenSize = Size(390, 844); // Standard iPhone / modern Android
      final rect = FaceGuideOverlayPainter.getGuideCircleRect(screenSize);

      // Center should be horizontally centered
      expect(rect.center.dx, closeTo(screenSize.width / 2, 0.001));

      // Y center should be placed around 42% of screen height
      expect(rect.center.dy, closeTo(screenSize.height * 0.42, 0.001));

      // Circle should have equal width and height
      expect(rect.width, closeTo(rect.height, 0.001));

      // Diameter should be comfortably framed
      expect(rect.width, greaterThan(200.0));
      expect(rect.width, lessThan(screenSize.width));
    });

    test('Painter instantiates and configures states correctly', () {
      final painterSearching = FaceGuideOverlayPainter(
        status: FaceGuideStatus.searching,
        progress: 0.0,
        pulseValue: 0.5,
      );
      expect(painterSearching.status, FaceGuideStatus.searching);

      final painterFit = FaceGuideOverlayPainter(
        status: FaceGuideStatus.fit,
        progress: 0.8,
        pulseValue: 1.0,
      );
      expect(painterFit.status, FaceGuideStatus.fit);
      expect(painterFit.progress, 0.8);
      expect(painterFit.shouldRepaint(painterSearching), true);
    });
  });

  group('Square Crop & Dimension Logic Tests', () {
    test('Centered square crop coordinates remain within image bounds', () {
      const imgWidth = 1920;
      const imgHeight = 1080;
      final minDim = math.min(imgWidth, imgHeight);

      final cropX = (imgWidth - minDim) ~/ 2;
      final cropY = (imgHeight - minDim) ~/ 2;

      expect(cropX, 420);
      expect(cropY, 0);
      expect(cropX + minDim, 1500);
      expect(cropX + minDim, lessThanOrEqualTo(imgWidth));
      expect(cropY + minDim, imgHeight);
    });

    test('Synthetic image square crop and resize to 500x500', () {
      final original = img.Image(width: 1280, height: 720);
      img.fill(original, color: img.ColorRgb8(120, 180, 240));

      final minDim = math.min(original.width, original.height);
      final cropped = img.copyCrop(
        original,
        x: (original.width - minDim) ~/ 2,
        y: (original.height - minDim) ~/ 2,
        width: minDim,
        height: minDim,
      );

      expect(cropped.width, 720);
      expect(cropped.height, 720);

      final resized500 = img.copyResize(cropped, width: 500, height: 500);
      expect(resized500.width, 500);
      expect(resized500.height, 500);

      final jpgBytes = img.encodeJpg(resized500, quality: 80);
      // Ensure file size is small (under 50 KB)
      expect(jpgBytes.length, lessThan(50 * 1024));
    });

    test('Synthetic image square crop and resize to 1000x1000', () {
      final original = img.Image(width: 1920, height: 1080);
      img.fill(original, color: img.ColorRgb8(240, 200, 100));

      final minDim = math.min(original.width, original.height);
      final cropped = img.copyCrop(
        original,
        x: (original.width - minDim) ~/ 2,
        y: (original.height - minDim) ~/ 2,
        width: minDim,
        height: minDim,
      );

      final resized1000 = img.copyResize(cropped, width: 1000, height: 1000);
      expect(resized1000.width, 1000);
      expect(resized1000.height, 1000);

      final jpgBytes = img.encodeJpg(resized1000, quality: 80);
      expect(jpgBytes.length, lessThan(100 * 1024));
    });
  });
}
