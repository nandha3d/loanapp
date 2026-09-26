import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/notification_item.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class NotificationsService {
  NotificationsService(this._dio);
  final Dio _dio;

  static const int defaultPageSize = 50;

  Future<({List<Map<String, dynamic>> rows, String? nextCursor})> deliveryLog({
    String? channel,
    String? status,
    String? from,
    String? to,
    String? search,
    String? cursor,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.notificationLog,
      queryParameters: {
        'limit': 50,
        if (channel != null) 'channel': channel,
        if (status != null) 'status': status,
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (search != null && search.isNotEmpty) 'search': search,
        if (cursor != null) 'cursor': cursor,
      },
    );
    final rows = unwrapEnvelope(res, (dynamic data) => (data as List<dynamic>)
        .map((dynamic row) => Map<String, dynamic>.from(row as Map))
        .toList(growable: false));
    final next = (res.data?['pagination'] as Map<String, dynamic>?)?['nextCursor'] as String?;
    return (rows: rows, nextCursor: next);
  }

  Future<List<NotificationItem>> fetchNotifications({
    bool unreadOnly = false,
    int page = 1,
    int pageSize = defaultPageSize,
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
