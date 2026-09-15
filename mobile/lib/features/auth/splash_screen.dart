import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/router/app_router.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';

/// Shown while the auth stage is bootstrapping, playing the official
/// ZoloFund animated splash video with seamless transition into the app.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  VideoPlayerController? _videoController;
  bool _videoInitialized = false;
  bool _showFallback = false;
  Timer? _fallbackTimer;
  Timer? _autoTransitionTimer;

  @override
  void initState() {
    super.initState();
    _initVideo();

    // Fallback escape hatch if server auth check takes too long (> 12s)
    _fallbackTimer = Timer(const Duration(seconds: 12), () {
      if (mounted) setState(() => _showFallback = true);
    });

    // Auto-advance splash after 5.2s (matching video duration)
    _autoTransitionTimer = Timer(const Duration(milliseconds: 5200), () {
      _finishSplash();
    });
  }

  void _initVideo() {
    try {
      _videoController = VideoPlayerController.asset(
        'assets/videos/zolo_fund_splash_screen.mp4',
      );

      _videoController!.initialize().then((_) {
        if (!mounted) return;
        setState(() => _videoInitialized = true);
        _videoController!.setLooping(false);
        _videoController!.setVolume(1.0);
        _videoController!.play();

        _videoController!.addListener(_videoListener);
      }).catchError((Object err) {
        debugPrint('[Splash] Video load notice: $err');
        Timer(const Duration(seconds: 2), _finishSplash);
      });
    } catch (e) {
      debugPrint('[Splash] Video initialization error: $e');
      Timer(const Duration(seconds: 2), _finishSplash);
    }
  }

  void _videoListener() {
    if (_videoController == null || !_videoController!.value.isInitialized) return;
    final position = _videoController!.value.position;
    final duration = _videoController!.value.duration;

    if (position >= duration && duration > Duration.zero) {
      _finishSplash();
    }
  }

  void _finishSplash() {
    if (!mounted) return;
    ref.read(splashReadyProvider.notifier).state = true;
  }

  @override
  void dispose() {
    _fallbackTimer?.cancel();
    _autoTransitionTimer?.cancel();
    if (_videoController != null) {
      _videoController!.removeListener(_videoListener);
      _videoController!.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF15171E),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _finishSplash, // Tap anywhere to skip
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 1. Splash Video Player
            if (_videoInitialized && _videoController != null)
              Center(
                child: AspectRatio(
                  aspectRatio: _videoController!.value.aspectRatio > 0
                      ? _videoController!.value.aspectRatio
                      : 9 / 16,
                  child: VideoPlayer(_videoController!),
                ),
              )
            else
              // Elegant branded placeholder while video initializes
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0xFF1A1D23),
                      Color(0xFF281429),
                      Color(0xFF15171E),
                    ],
                  ),
                ),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Image.asset(
                        'assets/images/logo.png',
                        height: 72,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(height: 32),
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // 2. Skip Action in top-right corner
            SafeArea(
              child: Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: TextButton(
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white70,
                      backgroundColor: Colors.black38,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                    ),
                    onPressed: _finishSplash,
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Skip',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.white70,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        SizedBox(width: 4),
                        Icon(Icons.chevron_right, size: 16, color: Colors.white70),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // 3. Fallback connection rescue button
            if (_showFallback)
              SafeArea(
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 36),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Connecting to Server...',
                          style: AppTypography.bodySmall.copyWith(
                            color: Colors.white70,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 12,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: () {
                            ref.read(authControllerProvider.notifier).logout();
                            ref.read(splashReadyProvider.notifier).state = true;
                            context.go('/login');
                          },
                          child: const Text('Proceed to Login'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
