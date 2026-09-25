import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zolofund/data/models/notification_item.dart';
import 'package:zolofund/data/services/notifications_service.dart';

class _MockNotificationAdapter implements HttpClientAdapter {
  _MockNotificationAdapter({required this.totalItems});

  final int totalItems;
  final List<String> requestedQueries = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requestedQueries.add(options.queryParameters.toString());

    final page = (options.queryParameters['page'] as int?) ?? 1;
    final pageSize = (options.queryParameters['pageSize'] as int?) ??
        NotificationsService.defaultPageSize;

    final startIndex = (page - 1) * pageSize;
    final items = <Map<String, dynamic>>[];

    for (var i = startIndex; i < startIndex + pageSize && i < totalItems; i++) {
      final index1Based = i + 1;
      items.add({
        'id': 'notif_$index1Based',
        'type': 'alert',
        'title': 'Notification $index1Based',
        'message': 'Message for notification $index1Based',
        'isRead': i % 2 == 0,
        'createdAt': DateTime.utc(2026, 6, 1)
            .add(Duration(minutes: i))
            .toIso8601String(),
      });
    }

    final payload = {
      'data': {
        'data': items,
        'total': totalItems,
      },
      'error': null,
    };

    return ResponseBody.fromString(
      jsonEncode(payload),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('Notification Pagination Contract & Deduplication', () {
    test(
        '125 notifications pagination with uniform pageSize 50 yields exactly 125 unique items and 0 duplicates',
        () async {
      const totalCount = 125;
      const pageSize = NotificationsService.defaultPageSize;
      expect(pageSize, equals(50),
          reason: 'Service defaultPageSize must be 50');

      final adapter = _MockNotificationAdapter(totalItems: totalCount);
      final dio = Dio()..httpClientAdapter = adapter;
      final service = NotificationsService(dio);

      // Page 1: 1–50
      final page1Items =
          await service.fetchNotifications(page: 1, pageSize: pageSize);
      expect(page1Items.length, equals(50));
      expect(page1Items.first.id, equals('notif_1'));
      expect(page1Items.last.id, equals('notif_50'));

      // Page 2: 51–100
      final page2Items =
          await service.fetchNotifications(page: 2, pageSize: pageSize);
      expect(page2Items.length, equals(50));
      expect(page2Items.first.id, equals('notif_51'));
      expect(page2Items.last.id, equals('notif_100'));

      // Page 3: 101–125
      final page3Items =
          await service.fetchNotifications(page: 3, pageSize: pageSize);
      expect(page3Items.length, equals(25));
      expect(page3Items.first.id, equals('notif_101'));
      expect(page3Items.last.id, equals('notif_125'));

      // Simulate notifications_screen.dart accumulation & defensive seen.add deduplication:
      final baseItems = page1Items;
      final extraItems = <NotificationItem>[...page2Items, ...page3Items];

      final seen = <String>{};
      final combinedItems = [
        ...baseItems,
        ...extraItems,
      ].where((item) => seen.add(item.id)).toList();

      expect(combinedItems.length, equals(125));
      final uniqueIds = combinedItems.map((e) => e.id).toSet();
      expect(uniqueIds.length, equals(125),
          reason: 'Total items must be 125 with 0 duplicates');

      // Verify hasMore progression
      bool hasMore = page1Items.length >= pageSize; // true (50 >= 50)
      expect(hasMore, isTrue);

      if (page2Items.length < pageSize) hasMore = false;
      expect(hasMore, isTrue); // true (50 >= 50)

      if (page3Items.length < pageSize) hasMore = false;
      expect(hasMore, isFalse); // false (25 < 50)
    });

    test(
        'Defensive seen.add deduplication discards overlapping records if inconsistent page sizes are sent',
        () async {
      // Simulate buggy scenario where initial was 100 items (1–100)
      // and load-more used page 2 with size 50 (skip 50 -> 51–100)
      final initial100 = List.generate(
        100,
        (i) => NotificationItem(
          id: 'notif_${i + 1}',
          type: 'alert',
          title: 'Notification ${i + 1}',
          message: 'Message ${i + 1}',
          isRead: false,
          createdAt: DateTime.utc(2026, 6, 1).add(Duration(minutes: i)),
        ),
      );

      final overlapping50 = List.generate(
        50,
        (i) => NotificationItem(
          id: 'notif_${i + 51}', // notif_51 to notif_100
          type: 'alert',
          title: 'Notification ${i + 51}',
          message: 'Message ${i + 51}',
          isRead: false,
          createdAt: DateTime.utc(2026, 6, 1).add(Duration(minutes: i + 50)),
        ),
      );

      final seen = <String>{};
      final deduplicated = [
        ...initial100,
        ...overlapping50,
      ].where((item) => seen.add(item.id)).toList();

      expect(deduplicated.length, equals(100),
          reason:
              'seen.add must filter out all 50 duplicate items from overlapping page');
    });
  });
}
