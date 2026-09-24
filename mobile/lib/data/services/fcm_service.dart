import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart'
    show debugPrint, defaultTargetPlatform, kIsWeb, TargetPlatform;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/notifications/notification_action_service.dart';

class FcmService {
  FcmService(this._dio);
  final Dio _dio;
  StreamSubscription<String>? _refreshSub;
  String? _lastToken;

  String? get currentToken => _lastToken;

  String _getPlatformString() {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      default:
        return 'other';
    }
  }

  Future<void> registerToken({
    required String token,
    required String platform,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/fcm-token',
      data: {'token': token, 'platform': platform},
    );
    debugPrint('[FCM] Token registered with server: ${res.statusCode}');
  }

  /// MOB-02: registers initial token + listens for rotation with retry logic.
  /// Call once after login. `dispose()` on logout.
  Future<void> startTokenSync() async {
    // FCM is not supported on web or desktop — skip silently.
    if (kIsWeb) {
      return;
    }
    if (defaultTargetPlatform == TargetPlatform.windows ||
        defaultTargetPlatform == TargetPlatform.linux ||
        defaultTargetPlatform == TargetPlatform.macOS) {
      return;
    }

    final fm = FirebaseMessaging.instance;
    try {
      // 1. Ensure foreground heads-up notifications are allowed
      await fm.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 2. Request Android 13+ and iOS notification permissions
      await NotificationActionService.instance.requestPermission();
      await fm.requestPermission(alert: true, badge: true, sound: true);

      final platform = _getPlatformString();
      final initial = await fm.getToken();
      if (initial != null && initial.isNotEmpty) {
        _lastToken = initial;
        debugPrint(
          '[FCM] Token retrieved: ${initial.substring(0, initial.length > 10 ? 10 : initial.length)}...',
        );
        await _registerWithRetry(initial, platform);
      }

      _refreshSub?.cancel();
      _refreshSub = fm.onTokenRefresh.listen((t) {
        _lastToken = t;
        debugPrint('[FCM] Token refreshed');
        _registerWithRetry(t, platform);
      });
    } catch (e) {
      debugPrint('[FCM] Token sync init failed: $e');
    }
  }

  Future<void> _registerWithRetry(String token, String platform) async {
    for (int attempt = 1; attempt <= 3; attempt++) {
      try {
        await registerToken(token: token, platform: platform);
        return;
      } catch (e) {
        debugPrint('[FCM] Attempt $attempt register failed: $e');
        if (attempt < 3) {
          await Future<void>.delayed(Duration(seconds: attempt * 2));
        }
      }
    }
  }

  /// Queries server to see if push is configured and how many devices are registered
  Future<Map<String, dynamic>?> checkServerPushStatus() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/fcm-token');
      return res.data?['data'] as Map<String, dynamic>?;
    } catch (e) {
      debugPrint('[FCM] Check server push status failed: $e');
      return null;
    }
  }

  /// Sends a live test push notification to this user's registered devices
  Future<Map<String, dynamic>> sendTestPush() async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/fcm-token/test');
      return res.data?['data'] as Map<String, dynamic>? ??
          {'sent': false, 'message': 'Unknown response'};
    } catch (e) {
      debugPrint('[FCM] Test push request failed: $e');
      return {'sent': false, 'message': e.toString()};
    }
  }

  Future<void> dispose() async {
    await _refreshSub?.cancel();
    _refreshSub = null;
  }
}

final fcmServiceProvider = Provider<FcmService>(
  (ref) => FcmService(ref.watch(dioProvider)),
);

