import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';

/// Opens the crop UI (square, locked) for a freshly picked photo.
/// Returns the cropped file, or null if the user cancelled.
Future<File?> cropSquarePhoto(String sourcePath) async {
  final cropped = await ImageCropper().cropImage(
    sourcePath: sourcePath,
    aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
    compressQuality: 80,
    maxWidth: 800,
    maxHeight: 800,
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
  return cropped == null ? null : File(cropped.path);
}
