import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/notification_item.dart';
import 'package:loantrack/data/services/notifications_service.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

final _notificationsProvider =
    FutureProvider.autoDispose<List<NotificationItem>>((ref) {
  return ref.watch(notificationsServiceProvider).fetchNotifications();
});

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _markingAll = false;

  Future<void> _markAllRead() async {
    setState(() => _markingAll = true);
    try {
      await ref.read(notificationsServiceProvider).markAllRead();
      ref.invalidate(_notificationsProvider);
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  Future<void> _markOneRead(NotificationItem item) async {
    if (item.isRead) return;
    await ref.read(notificationsServiceProvider).markRead(item.id).catchError((_) {});
    ref.invalidate(_notificationsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_notificationsProvider);
    final t = T.of(ref);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('notif.title')),
        centerTitle: true,
        actions: [
          if (_markingAll)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.primary,
                ),
              ),
            )
          else
            TextButton(
              onPressed: _markAllRead,
              child: Text(
                t.x('notif.markAllRead'),
                style: AppTypography.label.copyWith(color: AppColors.primary),
              ),
            ),
        ],
      ),
      body: async.when(
        loading: () => const _LoadingState(),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 48, color: AppColors.textLight),
                const SizedBox(height: 12),
                Text(t.x('err.failed_to_load'), style: AppTypography.sectionTitle),
                const SizedBox(height: 6),
                Text(
                  e.toString(),
                  style: AppTypography.body,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  icon: const Icon(Icons.refresh, size: 16),
                  label: Text(t.x('common.retry')),
                  onPressed: () => ref.invalidate(_notificationsProvider),
                ),
              ],
            ),
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              icon: Icons.notifications_none_outlined,
              title: t.x('notif.allCaughtUp'),
              subtitle: t.x('notif.noNotifications'),
            );
          }

          final now = DateTime.now();
          final todayStart = DateTime(now.year, now.month, now.day);
          final today = items.where((n) => n.createdAt.isAfter(todayStart)).toList();
          final earlier = items.where((n) => !n.createdAt.isAfter(todayStart)).toList();

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(_notificationsProvider),
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                if (today.isNotEmpty) ...[
                  _SectionHeader(label: t.x('notif.today')),
                  ...today.map(
                    (n) => _NotificationTile(
                      item: n,
                      onTap: () => _markOneRead(n),
                    ),
                  ),
                ],
                if (earlier.isNotEmpty) ...[
                  _SectionHeader(label: t.x('notif.earlier')),
                  ...earlier.map(
                    (n) => _NotificationTile(
                      item: n,
                      onTap: () => _markOneRead(n),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/notifications'),
    );
  }
}

// ── Section header ─────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      child: Text(label, style: AppTypography.sectionTitle),
    );
  }
}

// ── Notification tile ───────────────────────────────────────────────────────

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.item, required this.onTap});
  final NotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final (iconData, iconColor, iconBg) = _iconForType(item.type);
    final relTime = _relativeTime(item.createdAt, t);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        decoration: BoxDecoration(
          color: item.isRead ? AppColors.surface : AppColors.primaryLight,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          boxShadow: item.isRead ? AppTokens.shadow : null,
          border: item.isRead
              ? null
              : Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon badge
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(AppTokens.radiusKpiIcon),
                ),
                child: Icon(iconData, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title ?? _typeLabel(ref, item.type),
                            style: AppTypography.bodyLarge.copyWith(
                              fontWeight: item.isRead
                                  ? FontWeight.normal
                                  : FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (!item.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.message,
                      style: AppTypography.body.copyWith(
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(relTime, style: AppTypography.caption),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  (IconData, Color, Color) _iconForType(String type) {
    return switch (type) {
      'payment' => (Icons.payments_outlined, AppColors.success, AppColors.successBg),
      'penalty' => (Icons.warning_amber_outlined, AppColors.warning, AppColors.warningBg),
      'approval' => (Icons.approval_outlined, AppColors.info, AppColors.infoBg),
      'new' => (Icons.fiber_new_outlined, AppColors.purple, AppColors.purpleBg),
      _ => (Icons.notifications_outlined, AppColors.primary, AppColors.primaryLight),
    };
  }

  String _typeLabel(WidgetRef ref, String type) {
    final t = T.of(ref);
    return switch (type) {
      'payment' => t.x('notif.payment'),
      'penalty' => t.x('notif.penalty'),
      'approval' => t.x('notif.approval'),
      'new' => t.x('notif.new'),
      _ => t.x('notif.system'),
    };
  }

  String _relativeTime(DateTime dt, T t) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    final ago = t.x('time.ago');
    if (diff.inMinutes < 1) return t.x('time.just_now');
    if (diff.inMinutes < 60) return '${diff.inMinutes}m $ago';
    if (diff.inHours < 24) return '${diff.inHours}h $ago';
    if (diff.inDays < 7) return '${diff.inDays}d $ago';
    return DateFormat('dd MMM yyyy').format(dt);
  }
}

// ── Loading skeleton ────────────────────────────────────────────────────────

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: List.generate(
          6,
          (_) => const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Skeleton(height: 80, borderRadius: AppTokens.radius),
          ),
        ),
      );
}
