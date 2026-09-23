import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';

import 'package:zolofund/core/router/app_router.dart';
import 'package:zolofund/data/services/approval_service.dart';
import 'package:zolofund/data/services/notifications_service.dart';

// Top-level entry-point required by Android for background action handling
@pragma('vm:entry-point')
void notificationTapBackground(NotificationResponse response) {
  // Executed in an isolated background engine if action is tapped while terminated/backgrounded.
  debugPrint('[Notification] Background action tapped: ${response.actionId} payload: ${response.payload}');
}

/// Manages interactive notifications on Android & iOS.
/// Displays actionable notifications (e.g. [Reply], [Mark as read], [Mute], [Approve], [Reject])
/// in the notification bar with user photo and handles user clicks.
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
  static const String actionReply = 'action_reply';
  static const String actionMarkRead = 'action_mark_read';
  static const String actionMute = 'action_mute';
  static const String actionView = 'action_view';
  static const String actionShowOnMap = 'action_show_on_map';
  static const String actionTopUpFloat = 'action_topup_float';

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

  Future<String?> _cacheAvatarImage(String? url, String id) async {
    if (url == null || url.trim().isEmpty) return null;
    try {
      final dir = await getTemporaryDirectory();
      final sanitizedId = id.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      final file = File('${dir.path}/notif_avatar_$sanitizedId.png');
      if (await file.exists()) {
        final stat = await file.stat();
        if (DateTime.now().difference(stat.modified).inHours < 48) {
          return file.path;
        }
      }
      final client = HttpClient();
      final uri = Uri.tryParse(url);
      if (uri == null) return null;
      final req = await client.getUrl(uri);
      final resp = await req.close();
      if (resp.statusCode == 200) {
        final bytes = await consolidateHttpClientResponseBytes(resp);
        await file.writeAsBytes(bytes);
        return file.path;
      }
    } catch (e) {
      debugPrint('[NotificationActionService] Failed to cache avatar: $e');
    }
    return null;
  }

  void _handleForegroundFcm(RemoteMessage message) {
    final data = message.data;
    final notification = message.notification;

    final title = (notification?.title ?? data['title'] ?? 'ZoloFund Alert').toString();
    final body = (notification?.body ?? data['body'] ?? data['message'] ?? '').toString();

    final type = data['type']?.toString() ?? '';
    final isApproval = type.contains('approval') ||
        data['actionable'] == 'true' ||
        data.containsKey('approvalId');
    final isCollection = type == 'collection_received' || type == 'payment' || type.contains('collect');
    final isFloatInsufficient = type == 'float_insufficient' || type.contains('float');

    final payloadStr = jsonEncode(data);

    if (isApproval) {
      showApprovalNotification(
        id: message.hashCode,
        title: title,
        body: body,
        payload: payloadStr,
        approvalId: data['approvalId'] as String?,
      );
    } else if (isCollection) {
      final avatarUrl = (data['avatarUrl'] ?? data['customerPhoto'] ?? data['profilePhoto'] ?? data['photo'])?.toString();
      showCollectionNotification(
        id: message.hashCode,
        title: title,
        body: body,
        avatarUrl: avatarUrl,
        payload: payloadStr,
      );
    } else if (isFloatInsufficient) {
      showFloatWarningNotification(
        id: message.hashCode,
        title: title,
        body: body,
        payload: payloadStr,
      );
    } else {
      final avatarUrl = (data['avatarUrl'] ?? data['customerPhoto'] ?? data['profilePhoto'] ?? data['photo'] ?? data['userPhoto'])?.toString();
      showRichNotification(
        id: message.hashCode,
        title: title,
        body: body,
        avatarUrl: avatarUrl,
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

  /// Displays a notification for payment collection with [Show on Map] and [Mark as read]
  Future<void> showCollectionNotification({
    required int id,
    required String title,
    required String body,
    String? avatarUrl,
    String? payload,
  }) async {
    String? avatarPath;
    if (avatarUrl != null && avatarUrl.isNotEmpty) {
      avatarPath = await _cacheAvatarImage(avatarUrl, id.toString());
    }

    final androidDetails = AndroidNotificationDetails(
      channelGeneral,
      'General Notifications',
      channelDescription: 'Payment collections and financial alerts',
      importance: Importance.max,
      priority: Priority.high,
      icon: 'ic_notification',
      color: const Color(0xFF10B981), // Emerald green
      largeIcon: avatarPath != null ? FilePathAndroidBitmap(avatarPath) : null,
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'ZoloFund • Collection',
      ),
      actions: const <AndroidNotificationAction>[
        AndroidNotificationAction(
          actionShowOnMap,
          'Show on Map',
          showsUserInterface: true,
          cancelNotification: true,
        ),
        AndroidNotificationAction(
          actionMarkRead,
          'Mark as read',
          cancelNotification: true,
        ),
      ],
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
    );

    await _localNotif.show(id, title, body, details, payload: payload);
  }

  /// Displays an urgent notification when float cash is insufficient to disburse a loan
  Future<void> showFloatWarningNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    final androidDetails = AndroidNotificationDetails(
      channelApprovals,
      'Approvals & Action Alerts',
      channelDescription: 'Actionable approval requests and urgent alerts',
      importance: Importance.max,
      priority: Priority.high,
      icon: 'ic_notification',
      color: Color(0xFFD97706), // Amber warning
      category: AndroidNotificationCategory.reminder,
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'ZoloFund • Float Alert',
      ),
      actions: <AndroidNotificationAction>[
        AndroidNotificationAction(
          actionTopUpFloat,
          'Top-up Float',
          showsUserInterface: true,
          cancelNotification: true,
        ),
        AndroidNotificationAction(
          actionMarkRead,
          'Dismiss',
          cancelNotification: true,
        ),
      ],
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
    );

    await _localNotif.show(id, title, body, details, payload: payload);
  }

  /// Displays a WhatsApp-style rich notification with app icon, user photo (largeIcon),
  /// and interactive actions: [Reply], [Mark as read], and [Mute].
  Future<void> showRichNotification({
    required int id,
    required String title,
    required String body,
    String? avatarUrl,
    String? payload,
  }) async {
    String? avatarPath;
    if (avatarUrl != null && avatarUrl.isNotEmpty) {
      avatarPath = await _cacheAvatarImage(avatarUrl, id.toString());
    }

    final androidDetails = AndroidNotificationDetails(
      channelGeneral,
      'General Notifications',
      channelDescription: 'General system, collection, and account alerts',
      importance: Importance.max,
      priority: Priority.high,
      icon: 'ic_notification',
      color: const Color(0xFF7D287E),
      largeIcon: avatarPath != null ? FilePathAndroidBitmap(avatarPath) : null,
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'ZoloFund',
      ),
      actions: const <AndroidNotificationAction>[
        AndroidNotificationAction(
          actionReply,
          'Reply',
          showsUserInterface: true,
          inputs: <AndroidNotificationActionInput>[
            AndroidNotificationActionInput(
              label: 'Type a reply...',
            ),
          ],
        ),
        AndroidNotificationAction(
          actionMarkRead,
          'Mark as read',
          cancelNotification: true,
        ),
        AndroidNotificationAction(
          actionMute,
          'Mute',
          cancelNotification: true,
        ),
      ],
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
    );

    await _localNotif.show(id, title, body, details, payload: payload);
  }

  /// Displays a standard notification (fallback)
  Future<void> showGeneralNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    await showRichNotification(
      id: id,
      title: title,
      body: body,
      payload: payload,
    );
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
    } else if (actionId == actionShowOnMap) {
      _handleShowOnMapAction(data);
    } else if (actionId == actionTopUpFloat) {
      _handleTopUpFloatAction(data);
    } else if (actionId == actionMarkRead) {
      _handleMarkReadAction(data);
    } else if (actionId == actionMute) {
      _handleMuteAction(data);
    } else if (actionId == actionReply) {
      _handleReplyAction(data, response.input);
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

  void _handleShowOnMapAction(Map<String, dynamic> data) {
    debugPrint('[Notification] User tapped SHOW ON MAP');
    _handleMarkReadAction(data);
    rootNavigatorKey.currentContext?.go('/admin/tracking');
  }

  void _handleTopUpFloatAction(Map<String, dynamic> data) {
    debugPrint('[Notification] User tapped TOP-UP FLOAT');
    _handleMarkReadAction(data);
    rootNavigatorKey.currentContext?.go('/wallet');
  }

  void _handleMarkReadAction(Map<String, dynamic> data) {
    final notifId = (data['id'] ?? data['notificationId'])?.toString();
    debugPrint('[Notification] User tapped MARK AS READ for id: $notifId');
    if (_ref != null && notifId != null && notifId.isNotEmpty) {
      _ref!.read(notificationsServiceProvider).markRead(notifId).catchError((_) {});
    }
  }

  void _handleMuteAction(Map<String, dynamic> data) {
    debugPrint('[Notification] User tapped MUTE');
  }

  void _handleReplyAction(Map<String, dynamic> data, String? replyText) {
    debugPrint('[Notification] User tapped REPLY: $replyText');
    final link = data['link'] as String?;
    if (link != null && link.isNotEmpty) {
      rootNavigatorKey.currentContext?.go(link);
    } else {
      rootNavigatorKey.currentContext?.go('/notifications');
    }
  }

  void _handleDefaultClick(Map<String, dynamic> data) {
    final type = data['type']?.toString() ?? '';
    final link = data['link'] as String?;
    if (link != null && link.isNotEmpty && link != '/route-tracker') {
      rootNavigatorKey.currentContext?.go(link);
    } else if (type.contains('approval') || data.containsKey('approvalId')) {
      rootNavigatorKey.currentContext?.go('/approvals');
    } else if (type == 'collection_received' || type == 'payment' || link == '/route-tracker') {
      rootNavigatorKey.currentContext?.go('/admin/tracking');
    } else if (type == 'float_insufficient') {
      rootNavigatorKey.currentContext?.go('/wallet');
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
