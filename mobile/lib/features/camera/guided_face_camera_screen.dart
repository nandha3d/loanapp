import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/features/camera/face_guide_overlay_painter.dart';
import 'package:zolofund/features/camera/guided_photo_processor.dart';

/// Full-screen guided camera screen that displays a centered face circle,
/// detects face alignment using ML Kit, auto-captures when fitted, crops
/// to square, resizes to 500x500 or 1000x1000, and compresses to WebP.
class GuidedFaceCameraScreen extends ConsumerStatefulWidget {
  const GuidedFaceCameraScreen({
    super.key,
    this.initialResolution = 500,
    this.preferredLensDirection = CameraLensDirection.front,
  });

  final int initialResolution; // 500 or 1000
  final CameraLensDirection preferredLensDirection;

  @override
  ConsumerState<GuidedFaceCameraScreen> createState() => _GuidedFaceCameraScreenState();
}

class _GuidedFaceCameraScreenState extends ConsumerState<GuidedFaceCameraScreen>
    with SingleTickerProviderStateMixin {
  List<CameraDescription> _cameras = [];
  CameraController? _cameraController;
  int _selectedCameraIndex = 0;
  bool _isCameraInitialized = false;
  bool _isProcessingFrame = false;
  bool _isCapturing = false;
  DateTime _lastFrameTime = DateTime.now();

  late int _targetResolution;
  FlashMode _flashMode = FlashMode.off;

  // ML Kit Face Detector
  late final FaceDetector _faceDetector;

  // Face fitting state
  FaceGuideStatus _guideStatus = FaceGuideStatus.searching;
  String? _overridePrompt;
  double _fitProgress = 0.0; // 0.0 to 1.0 for capture countdown
  Timer? _countdownTimer;

  // Animation controller for pulse / breathing effect
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _targetResolution = widget.initialResolution;

    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        performanceMode: FaceDetectorMode.fast,
        enableClassification: false,
        enableContours: false,
        enableLandmarks: false,
        enableTracking: false,
      ),
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _initCamera();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _pulseController.dispose();
    _faceDetector.close();
    _cameraController?.dispose();
    super.dispose();
  }

  Future<void> _initCamera() async {
    final status = await Permission.camera.request();
    if (!status.isGranted) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(T.of(ref).x('camera.permission_denied'))),
      );
      Navigator.of(context).pop(null);
      return;
    }

    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(T.of(ref).x('camera.no_camera_found'))),
        );
        Navigator.of(context).pop(null);
        return;
      }

      // Find preferred lens (front selfie vs rear agent)
      int targetIndex = _cameras.indexWhere(
        (c) => c.lensDirection == widget.preferredLensDirection,
      );
      if (targetIndex == -1) targetIndex = 0;
      _selectedCameraIndex = targetIndex;

      await _setupCameraController(_cameras[_selectedCameraIndex]);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Camera error: $e')),
        );
      }
    }
  }

  Future<void> _setupCameraController(CameraDescription description) async {
    final prev = _cameraController;
    if (prev != null) {
      await prev.stopImageStream().catchError((_) {});
      await prev.dispose();
    }

    final controller = CameraController(
      description,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: Platform.isAndroid
          ? ImageFormatGroup.nv21
          : ImageFormatGroup.bgra8888,
    );

    _cameraController = controller;

    try {
      await controller.initialize();
      await controller.setFlashMode(_flashMode);

      if (!mounted) return;
      setState(() {
        _isCameraInitialized = true;
      });

      // Start streaming frames for real-time face detection
      await controller.startImageStream(_onCameraImage);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start camera: $e')),
        );
      }
    }
  }

  Future<void> _switchCamera() async {
    if (_cameras.length < 2 || _isCapturing) return;
    _countdownTimer?.cancel();
    setState(() {
      _fitProgress = 0.0;
      _guideStatus = FaceGuideStatus.searching;
      _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;
      _isCameraInitialized = false;
    });

    await _setupCameraController(_cameras[_selectedCameraIndex]);
  }

  Future<void> _toggleFlash() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) return;
    final current = _flashMode;
    FlashMode next;
    switch (current) {
      case FlashMode.off:
        next = FlashMode.auto;
        break;
      case FlashMode.auto:
        next = FlashMode.always;
        break;
      case FlashMode.always:
      default:
        next = FlashMode.off;
        break;
    }
    try {
      await _cameraController!.setFlashMode(next);
      setState(() => _flashMode = next);
    } catch (_) {}
  }

  // ── Frame Processing & Face Fit Logic ──────────────────────────────────────

  void _onCameraImage(CameraImage image) async {
    if (_isProcessingFrame || _isCapturing || !mounted) return;

    // Throttle frame processing to at most ~10-12 FPS to keep UI responsive
    final now = DateTime.now();
    if (now.difference(_lastFrameTime).inMilliseconds < 90) return;
    _lastFrameTime = now;

    _isProcessingFrame = true;

    try {
      final inputImage = _buildInputImageFromCamera(image);
      if (inputImage == null) {
        _isProcessingFrame = false;
        return;
      }

      final faces = await _faceDetector.processImage(inputImage);
      if (!mounted) return;

      _evaluateFaceFitting(faces, image);
    } catch (_) {
      // Ignored: occasional frame drop is normal
    } finally {
      _isProcessingFrame = false;
    }
  }

  InputImage? _buildInputImageFromCamera(CameraImage image) {
    final camera = _cameras[_selectedCameraIndex];
    final sensorOrientation = camera.sensorOrientation;

    final rotation = InputImageRotationValue.fromRawValue(sensorOrientation);
    if (rotation == null) return null;

    final rawFormat = image.format.raw;
    final int? rawInt = rawFormat is int ? rawFormat : int.tryParse(rawFormat.toString());
    final format = rawInt == null ? null : InputImageFormatValue.fromRawValue(rawInt);
    if (format == null) return null;

    // Concatenate plane bytes
    final WriteBuffer allBytes = WriteBuffer();
    for (final Plane plane in image.planes) {
      allBytes.putUint8List(plane.bytes);
    }
    final bytes = allBytes.done().buffer.asUint8List();

    return InputImage.fromBytes(
      bytes: bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: image.planes[0].bytesPerRow,
      ),
    );
  }

  void _evaluateFaceFitting(List<Face> faces, CameraImage image) {
    final mediaQuery = MediaQuery.of(context);
    final screenSize = mediaQuery.size;
    final guideRect = FaceGuideOverlayPainter.getGuideCircleRect(screenSize);
    final t = T.of(ref);

    if (faces.isEmpty) {
      _resetCountdown();
      setState(() {
        _guideStatus = FaceGuideStatus.searching;
        _overridePrompt = t.x('camera.guide_prompt_position');
      });
      return;
    }

    if (faces.length > 1) {
      _resetCountdown();
      setState(() {
        _guideStatus = FaceGuideStatus.warning;
        _overridePrompt = t.x('camera.guide_prompt_multiple');
      });
      return;
    }

    final face = faces.first;
    final camera = _cameras[_selectedCameraIndex];
    final isFront = camera.lensDirection == CameraLensDirection.front;

    // Camera sensor is rotated 90 or 270 on portrait mobile devices
    final isSensorLandscape = camera.sensorOrientation == 90 || camera.sensorOrientation == 270;
    final imgWidth = isSensorLandscape ? image.height : image.width;
    final imgHeight = isSensorLandscape ? image.width : image.height;

    final scaleX = screenSize.width / imgWidth;
    final scaleY = screenSize.height / imgHeight;

    // Convert face coordinates to screen preview coordinates
    double faceCenterX = face.boundingBox.center.dx * scaleX;
    if (isFront) {
      // Front camera preview is mirrored horizontally
      faceCenterX = screenSize.width - faceCenterX;
    }
    final faceCenterY = face.boundingBox.center.dy * scaleY;
    final faceWidth = face.boundingBox.width * scaleX;

    // Alignment test against guide circle
    final centerDist = (Offset(faceCenterX, faceCenterY) - guideRect.center).distance;
    final maxCenterTolerance = guideRect.width * 0.32;

    final widthRatio = faceWidth / guideRect.width;

    // Check head rotation / pose
    final yaw = face.headEulerAngleY ?? 0.0;
    final roll = face.headEulerAngleZ ?? 0.0;
    final isLookingStraight = yaw.abs() < 18.0 && roll.abs() < 18.0;

    if (!isLookingStraight) {
      _resetCountdown();
      setState(() {
        _guideStatus = FaceGuideStatus.warning;
        _overridePrompt = t.x('camera.guide_prompt_straight');
      });
      return;
    }

    if (widthRatio < 0.52) {
      _resetCountdown();
      setState(() {
        _guideStatus = FaceGuideStatus.warning;
        _overridePrompt = t.x('camera.guide_prompt_closer');
      });
      return;
    }

    if (widthRatio > 0.90) {
      _resetCountdown();
      setState(() {
        _guideStatus = FaceGuideStatus.warning;
        _overridePrompt = t.x('camera.guide_prompt_farther');
      });
      return;
    }

    if (centerDist > maxCenterTolerance) {
      _resetCountdown();
      setState(() {
        _guideStatus = FaceGuideStatus.warning;
        _overridePrompt = t.x('camera.guide_prompt_position');
      });
      return;
    }

    // ALL FIT CONDITIONS MET!
    if (_guideStatus != FaceGuideStatus.fit) {
      HapticFeedback.selectionClick();
    }

    setState(() {
      _guideStatus = FaceGuideStatus.fit;
      _overridePrompt = t.x('camera.guide_prompt_hold_still');
    });

    _startOrAdvanceCountdown();
  }

  void _resetCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    if (_fitProgress != 0.0) {
      setState(() => _fitProgress = 0.0);
    }
  }

  void _startOrAdvanceCountdown() {
    if (_countdownTimer != null || _isCapturing) return;

    const totalSteps = 6;
    const stepDuration = Duration(milliseconds: 90); // ~540ms steady hold total
    int currentStep = 0;

    _countdownTimer = Timer.periodic(stepDuration, (timer) {
      if (!mounted || _isCapturing) {
        timer.cancel();
        return;
      }
      currentStep++;
      final progress = math.min(1.0, currentStep / totalSteps);
      setState(() => _fitProgress = progress);

      if (progress >= 1.0) {
        timer.cancel();
        _countdownTimer = null;
        _takePhoto();
      }
    });
  }

  // ── Capture & Post-Processing ──────────────────────────────────────────────

  Future<void> _takePhoto() async {
    if (_isCapturing || _cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    _countdownTimer?.cancel();
    _countdownTimer = null;

    setState(() {
      _isCapturing = true;
      _guideStatus = FaceGuideStatus.fit;
      _overridePrompt = T.of(ref).x('camera.guide_prompt_capturing');
    });

    HapticFeedback.mediumImpact();

    try {
      // Pause frame streaming before photo capture
      await _cameraController!.stopImageStream().catchError((_) {});

      // High-res picture capture
      final XFile rawXFile = await _cameraController!.takePicture();
      final rawFile = File(rawXFile.path);

      if (!mounted) return;

      final screenSize = MediaQuery.of(context).size;
      final guideRect = FaceGuideOverlayPainter.getGuideCircleRect(screenSize);

      // Process image: Crop to guided square, resize to 500 or 1000, and compress to WebP
      final result = await GuidedPhotoProcessor.processGuidedPhoto(
        rawFile: rawFile,
        previewSize: screenSize,
        guideRect: guideRect,
        targetResolution: _targetResolution,
      );

      if (!mounted) return;

      // Present confirmation sheet to confirm or retake
      final confirmed = await _showConfirmationDialog(result);
      if (confirmed == true) {
        if (mounted) Navigator.of(context).pop(result.file);
      } else {
        // User tapped retake: resume camera stream
        setState(() {
          _isCapturing = false;
          _fitProgress = 0.0;
          _guideStatus = FaceGuideStatus.searching;
          _overridePrompt = null;
        });
        await _cameraController!.startImageStream(_onCameraImage);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Capture error: $e')),
        );
        setState(() {
          _isCapturing = false;
          _fitProgress = 0.0;
        });
        _cameraController?.startImageStream(_onCameraImage).catchError((_) {});
      }
    }
  }

  Future<bool?> _showConfirmationDialog(ProcessedPhotoResult result) async {
    final t = T.of(ref);
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E1E2D),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(
            t.x('camera.preview_title'),
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Circular preview of cropped WebP image
              Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF10B981), width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF10B981).withValues(alpha: 0.3),
                      blurRadius: 16,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: ClipOval(
                  child: Image.file(
                    result.file,
                    fit: BoxFit.cover,
                    width: 220,
                    height: 220,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Size and resolution badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black45,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 16),
                    const SizedBox(width: 6),
                    Text(
                      result.badgeText,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actionsAlignment: MainAxisAlignment.spaceEvenly,
          actions: [
            OutlinedButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white70,
                side: const BorderSide(color: Colors.white24),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(t.x('camera.btn_retake')),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(t.x('camera.btn_use')),
            ),
          ],
        );
      },
    );
  }

  // ── UI Building ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final screenSize = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Camera Preview
          if (_isCameraInitialized && _cameraController != null)
            Center(
              child: CameraPreview(_cameraController!),
            )
          else
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: Color(0xFF10B981)),
                  const SizedBox(height: 16),
                  Text(
                    t.x('camera.guide_prompt_initializing'),
                    style: const TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                ],
              ),
            ),

          // 2. Face Guide Circular Cutout & Status Overlay
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, _) {
              return CustomPaint(
                size: screenSize,
                painter: FaceGuideOverlayPainter(
                  status: _guideStatus,
                  progress: _fitProgress,
                  pulseValue: _pulseController.value,
                ),
              );
            },
          ),

          // 3. Top Header Bar (Close, Resolution Toggle, Flash, Switch Camera)
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Back / Close
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white, size: 26),
                      onPressed: () => Navigator.of(context).pop(null),
                    ),

                    // Resolution Toggle Pill (500x500 vs 1000x1000)
                    Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildResolutionChip(500, t.x('camera.res_500')),
                          _buildResolutionChip(1000, t.x('camera.res_1000')),
                        ],
                      ),
                    ),

                    // Camera Controls (Flash + Switch)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(
                            _flashMode == FlashMode.off
                                ? Icons.flash_off
                                : (_flashMode == FlashMode.auto ? Icons.flash_auto : Icons.flash_on),
                            color: Colors.white,
                            size: 24,
                          ),
                          onPressed: _toggleFlash,
                        ),
                        if (_cameras.length > 1)
                          IconButton(
                            icon: const Icon(Icons.flip_camera_ios_outlined, color: Colors.white, size: 24),
                            onPressed: _switchCamera,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 4. Bottom Controls & Feedback Prompt
          SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Guidance Pill
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                      decoration: BoxDecoration(
                        color: _guideStatus == FaceGuideStatus.fit
                            ? const Color(0xFF10B981).withValues(alpha: 0.9)
                            : (_guideStatus == FaceGuideStatus.warning
                                ? const Color(0xFFF59E0B).withValues(alpha: 0.9)
                                : Colors.black87),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _guideStatus == FaceGuideStatus.fit
                                ? Icons.check_circle
                                : (_guideStatus == FaceGuideStatus.warning
                                    ? Icons.info_outline
                                    : Icons.face),
                            color: Colors.white,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _overridePrompt ?? t.x('camera.guide_prompt_position'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Shutter Button (Manual fallback & visual trigger)
                    GestureDetector(
                      onTap: _isCapturing ? null : _takePhoto,
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _guideStatus == FaceGuideStatus.fit
                                ? const Color(0xFF10B981)
                                : Colors.white,
                            width: 4,
                          ),
                        ),
                        child: Center(
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: _guideStatus == FaceGuideStatus.fit ? 62 : 56,
                            height: _guideStatus == FaceGuideStatus.fit ? 62 : 56,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _guideStatus == FaceGuideStatus.fit
                                  ? const Color(0xFF10B981)
                                  : Colors.white,
                            ),
                            child: _isCapturing
                                ? const Center(
                                    child: SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: CircularProgressIndicator(
                                        color: Colors.black,
                                        strokeWidth: 2.5,
                                      ),
                                    ),
                                  )
                                : null,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResolutionChip(int resolution, String label) {
    final isSelected = _targetResolution == resolution;
    return GestureDetector(
      onTap: () {
        if (!_isCapturing) {
          setState(() => _targetResolution = resolution);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF10B981) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white60,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}
