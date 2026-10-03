import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';

import 'package:zolofund/core/auth/auth_storage.dart';
import 'package:zolofund/core/l10n/app_strings.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/notifications/notification_text.dart';
import 'package:zolofund/core/router/app_router.dart';
import 'package:zolofund/shared/constants/endpoints.dart';
import 'package:zolofund/data/services/approval_service.dart';
import 'package:zolofund/data/services/notifications_service.dart';

// Top-level entry-point required by Android for background action handling
@pragma('vm:entry-point')
Future<void> notificationTapBackground(NotificationResponse response) async {
  // Executed in an isolated background engine if action is tapped while terminated/backgrounded.
  debugPrint('[Notification] Background action tapped: ${response.actionId} payload: ${response.payload}');
  // Approve is decided right here, with no app launch. Reject deliberately opens
  // the app (showsUserInterface) so the reviewer can type a reason.
  if (response.actionId == NotificationActionService.actionApprove) {
    await NotificationActionService.approveInBackground(response);
  }
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

    // Process notification tap that launched the app from terminated state
    final launchDetails = await _localNotif.getNotificationAppLaunchDetails();
    if (launchDetails?.didNotificationLaunchApp == true &&
        launchDetails?.notificationResponse != null) {
      Future.delayed(const Duration(milliseconds: 600), () {
        _onNotificationResponse(launchDetails!.notificationResponse!);
      });
    }

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
          importance: Importance.high,
          enableVibration: true,
          playSound: true,
        ),
      );

      // Request notification runtime permission on Android 13+
      await androidPlugin.requestNotificationsPermission();
    }

    // 3. Listen to incoming FCM push notifications in the foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundFcm);

    // 4. Handle notification clicks when the app is in the background or killed
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[NotificationActionService] Notification opened from background');
      _handleDefaultClick(message.data);
    });

    FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        debugPrint('[NotificationActionService] App launched from notification');
        _handleDefaultClick(message.data);
      }
    });

    _initialized = true;
    debugPrint('[NotificationActionService] Initialized successfully');
  }

  /// Explicitly requests notification runtime permissions (e.g. Android 13+ POST_NOTIFICATIONS)
  /// Can be called safely from UI lifecycle when Activity is active.
  Future<bool> requestPermission() async {
    try {
      final androidPlugin = _localNotif.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        final granted = await androidPlugin.requestNotificationsPermission();
        debugPrint('[NotificationActionService] Android notification permission: $granted');
        return granted ?? false;
      }
      final iosPlugin = _localNotif.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      if (iosPlugin != null) {
        final granted = await iosPlugin.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
        return granted ?? false;
      }
    } catch (e) {
      debugPrint('[NotificationActionService] Permission request failed: $e');
    }
    return false;
  }

  /// Handles incoming push notifications received in background/terminated isolates
  Future<void> showBackgroundNotification(RemoteMessage message) async {
    final data = Map<String, dynamic>.from(message.data);
    final notification = message.notification;

    // Server ships an i18n key + params next to the English text; render in the
    // device language, falling back to the English text.
    final lang = await readStoredLanguageCode();
    final params = decodeNotificationParams(data['params']);
    final title = localizeNotificationText(
      key: data['titleKey']?.toString(),
      fallback: (notification?.title ?? data['title'] ?? 'ZoloFund Alert').toString(),
      params: params,
      langCode: lang,
    );
    final body = localizeNotificationText(
      key: data['messageKey']?.toString(),
      fallback: (notification?.body ?? data['body'] ?? data['message'] ?? '').toString(),
      params: params,
      langCode: lang,
    );
    if (title.isEmpty && body.isEmpty) return;

    if (!_initialized) {
      const androidSettings = AndroidInitializationSettings('ic_notification');
      const darwinSettings = DarwinInitializationSettings();
      await _localNotif.initialize(
        const InitializationSettings(android: androidSettings, iOS: darwinSettings),
        onDidReceiveNotificationResponse: _onNotificationResponse,
        onDidReceiveBackgroundNotificationResponse: notificationTapBackground,
      );
      _initialized = true;
    }

    final type = data['type']?.toString() ?? '';
    final link = (data['link'] ?? '').toString();
    // Buttons only when the SERVER marked the push actionable (a real pending
    // request this recipient may decide). Matching on "approv" in the text also
    // matched result notices such as "Request approved".
    final isApproval = data['actionable'] == 'true';
    final channelId = (isApproval || type.contains('approval'))
        ? channelApprovals
        : channelGeneral;

    String? approvalId = data['approvalId']?.toString();
    if (approvalId == null || approvalId.isEmpty) {
      approvalId = data['id']?.toString();
    }
    if (approvalId == null || approvalId.isEmpty) {
      final match = RegExp(r'[?&]id=([^&]+)').firstMatch(link);
      if (match != null) approvalId = match.group(1);
    }
    if (approvalId != null && approvalId.isNotEmpty) {
      data['approvalId'] = approvalId;
    }

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
          importance: Importance.high,
          enableVibration: true,
          playSound: true,
        ),
      );
    }

    final androidDetails = AndroidNotificationDetails(
      channelId,
      isApproval ? 'Approvals & Action Alerts' : 'General Notifications',
      importance: Importance.max,
      priority: Priority.high,
      icon: 'ic_notification',
      largeIcon: const DrawableResourceAndroidBitmap('app_logo'),
      color: const Color(0xFF7D287E),
      category: isApproval ? AndroidNotificationCategory.reminder : null,
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'ZoloFund',
      ),
      actions: isApproval
          ? <AndroidNotificationAction>[
              // Approve runs in the background isolate — no app launch.
              AndroidNotificationAction(
                actionApprove,
                _shadeLabel(lang, 'btn.approve', 'Approve'),
                showsUserInterface: false,
                cancelNotification: true,
              ),
              // Reject opens the app on the request so a reason can be typed.
              AndroidNotificationAction(
                actionReject,
                _shadeLabel(lang, 'btn.reject', 'Reject'),
                showsUserInterface: true,
                cancelNotification: true,
              ),
            ]
          : null,
    );

    await _localNotif.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(android: androidDetails),
      payload: jsonEncode(data),
    );
  }

  static String _shadeLabel(String lang, String key, String fallback) =>
      localizeNotificationText(key: key, fallback: fallback, params: null, langCode: lang);

  /// Approve straight from the notification shade. Runs in the background
  /// isolate: no Riverpod, so it talks to the API with a standalone Dio built
  /// from the stored session. Anything that cannot be decided here (expired
  /// session, offline, server error) degrades to a tappable notification that
  /// opens the request in the app. The server stays the source of truth: a
  /// request another admin already decided answers 409 and is reported as such.
  static Future<void> approveInBackground(NotificationResponse response) async {
    Map<String, dynamic> data = {};
    try {
      final p = response.payload;
      if (p != null && p.isNotEmpty) data = Map<String, dynamic>.from(jsonDecode(p) as Map);
    } catch (_) {}
    final approvalId = (data['approvalId'] ?? data['id'])?.toString() ??
        RegExp(r'[?&]id=([^&]+)').firstMatch(data['link']?.toString() ?? '')?.group(1);
    final lang = await readStoredLanguageCode();
    final notifId = response.id ?? 0;

    Future<void> post(String key, String fallback, {bool openApp = false}) async {
      final plugin = FlutterLocalNotificationsPlugin();
      await plugin.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('ic_notification'),
          iOS: DarwinInitializationSettings(),
        ),
      );
      final text = localizeNotificationText(key: key, fallback: fallback, params: null, langCode: lang);
      await plugin.show(
        notifId,
        'ZoloFund',
        text,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            channelApprovals,
            'Approvals & Action Alerts',
            importance: Importance.high,
            priority: Priority.high,
            icon: 'ic_notification',
            largeIcon: DrawableResourceAndroidBitmap('app_logo'),
            color: Color(0xFF7D287E),
          ),
        ),
        // A payload that routes to the request when the user taps the result.
        payload: openApp
            ? jsonEncode({
                'type': 'approval_request',
                'actionable': 'true',
                'approvalId': approvalId,
                'link': '/approvals?id=$approvalId',
              })
            : null,
      );
    }

    if (approvalId == null || approvalId.isEmpty) {
      await post('notif.shade.approve_failed', 'Could not approve — tap to open', openApp: true);
      return;
    }

    try {
      final storage = AuthStorage.standalone();
      final token = await storage.readToken();
      if (token == null || token.isEmpty) {
        await post('notif.shade.approve_failed', 'Could not approve — tap to open', openApp: true);
        return;
      }
      final dio = Dio(
        BaseOptions(
          baseUrl: kDefaultBaseUrl,
          connectTimeout: const Duration(seconds: 20),
          receiveTimeout: const Duration(seconds: 20),
          validateStatus: (s) => s != null && s < 500,
          headers: {'Accept': 'application/json'},
        ),
      );
      // Same context headers the in-app interceptor sends.
      final tenantSlug = await storage.readTenantSlug();
      final branchId = await storage.readBranchId();
      final appType = await storage.readAppType();

      Future<Response<dynamic>> send(String bearer) => dio.patch<dynamic>(
            Endpoints.approvalApprove(approvalId),
            data: <String, dynamic>{},
            options: Options(
              headers: {
                'Authorization': 'Bearer $bearer',
                if (tenantSlug != null) 'X-Tenant-Slug': tenantSlug,
                if (branchId != null) 'X-Branch-Id': branchId,
                if (appType != null) 'X-App-Type': appType,
              },
            ),
          );

      var res = await send(token);
      if (res.statusCode == 401) {
        // One silent refresh, same contract as the in-app interceptor.
        final refresh = await storage.readRefreshToken();
        if (refresh != null && refresh.isNotEmpty) {
          final r = await dio.post<dynamic>('/auth/refresh', data: {'refreshToken': refresh});
          final d = r.data is Map ? (r.data as Map)['data'] : null;
          final nt = d is Map ? d['token'] as String? : null;
          final nr = d is Map ? d['refreshToken'] as String? : null;
          if (nt != null && nr != null) {
            await storage.updateTokens(token: nt, refreshToken: nr);
            res = await send(nt);
          }
        }
      }

      final body = res.data;
      final ok = res.statusCode == 200 && body is Map && body['error'] == null;
      if (ok) {
        await post('notif.shade.approved', 'Approved');
      } else if (res.statusCode == 404 || res.statusCode == 409) {
        await post('notif.shade.already_handled', 'Already handled');
      } else {
        await post('notif.shade.approve_failed', 'Could not approve — tap to open', openApp: true);
      }
    } catch (e) {
      debugPrint('[Notification] Background approve failed: $e');
      await post('notif.shade.approve_failed', 'Could not approve — tap to open', openApp: true);
    }
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

  Future<void> _handleForegroundFcm(RemoteMessage message) async {
    final data = Map<String, dynamic>.from(message.data);
    final notification = message.notification;

    final lang = _ref?.read(languageProvider).code ?? await readStoredLanguageCode();
    final params = decodeNotificationParams(data['params']);
    final title = localizeNotificationText(
      key: data['titleKey']?.toString(),
      fallback: (notification?.title ?? data['title'] ?? 'ZoloFund Alert').toString(),
      params: params,
      langCode: lang,
    );
    final body = localizeNotificationText(
      key: data['messageKey']?.toString(),
      fallback: (notification?.body ?? data['body'] ?? data['message'] ?? '').toString(),
      params: params,
      langCode: lang,
    );

    final type = data['type']?.toString() ?? '';
    final link = (data['link'] ?? '').toString();
    // Server-flagged only: a real pending request this recipient may decide.
    final isApproval = data['actionable'] == 'true';
    final isCollection = type == 'collection_received' || type == 'payment' || type.contains('collect');
    final isFloatInsufficient = type == 'float_insufficient' || type.contains('float');

    String? approvalId = data['approvalId']?.toString();
    if (approvalId == null || approvalId.isEmpty) {
      approvalId = data['id']?.toString();
    }
    if (approvalId == null || approvalId.isEmpty) {
      final match = RegExp(r'[?&]id=([^&]+)').firstMatch(link);
      if (match != null) approvalId = match.group(1);
    }
    if (approvalId != null && approvalId.isNotEmpty) {
      data['approvalId'] = approvalId;
    }

    final payloadStr = jsonEncode(data);

    if (isApproval) {
      showApprovalNotification(
        id: message.hashCode,
        title: title,
        body: body,
        payload: payloadStr,
        approvalId: approvalId,
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
    final lang = _ref?.read(languageProvider).code ?? await readStoredLanguageCode();
    final androidDetails = AndroidNotificationDetails(
      channelApprovals,
      'Approvals & Action Alerts',
      channelDescription: 'Actionable approval requests and urgent alerts',
      importance: Importance.max,
      priority: Priority.high,
      icon: 'ic_notification',
      largeIcon: const DrawableResourceAndroidBitmap('app_logo'),
      color: const Color(0xFF7D287E), // Brand primary purple
      category: AndroidNotificationCategory.reminder,
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'ZoloFund',
      ),
      actions: <AndroidNotificationAction>[
        // Approve is decided in place (see approveInBackground) — no app launch.
        AndroidNotificationAction(
          actionApprove,
          _shadeLabel(lang, 'btn.approve', 'Approve'),
          showsUserInterface: false,
          cancelNotification: true,
        ),
        // Reject opens the app on the request so a reason can be typed.
        AndroidNotificationAction(
          actionReject,
          _shadeLabel(lang, 'btn.reject', 'Reject'),
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

    final details = NotificationDetails(
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

  /// Displays a notification for payment collection with [Show on Map]
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
      largeIcon: avatarPath != null
          ? FilePathAndroidBitmap(avatarPath)
          : const DrawableResourceAndroidBitmap('app_logo'),
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
      largeIcon: const DrawableResourceAndroidBitmap('app_logo'),
      color: const Color(0xFFD97706), // Amber warning
      category: AndroidNotificationCategory.reminder,
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'ZoloFund • Float Alert',
      ),
      actions: const <AndroidNotificationAction>[
        AndroidNotificationAction(
          actionTopUpFloat,
          'Top-up Float',
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

    final details = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
    );

    await _localNotif.show(id, title, body, details, payload: payload);
  }

  /// Displays a notification with app icon/logo or user photo without unwanted reply/mark read/mute buttons.
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
      largeIcon: avatarPath != null
          ? FilePathAndroidBitmap(avatarPath)
          : const DrawableResourceAndroidBitmap('app_logo'),
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'ZoloFund',
      ),
      actions: null,
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

    final approvalId = (data['approvalId'] ?? data['id'])?.toString() ??
        RegExp(r'[?&]id=([^&]+)').firstMatch(data['link']?.toString() ?? '')?.group(1);

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
    bool approved = false;
    if (_ref != null && approvalId != null && approvalId.isNotEmpty) {
      try {
        final approvalSvc = _ref!.read(approvalServiceProvider);
        await approvalSvc.approve(approvalId);
        approved = true;
        debugPrint('[Notification] Approved successfully via notification bar');
      } catch (e) {
        debugPrint('[Notification] Inline approval error: $e');
      }
    }
    final action = approved ? 'approved' : 'approve';
    final route = (approvalId != null && approvalId.isNotEmpty)
        ? '/approvals?id=$approvalId&action=$action'
        : '/approvals';
    rootNavigatorKey.currentContext?.go(route);
  }

  void _handleRejectAction(String? approvalId) {
    debugPrint('[Notification] User tapped REJECT for id: $approvalId');
    final route = (approvalId != null && approvalId.isNotEmpty)
        ? '/approvals?id=$approvalId&action=reject'
        : '/approvals';
    rootNavigatorKey.currentContext?.go(route);
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
    final approvalId = (data['approvalId'] ?? data['id'])?.toString();

    if (link != null && link.isNotEmpty && link != '/route-tracker') {
      rootNavigatorKey.currentContext?.go(link);
    } else if (type.contains('approval') || data.containsKey('approvalId') || data['actionable'] == 'true') {
      if (approvalId != null && approvalId.isNotEmpty) {
        rootNavigatorKey.currentContext?.go('/approvals?id=$approvalId');
      } else {
        rootNavigatorKey.currentContext?.go('/approvals');
      }
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
