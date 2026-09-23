import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/router/app_router.dart';
import 'package:zolofund/data/services/approval_service.dart';

// Top-level entry-point required by Android for background action handling
@pragma('vm:entry-point')
void notificationTapBackground(NotificationResponse response) {
  // Executed in an isolated background engine if action is tapped while terminated/backgrounded.
  debugPrint('[Notification] Background action tapped: ${response.actionId} payload: ${response.payload}');
}

/// Manages interactive notifications on Android & iOS.
/// Displays actionable notifications (e.g. [Approve] / [Reject]) in the notification bar
/// and handles user clicks.
class NotificationActionService {
  NotificationActionService._();
  static final NotificationActionService instance = NotificationActionService._();

  final FlutterLocalNotificationsPlugin _localNotif = FlutterLocalNotificationsPlugin();
  bool _initialized = false;
  Ref? _ref;

  static const String channelApprovals = 'approvals_channel';
  static const String channelGeneral = 'general_channel';

  static const String actionApprove = 'action_approve';
  static const String actionReject = 'action_reject';

  void setRef(Ref ref) {
    _ref = ref;
  }

  Future<void> initialize({Ref? ref}) async {
    if (ref != null) _ref = ref;
    if (_initialized) return;

    // 1. Android & iOS initialization settings
    const androidSettings = AndroidInitializationSettings('ic_notification');
    const darwinSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: darwinSettings,
    );

    await _localNotif.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationResponse,
      onDidReceiveBackgroundNotificationResponse: notificationTapBackground,
    );

    // 2. Create notification channels on Android
    final androidPlugin = _localNotif.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();

    if (androidPlugin != null) {
      await androidPlugin.createNotificationChannel(
        const AndroidNotificationChannel(
          channelApprovals,
          'Approvals & Action Alerts',
          description: 'Actionable approval requests and urgent alerts',
          importance: Importance.max,
          enableVibration: true,
          playSound: true,
        ),
      );

      await androidPlugin.createNotificationChannel(
        const AndroidNotificationChannel(
          channelGeneral,
          'General Notifications',
          description: 'General system, collection, and account alerts',
          importance: Importance.defaultImportance,
          enableVibration: true,
          playSound: true,
        ),
      );

      // Request notification runtime permission on Android 13+
      await androidPlugin.requestNotificationsPermission();
    }

    // 3. Listen to incoming FCM push notifications in the foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundFcm);

    _initialized = true;
    debugPrint('[NotificationActionService] Initialized successfully');
  }

  void _handleForegroundFcm(RemoteMessage message) {
    final data = message.data;
    final notification = message.notification;

    final title = (notification?.title ?? data['title'] ?? 'ZoloFund Alert').toString();
    final body = (notification?.body ?? data['body'] ?? data['message'] ?? '').toString();

    final type = data['type']?.toString() ?? '';
    final isApproval = type == 'approval_request' ||
        type == 'approval' ||
        data['actionable'] == 'true' ||
        data.containsKey('approvalId');

    final payloadStr = jsonEncode(data);

    if (isApproval) {
      showApprovalNotification(
        id: message.hashCode,
        title: title,
        body: body,
        payload: payloadStr,
        approvalId: data['approvalId'] as String?,
      );
    } else {
      showGeneralNotification(
        id: message.hashCode,
        title: title,
        body: body,
        payload: payloadStr,
      );
    }
  }

  /// Displays an actionable notification with [Approve] and [Reject] buttons in the notification bar
  Future<void> showApprovalNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
    String? approvalId,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      channelApprovals,
      'Approvals & Action Alerts',
      channelDescription: 'Actionable approval requests and urgent alerts',
      importance: Importance.max,
      priority: Priority.high,
      icon: 'ic_notification',
      color: Color(0xFF7D287E), // Brand primary purple
      category: AndroidNotificationCategory.reminder,
      actions: <AndroidNotificationAction>[
        AndroidNotificationAction(
          actionApprove,
          'Approve',
          showsUserInterface: true,
          cancelNotification: true,
        ),
        AndroidNotificationAction(
          actionReject,
          'Reject',
          showsUserInterface: true,
          cancelNotification: true,
        ),
      ],
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
    );

    await _localNotif.show(
      id,
      title,
      body,
      details,
      payload: payload ?? jsonEncode({'approvalId': approvalId, 'type': 'approval_request'}),
    );
  }

  /// Displays a standard notification
  Future<void> showGeneralNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      channelGeneral,
      'General Notifications',
      channelDescription: 'General system, collection, and account alerts',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
      icon: 'ic_notification',
      color: Color(0xFF7D287E),
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
    );

    await _localNotif.show(id, title, body, details, payload: payload);
  }

  void _onNotificationResponse(NotificationResponse response) {
    final actionId = response.actionId;
    final payload = response.payload;

    debugPrint('[Notification] Click received. Action: $actionId, Payload: $payload');

    Map<String, dynamic> data = {};
    if (payload != null && payload.isNotEmpty) {
      try {
        data = jsonDecode(payload) as Map<String, dynamic>;
      } catch (_) {}
    }

    final approvalId = data['approvalId'] as String?;

    if (actionId == actionApprove) {
      _handleApproveAction(approvalId);
    } else if (actionId == actionReject) {
      _handleRejectAction(approvalId);
    } else {
      // User clicked notification body
      _handleDefaultClick(data);
    }
  }

  Future<void> _handleApproveAction(String? approvalId) async {
    debugPrint('[Notification] User tapped APPROVE for id: $approvalId');
    if (_ref != null && approvalId != null && approvalId.isNotEmpty) {
      try {
        final approvalSvc = _ref!.read(approvalServiceProvider);
        await approvalSvc.approve(approvalId);
        debugPrint('[Notification] Approved successfully via notification bar');
      } catch (e) {
        debugPrint('[Notification] Inline approval error: $e');
      }
    }
    // Navigate to /approvals
    rootNavigatorKey.currentContext?.go('/approvals');
  }

  void _handleRejectAction(String? approvalId) {
    debugPrint('[Notification] User tapped REJECT for id: $approvalId');
    // Navigate directly to the approvals queue so user can review and provide reason
    rootNavigatorKey.currentContext?.go('/approvals');
  }

  void _handleDefaultClick(Map<String, dynamic> data) {
    final link = data['link'] as String?;
    if (link != null && link.isNotEmpty) {
      rootNavigatorKey.currentContext?.go(link);
    } else if (data['type'] == 'approval_request' || data.containsKey('approvalId')) {
      rootNavigatorKey.currentContext?.go('/approvals');
    } else {
      rootNavigatorKey.currentContext?.go('/notifications');
    }
  }
}

final notificationActionServiceProvider = Provider<NotificationActionService>((ref) {
  final svc = NotificationActionService.instance;
  svc.setRef(ref);
  return svc;
});
