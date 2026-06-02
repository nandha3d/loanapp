import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';

class FcmService {
  FcmService(this._dio);
  final Dio _dio;
  StreamSubscription<String>? _refreshSub;

  Future<void> registerToken({required String token, required String platform}) async {
    await _dio.post<Map<String, dynamic>>(
      '/fcm-token',
      data: {'token': token, 'platform': platform},
    );
  }

  /// MOB-02: registers initial token + listens for rotation.
  /// Call once after login. `dispose()` on logout.
  Future<void> startTokenSync() async {
    // FCM is not supported on web — skip silently.
    if (kIsWeb) return;

    final fm = FirebaseMessaging.instance;
    try {
      await fm.requestPermission(alert: true, badge: true, sound: true);
      final initial = await fm.getToken();
      if (initial != null) {
        await registerToken(token: initial, platform: 'other').catchError((_) {});
      }
      _refreshSub?.cancel();
      _refreshSub = fm.onTokenRefresh.listen((t) {
        registerToken(token: t, platform: 'other').catchError((_) {});
      });
    } catch (e) {
      debugPrint('FCM init failed (permission denied or unavailable): $e');
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
