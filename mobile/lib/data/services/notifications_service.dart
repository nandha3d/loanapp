import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/notification_item.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class NotificationsService {
  NotificationsService(this._dio);
  final Dio _dio;

  Future<List<NotificationItem>> fetchNotifications({
    bool unreadOnly = false,
    int page = 1,
    int pageSize = 20,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.notifications,
      queryParameters: {
        'page': page,
        'pageSize': pageSize,
        if (unreadOnly) 'unreadOnly': 'true',
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      final map = d as Map<String, dynamic>;
      final list = map['data'] as List<dynamic>;
      return list
          .map((dynamic e) => NotificationItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  Future<void> markAllRead() async {
    await _dio.patch<Map<String, dynamic>>(
      Endpoints.notifications,
      data: <String, dynamic>{},
    );
  }

  Future<void> markRead(String id) async {
    await _dio.patch<Map<String, dynamic>>(
      Endpoints.notifications,
      data: {'notificationId': id},
    );
  }
}

final notificationsServiceProvider = Provider<NotificationsService>(
  (ref) => NotificationsService(ref.watch(dioProvider)),
);
