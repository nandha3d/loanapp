import 'dart:async';
import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/features/notifications/notifications_screen.dart';

/// Top-level handler for background messages — required by FCM.
@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async {
  // No-op: presence of the handler is enough to wake the isolate.
}

class FcmService {
  FcmService(this._dio);
  final Dio _dio;

  bool _initialized = false;
  String? _pendingRoute;

  String? get pendingRoute {
    final r = _pendingRoute;
    _pendingRoute = null;
    return r;
  }

  Future<void> initFirebase() async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_backgroundHandler);
      _initialized = true;
    } on Object catch (e) {
      debugPrint('Firebase init skipped: $e');
    }
  }

  Future<void> requestPermissionAndRegister() async {
    if (!_initialized) return;
    try {
      final m = FirebaseMessaging.instance;
      await m.requestPermission();
      final token = await m.getToken();
      if (token != null) {
        await _post(token);
      }
      m.onTokenRefresh.listen(_post);
      FirebaseMessaging.onMessage.listen(_onForeground);
      final initial = await m.getInitialMessage();
      if (initial != null) {
        _pendingRoute = _routeFor(initial);
      }
      FirebaseMessaging.onMessageOpenedApp.listen((m) {
        _pendingRoute = _routeFor(m);
      });
    } on Object catch (e) {
      debugPrint('FCM register skipped: $e');
    }
  }

  Future<void> _post(String token) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/fcm-token',
        data: {
          'token': token,
          'platform': Platform.isIOS ? 'ios' : 'android',
        },
      );
    } on Object catch (e) {
      debugPrint('FCM token POST failed: $e');
    }
  }

  void _onForeground(RemoteMessage m) {
    final title = m.notification?.title ?? m.data['title'] as String? ?? 'Notification';
    final body = m.notification?.body ?? m.data['body'] as String? ?? '';
    final type = (m.data['type'] as String?) ?? 'info';
    NotificationInbox.instance.add(
      NotificationItem(
        title: title,
        body: body,
        type: type,
        timestamp: DateTime.now(),
      ),
    );
  }

  String? _routeFor(RemoteMessage m) {
    final type = (m.data['type'] as String?) ?? '';
    return switch (type) {
      'overdue' || 'collection' => '/collection',
      'approval' => '/approvals',
      'penalty' => '/penalties',
      _ => '/notifications',
    };
  }
}

final fcmServiceProvider = Provider<FcmService>(
  (ref) => FcmService(ref.watch(dioProvider)),
);
