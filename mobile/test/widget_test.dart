import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:loantrack/features/notifications/notifications_screen.dart';

void main() {
  testWidgets('Notifications inbox shows empty state when no items',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: NotificationsScreen()),
    );
    expect(find.text('All caught up!'), findsOneWidget);
  });

  test('NotificationInbox adds and tracks unread', () {
    final inbox = NotificationInbox.instance;
    final before = inbox.unreadCount;
    inbox.add(NotificationItem(
      title: 'test',
      body: 'b',
      type: 'info',
      timestamp: DateTime.now(),
    ));
    expect(inbox.unreadCount, before + 1);
    inbox.markAllRead();
    expect(inbox.unreadCount, 0);
  });
}
