import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'package:zolofund/app.dart';
import 'package:zolofund/core/notifications/notification_action_service.dart';

// Handles pushes when the app is backgrounded/terminated. Must be top-level.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
    await NotificationActionService.instance.showBackgroundNotification(message);
  } catch (e) {
    debugPrint('[FCM] Background handler error: $e');
  }
}

// Memory management observer: Trims decoded bitmap cache on memory pressure or when
// the app is paused/backgrounded, so Android Low Memory Killer (LMK) never terminates
// the app while switching between apps.
class _AppMemoryManager with WidgetsBindingObserver {
  @override
  void didHaveMemoryPressure() {
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // Clear non-visible decoded image caches when user switches to another app
      PaintingBinding.instance.imageCache.clear();
    }
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Bound the in-memory decoded-image cache to keep RAM footprint lean (40MB / 80 items)
  // and register memory observer so switching apps never terminates this application.
  PaintingBinding.instance.imageCache.maximumSizeBytes = 40 << 20;
  PaintingBinding.instance.imageCache.maximumSize = 80;
  WidgetsBinding.instance.addObserver(_AppMemoryManager());
  // Release builds paint a bare gray box (RenderErrorBox) when a widget
  // build throws, which users report as a "blank page" with nothing to act
  // on. Render the exception and stack instead so a screenshot of the
  // failure is enough to debug it.
  ErrorWidget.builder = (details) => Directionality(
        textDirection: TextDirection.ltr,
        child: Material(
          color: const Color(0xFF7F1D1D),
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Screen failed to render\n\n'
                '${details.exceptionAsString()}\n\n${details.stack ?? ''}',
                style: const TextStyle(color: Colors.white, fontSize: 11),
              ),
            ),
          ),
        ),
      );
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  await Hive.initFlutter();
  // FCM: init Firebase (reads google-services.json) before the app starts.
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  } catch (e) {
    debugPrint('Firebase init failed: $e');
  }

  // Initialize interactive notification bar actions ([Approve] / [Reject])
  try {
    await NotificationActionService.instance.initialize();
  } catch (e) {
    debugPrint('NotificationActionService init failed: $e');
  }

  runApp(const ProviderScope(child: App()));
}
