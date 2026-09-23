import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:zolofund/features/camera/guided_face_camera_screen.dart';
import 'package:zolofund/features/camera/guided_photo_processor.dart';

/// Launches the full-screen Guided Face Camera with real-time face detection circle,
/// auto-capture, square crop, and automatic WebP compression to a few KB.
Future<File?> captureGuidedFacePhoto(
  BuildContext context, {
  int targetResolution = 500,
  CameraLensDirection preferredLensDirection = CameraLensDirection.front,
}) async {
  return Navigator.of(context).push<File?>(
    MaterialPageRoute(
      builder: (_) => GuidedFaceCameraScreen(
        initialResolution: targetResolution,
        preferredLensDirection: preferredLensDirection,
      ),
    ),
  );
}

/// Opens the crop UI (square, locked) for a picked photo and compresses it
/// to a high-efficiency WebP image at [targetResolution] x [targetResolution] (few KB).
/// Returns the cropped WebP file, or null if the user cancelled.
Future<File?> cropSquarePhoto(
  String sourcePath, {
  int targetResolution = 500,
}) async {
  final cropped = await ImageCropper().cropImage(
    sourcePath: sourcePath,
    aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
    compressQuality: 85,
    maxWidth: 1000,
    maxHeight: 1000,
    uiSettings: [
      AndroidUiSettings(
        toolbarTitle: 'Crop photo',
        toolbarColor: const Color(0xFFF59E0B),
        toolbarWidgetColor: Colors.white,
        lockAspectRatio: true,
        hideBottomControls: true,
      ),
      IOSUiSettings(
        title: 'Crop photo',
        aspectRatioLockEnabled: true,
        resetAspectRatioEnabled: false,
      ),
    ],
  );
  if (cropped == null) return null;

  try {
    final compressed = await GuidedPhotoProcessor.compressExistingFileToSquareWebP(
      sourceFile: File(cropped.path),
      targetResolution: targetResolution,
    );
    return compressed.file;
  } catch (_) {
    return File(cropped.path);
  }
}
