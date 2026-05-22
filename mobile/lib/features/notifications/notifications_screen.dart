import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

/// Lightweight in-memory inbox seeded by [FcmService] (foreground messages).
/// The server has no `/notifications` endpoint in the spec, so this screen
/// renders whatever the device has received this session.
class NotificationItem {
  NotificationItem({
    required this.title,
    required this.body,
    required this.type,
    required this.timestamp,
    this.read = false,
  });
  final String title;
  final String body;
  final String type;
  final DateTime timestamp;
  bool read;
}

class NotificationInbox {
  NotificationInbox._();
  static final NotificationInbox instance = NotificationInbox._();
  final List<NotificationItem> _items = [];
  final ValueNotifier<int> changes = ValueNotifier<int>(0);

  List<NotificationItem> get items => List.unmodifiable(_items);
  int get unreadCount => _items.where((i) => !i.read).length;

  void add(NotificationItem item) {
    _items.insert(0, item);
    changes.value++;
  }

  void markAllRead() {
    for (final i in _items) {
      i.read = true;
    }
    changes.value++;
  }
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: NotificationInbox.instance.changes,
      builder: (context, _, __) {
        final items = NotificationInbox.instance.items;
        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            title: const Text('Notifications'),
            centerTitle: true,
            actions: [
              TextButton(
                onPressed: () => NotificationInbox.instance.markAllRead(),
                child: Text(
                  'Mark all read',
                  style: AppTypography.body
                      .copyWith(color: AppColors.primaryDark),
                ),
              ),
            ],
          ),
          body: items.isEmpty
              ? const EmptyState(
                  icon: Icons.notifications_none_outlined,
                  title: 'All caught up!',
                  subtitle: 'You have no new notifications.',
                )
              : _buildGrouped(items),
        );
      },
    );
  }

  Widget _buildGrouped(List<NotificationItem> items) {
    final today = <NotificationItem>[];
    final yesterday = <NotificationItem>[];
    final earlier = <NotificationItem>[];
    final now = DateTime.now();
    final startToday = DateTime(now.year, now.month, now.day);
    final startYesterday = startToday.subtract(const Duration(days: 1));
    for (final i in items) {
      if (!i.timestamp.isBefore(startToday)) {
        today.add(i);
      } else if (!i.timestamp.isBefore(startYesterday)) {
        yesterday.add(i);
      } else {
        earlier.add(i);
      }
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 24),
      children: [
        if (today.isNotEmpty) ..._group('TODAY', today),
        if (yesterday.isNotEmpty) ..._group('YESTERDAY', yesterday),
        if (earlier.isNotEmpty) ..._group('EARLIER', earlier),
      ],
    );
  }

  Iterable<Widget> _group(String title, List<NotificationItem> items) sync* {
    yield Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      child: Text(
        title,
        style: AppTypography.extraTiny.copyWith(
          color: AppColors.textLight,
          fontWeight: FontWeight.w600,
          letterSpacing: 1,
        ),
      ),
    );
    for (final n in items) {
      yield _Tile(item: n);
    }
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.item});
  final NotificationItem item;

  @override
  Widget build(BuildContext context) {
    final iconBg = switch (item.type) {
      'overdue' || 'penalty' => AppColors.dangerBg,
      'paid' || 'collection' => AppColors.successBg,
      _ => AppColors.primaryLight,
    };
    final iconColor = switch (item.type) {
      'overdue' || 'penalty' => AppColors.danger,
      'paid' || 'collection' => AppColors.success,
      _ => AppColors.primaryDark,
    };
    final icon = switch (item.type) {
      'overdue' => Icons.warning_amber_outlined,
      'paid' => Icons.check_circle_outline,
      'approval' => Icons.fact_check_outlined,
      'penalty' => Icons.gpp_bad_outlined,
      _ => Icons.notifications_outlined,
    };
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius - 2),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title, style: AppTypography.bodyLarge),
                const SizedBox(height: 2),
                Text(
                  item.body,
                  style: AppTypography.bodySmall
                      .copyWith(color: AppColors.textSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  _relative(item.timestamp),
                  style: AppTypography.extraTiny,
                ),
              ],
            ),
          ),
          if (!item.read)
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6, left: 6),
              decoration: const BoxDecoration(
                color: AppColors.info,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
    );
  }

  String _relative(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return DateFormat('MMM d, HH:mm').format(t);
  }
}
