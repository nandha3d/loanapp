import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

/// Result container for the cropped, resized, and compressed photo.
class ProcessedPhotoResult {
  const ProcessedPhotoResult({
    required this.file,
    required this.width,
    required this.height,
    required this.sizeKb,
    required this.format,
  });

  final File file;
  final int width;
  final int height;
  final double sizeKb;
  final String format; // 'webp'

  String get badgeText => '${sizeKb.toStringAsFixed(1)} KB • $width×$height ${format.toUpperCase()}';
}

class GuidedPhotoProcessor {
  /// Processes a captured photo:
  /// 1. Crops the region corresponding to the camera guide circle.
  /// 2. Resizes to exactly [targetResolution] x [targetResolution] (500 or 1000).
  /// 3. Compresses to WebP (quality 75-80) to minimize file size to a few KB.
  static Future<ProcessedPhotoResult> processGuidedPhoto({
    required File rawFile,
    required Size previewSize,
    required Rect guideRect,
    int targetResolution = 500,
    int quality = 78,
  }) async {
    // Read raw image bytes
    final rawBytes = await rawFile.readAsBytes();

    // Perform cropping and resizing in a background compute isolate to avoid UI jank
    final intermediateJpgBytes = await compute(
      _cropAndResizeToJpg,
      _CropParams(
        imageBytes: rawBytes,
        previewWidth: previewSize.width,
        previewHeight: previewSize.height,
        guideLeft: guideRect.left,
        guideTop: guideRect.top,
        guideWidth: guideRect.width,
        guideHeight: guideRect.height,
        targetResolution: targetResolution,
      ),
    );

    if (intermediateJpgBytes == null || intermediateJpgBytes.isEmpty) {
      throw Exception('Failed to process captured image.');
    }

    // Compress to WebP format using native flutter_image_compress
    Uint8List webpBytes;
    try {
      final compressed = await FlutterImageCompress.compressWithList(
        intermediateJpgBytes,
        minWidth: targetResolution,
        minHeight: targetResolution,
        quality: quality,
        format: CompressFormat.webp,
      );
      webpBytes = compressed;
    } catch (e) {
      // Fallback: If native WebP compressor fails (e.g. desktop/unsupported simulator), use JPG
      webpBytes = intermediateJpgBytes;
    }

    // Save compressed file to temp directory
    final tempDir = await getTemporaryDirectory();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final extension = (webpBytes == intermediateJpgBytes) ? 'jpg' : 'webp';
    final targetPath = '${tempDir.path}/face_${targetResolution}x${targetResolution}_$timestamp.$extension';

    final targetFile = File(targetPath);
    await targetFile.writeAsBytes(webpBytes, flush: true);

    final sizeKb = webpBytes.lengthInBytes / 1024.0;

    return ProcessedPhotoResult(
      file: targetFile,
      width: targetResolution,
      height: targetResolution,
      sizeKb: sizeKb,
      format: extension,
    );
  }

  /// Compresses an existing image file (e.g. picked from gallery) into a 500x500 or 1000x1000 square WebP.
  static Future<ProcessedPhotoResult> compressExistingFileToSquareWebP({
    required File sourceFile,
    int targetResolution = 500,
    int quality = 78,
  }) async {
    final rawBytes = await sourceFile.readAsBytes();
    final intermediateJpgBytes = await compute(
      _cropCenterSquareToJpg,
      _SquareCropParams(
        imageBytes: rawBytes,
        targetResolution: targetResolution,
      ),
    );

    if (intermediateJpgBytes == null || intermediateJpgBytes.isEmpty) {
      throw Exception('Failed to crop square image.');
    }

    Uint8List webpBytes;
    try {
      final compressed = await FlutterImageCompress.compressWithList(
        intermediateJpgBytes,
        minWidth: targetResolution,
        minHeight: targetResolution,
        quality: quality,
        format: CompressFormat.webp,
      );
      webpBytes = compressed;
    } catch (e) {
      webpBytes = intermediateJpgBytes;
    }

    final tempDir = await getTemporaryDirectory();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final extension = (webpBytes == intermediateJpgBytes) ? 'jpg' : 'webp';
    final targetPath = '${tempDir.path}/face_sq_${targetResolution}x${targetResolution}_$timestamp.$extension';

    final targetFile = File(targetPath);
    await targetFile.writeAsBytes(webpBytes, flush: true);

    final sizeKb = webpBytes.lengthInBytes / 1024.0;

    return ProcessedPhotoResult(
      file: targetFile,
      width: targetResolution,
      height: targetResolution,
      sizeKb: sizeKb,
      format: extension,
    );
  }
}

class _CropParams {
  const _CropParams({
    required this.imageBytes,
    required this.previewWidth,
    required this.previewHeight,
    required this.guideLeft,
    required this.guideTop,
    required this.guideWidth,
    required this.guideHeight,
    required this.targetResolution,
  });

  final Uint8List imageBytes;
  final double previewWidth;
  final double previewHeight;
  final double guideLeft;
  final double guideTop;
  final double guideWidth;
  final double guideHeight;
  final int targetResolution;
}

class _SquareCropParams {
  const _SquareCropParams({
    required this.imageBytes,
    required this.targetResolution,
  });

  final Uint8List imageBytes;
  final int targetResolution;
}

Uint8List? _cropAndResizeToJpg(_CropParams params) {
  final decoded = img.decodeImage(params.imageBytes);
  if (decoded == null) return null;

  // Compute normalized guide circle center and diameter
  final guideCenterX = params.guideLeft + params.guideWidth / 2;
  final guideCenterY = params.guideTop + params.guideHeight / 2;

  final normCenterX = guideCenterX / params.previewWidth;
  final normCenterY = guideCenterY / params.previewHeight;
  final normDiameter = params.guideWidth / math.min(params.previewWidth, params.previewHeight);

  final imgMinDim = math.min(decoded.width, decoded.height);
  // Add a slight 5% padding so the face isn't right against the cropped edge
  int cropSize = (imgMinDim * normDiameter * 1.05).round();
  cropSize = math.min(cropSize, imgMinDim);

  final imgCenterX = (decoded.width * normCenterX).round();
  final imgCenterY = (decoded.height * normCenterY).round();

  final cropX = (imgCenterX - cropSize ~/ 2).clamp(0, decoded.width - cropSize);
  final cropY = (imgCenterY - cropSize ~/ 2).clamp(0, decoded.height - cropSize);

  final cropped = img.copyCrop(
    decoded,
    x: cropX,
    y: cropY,
    width: cropSize,
    height: cropSize,
  );

  final resized = img.copyResize(
    cropped,
    width: params.targetResolution,
    height: params.targetResolution,
    interpolation: img.Interpolation.linear,
  );

  return Uint8List.fromList(img.encodeJpg(resized, quality: 90));
}

Uint8List? _cropCenterSquareToJpg(_SquareCropParams params) {
  final decoded = img.decodeImage(params.imageBytes);
  if (decoded == null) return null;

  final minDim = math.min(decoded.width, decoded.height);
  final cropX = (decoded.width - minDim) ~/ 2;
  final cropY = (decoded.height - minDim) ~/ 2;

  final cropped = img.copyCrop(
    decoded,
    x: cropX,
    y: cropY,
    width: minDim,
    height: minDim,
  );

  final resized = img.copyResize(
    cropped,
    width: params.targetResolution,
    height: params.targetResolution,
    interpolation: img.Interpolation.linear,
  );

  return Uint8List.fromList(img.encodeJpg(resized, quality: 90));
}
