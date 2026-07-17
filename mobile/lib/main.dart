import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'package:loantrack/app.dart';

// Handles pushes when the app is backgrounded/terminated. Must be top-level.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Bound the in-memory decoded-image cache. Flutter's default is 100 MB,
  // which on 2-3 GB devices (plus our lists of customer photos) is enough to
  // get the whole app OOM-killed in the background. 40 MB comfortably holds
  // a few screens' worth of 800px-capped decodes (see authed_image.dart).
  PaintingBinding.instance.imageCache.maximumSizeBytes = 40 << 20;
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
  runApp(const ProviderScope(child: App()));
}
