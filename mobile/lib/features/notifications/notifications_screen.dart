import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/network/authed_image.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/notification_item.dart';
import 'package:zolofund/data/services/approval_service.dart';
import 'package:zolofund/data/services/notifications_service.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

const int _pageSize = 50;

final _notificationsProvider =
    FutureProvider.autoDispose<List<NotificationItem>>((ref) {
  return ref
      .watch(notificationsServiceProvider)
      .fetchNotifications(page: 1, pageSize: _pageSize);
});

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _markingAll = false;
  int _page = 1;
  final List<NotificationItem> _extraItems = [];
  bool _hasMore = true;
  bool _loadingMore = false;

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);
    try {
      final nextPage = _page + 1;
      final results = await ref
          .read(notificationsServiceProvider)
          .fetchNotifications(page: nextPage, pageSize: _pageSize);
      if (results.length < _pageSize) {
        _hasMore = false;
      }
      _extraItems.addAll(results);
      _page = nextPage;
    } catch (_) {
      // Keep _hasMore true to allow retry
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _markAllRead() async {
    setState(() => _markingAll = true);
    try {
      await ref.read(notificationsServiceProvider).markAllRead();
      _page = 1;
      _extraItems.clear();
      _hasMore = true;
      ref.invalidate(_notificationsProvider);
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  Future<void> _markOneRead(NotificationItem item) async {
    if (item.isRead) return;
    await ref
        .read(notificationsServiceProvider)
        .markRead(item.id)
        .catchError((_) {});
    ref.invalidate(_notificationsProvider);
  }

  Future<void> _handleReply(NotificationItem item) async {
    if (item.link != null && item.link!.isNotEmpty) {
      await _markOneRead(item);
      if (mounted) context.push(item.link!);
      return;
    }
    _showReplyBottomSheet(item);
  }

  void _showReplyBottomSheet(NotificationItem item) {
    final t = T.of(ref);
    final controller = TextEditingController();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: AppColors.primary.withAlpha(25),
                    child:
                        Icon(Icons.reply, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${t.x('notif.action_reply')} — ${item.title ?? 'Alert'}',
                          style: AppTypography.bodyLarge
                              .copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          item.message,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                autofocus: true,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: '${t.x('notif.action_reply')}...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTokens.radius),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  filled: true,
                  fillColor: AppColors.background,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text(t.x('common.cancel')),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.send, size: 16),
                    label: Text(t.x('notif.action_reply')),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _markOneRead(item);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(t.x('notif.reply_sent')),
                          backgroundColor: AppColors.success,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _handleMute(NotificationItem item) async {
    final t = T.of(ref);
    await _markOneRead(item);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(t.x('notif.muted')),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String? _extractApprovalId(NotificationItem item) {
    if (item.link != null) {
      final uri = Uri.tryParse(item.link!);
      if (uri != null) {
        final qId = uri.queryParameters['id'];
        if (qId != null && qId.isNotEmpty) return qId;
        if (uri.pathSegments.isNotEmpty &&
            (uri.pathSegments.first == 'approvals' ||
                uri.pathSegments.contains('approvals'))) {
          final idx = uri.pathSegments.indexOf('approvals');
          if (idx + 1 < uri.pathSegments.length) {
            final seg = uri.pathSegments[idx + 1];
            if (seg.isNotEmpty && seg != 'approve' && seg != 'reject')
              return seg;
          }
        }
      }
    }
    return null;
  }

  Future<void> _handleApprove(NotificationItem item) async {
    final t = T.of(ref);
    final approvalId = _extractApprovalId(item);

    if (approvalId != null && approvalId.isNotEmpty) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppTokens.radius)),
          title: Text(t.x('appr.approve_request')),
          content: Text(item.message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(t.x('common.cancel')),
            ),
            ElevatedButton(
              style:
                  ElevatedButton.styleFrom(backgroundColor: AppColors.success),
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(t.x('btn.approve'),
                  style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
      if (ok != true) return;

      try {
        await ref.read(approvalServiceProvider).approve(approvalId);
        await _markOneRead(item);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(t.x('notif.approved_toast')),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.toString()),
              backgroundColor: AppColors.danger,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } else {
      await _markOneRead(item);
      if (mounted) context.push('/approvals');
    }
  }

  Future<void> _handleReject(NotificationItem item) async {
    final t = T.of(ref);
    final approvalId = _extractApprovalId(item);

    if (approvalId != null && approvalId.isNotEmpty) {
      final noteCtrl = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppTokens.radius)),
          title: Text(t.x('appr.reject_request')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.message, style: AppTypography.body),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                decoration: InputDecoration(
                  labelText: t.x('notif.confirm_reject_prompt'),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
                ),
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(t.x('common.cancel')),
            ),
            ElevatedButton(
              style:
                  ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(t.x('btn.reject'),
                  style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
      if (ok != true) return;

      try {
        await ref
            .read(approvalServiceProvider)
            .reject(approvalId, note: noteCtrl.text.trim());
        await _markOneRead(item);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(t.x('notif.rejected_toast')),
              backgroundColor: AppColors.danger,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.toString()),
              backgroundColor: AppColors.danger,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } else {
      await _markOneRead(item);
      if (mounted) context.push('/approvals');
    }
  }

  void _handleShowOnMap(NotificationItem item) {
    _markOneRead(item);
    context.push('/admin/tracking');
  }

  void _handleTopUpFloat(NotificationItem item) {
    _markOneRead(item);
    context.push('/wallet');
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
        actions: [
          if (_markingAll)
            Padding(
              padding: const EdgeInsets.only(right: 16),
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
                const Icon(Icons.cloud_off,
                    size: 48, color: AppColors.textLight),
                const SizedBox(height: 12),
                Text(t.x('err.failed_to_load'),
                    style: AppTypography.sectionTitle),
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
        data: (baseItems) {
          final seen = <String>{};
          final items = [
            ...baseItems,
            ..._extraItems,
          ].where((item) => seen.add(item.id)).toList();
          final hasMore = _hasMore && (baseItems.length >= _pageSize);
          if (items.isEmpty) {
            return EmptyState(
              icon: Icons.notifications_none_outlined,
              title: t.x('notif.allCaughtUp'),
              subtitle: t.x('notif.noNotifications'),
            );
          }

          final now = DateTime.now();
          final todayStart = DateTime(now.year, now.month, now.day);
          final today =
              items.where((n) => n.createdAt.isAfter(todayStart)).toList();
          final earlier =
              items.where((n) => !n.createdAt.isAfter(todayStart)).toList();

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              setState(() {
                _page = 1;
                _extraItems.clear();
                _hasMore = true;
              });
              ref.invalidate(_notificationsProvider);
            },
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                if (today.isNotEmpty) ...[
                  _SectionHeader(label: t.x('notif.today')),
                  ...today.map(
                    (n) => _NotificationTile(
                      item: n,
                      onTap: () => _markOneRead(n),
                      onMarkRead: () => _markOneRead(n),
                      onReply: () => _handleReply(n),
                      onMute: () => _handleMute(n),
                      onApprove: () => _handleApprove(n),
                      onReject: () => _handleReject(n),
                      onShowOnMap: () => _handleShowOnMap(n),
                      onTopUpFloat: () => _handleTopUpFloat(n),
                    ),
                  ),
                ],
                if (earlier.isNotEmpty) ...[
                  _SectionHeader(label: t.x('notif.earlier')),
                  ...earlier.map(
                    (n) => _NotificationTile(
                      item: n,
                      onTap: () => _markOneRead(n),
                      onMarkRead: () => _markOneRead(n),
                      onReply: () => _handleReply(n),
                      onMute: () => _handleMute(n),
                      onApprove: () => _handleApprove(n),
                      onReject: () => _handleReject(n),
                      onShowOnMap: () => _handleShowOnMap(n),
                      onTopUpFloat: () => _handleTopUpFloat(n),
                    ),
                  ),
                ],
                if (hasMore)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: _loadingMore
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : TextButton.icon(
                              icon: const Icon(Icons.expand_more, size: 18),
                              label: Text(
                                t.x('notif.load_more'),
                                style: AppTypography.label
                                    .copyWith(color: AppColors.primary),
                              ),
                              onPressed: _loadMore,
                            ),
                    ),
                  ),
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
  const _NotificationTile({
    required this.item,
    required this.onTap,
    required this.onMarkRead,
    required this.onReply,
    required this.onMute,
    this.onApprove,
    this.onReject,
    this.onShowOnMap,
    this.onTopUpFloat,
  });

  final NotificationItem item;
  final VoidCallback onTap;
  final VoidCallback onMarkRead;
  final VoidCallback onReply;
  final VoidCallback onMute;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;
  final VoidCallback? onShowOnMap;
  final VoidCallback? onTopUpFloat;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final (iconData, iconColor, iconBg) = _iconForType(item.type);
    final relTime = _relativeTime(item.createdAt, t);

    final isApproval = item.type.contains('approval') ||
        (item.title != null &&
            item.title!.toLowerCase().contains('approval')) ||
        (item.link != null && item.link!.contains('approvals'));
    final isCollection = item.type == 'collection_received' ||
        item.type == 'payment' ||
        item.type.contains('collect') ||
        (item.link != null && item.link!.contains('route-tracker'));
    final isFloatInsufficient = item.type == 'float_insufficient' ||
        item.type.contains('float') ||
        (item.title != null && item.title!.toLowerCase().contains('float'));

    final hasPhotoUrl = item.icon != null &&
        (item.icon!.startsWith('http') || item.icon!.startsWith('/'));

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: item.isRead ? AppColors.surface : AppColors.primaryLight,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: item.isRead ? AppTokens.shadow : null,
        border: Border.all(
          color: item.isRead
              ? AppColors.border
              : AppColors.primary.withValues(alpha: 0.35),
          width: item.isRead ? 1 : 1.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTokens.radius),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // WhatsApp-style avatar with photo or initials + channel badge
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: iconBg,
                          child: hasPhotoUrl
                              ? ClipOval(
                                  child: Image(
                                    image: authedImage(ref, item.icon!),
                                    width: 44,
                                    height: 44,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Icon(
                                      iconData,
                                      color: iconColor,
                                      size: 20,
                                    ),
                                  ),
                                )
                              : Text(
                                  (item.title != null && item.title!.isNotEmpty)
                                      ? item.title![0].toUpperCase()
                                      : 'Z',
                                  style: TextStyle(
                                    color: iconColor,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                  ),
                                ),
                        ),
                        Positioned(
                          right: -2,
                          bottom: -2,
                          child: Container(
                            padding: const EdgeInsets.all(2.5),
                            decoration: const BoxDecoration(
                              color: AppColors.surface,
                              shape: BoxShape.circle,
                            ),
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: BoxDecoration(
                                color: iconColor,
                                shape: BoxShape.circle,
                              ),
                              child:
                                  Icon(iconData, color: Colors.white, size: 9),
                            ),
                          ),
                        ),
                      ],
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
                                        ? FontWeight.w600
                                        : FontWeight.w800,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                relTime,
                                style: AppTypography.extraTiny.copyWith(
                                  color: AppColors.textLight,
                                ),
                              ),
                              if (!item.isRead) ...[
                                const SizedBox(width: 6),
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
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
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // WhatsApp-Style Action Bar: Content-Relevant Dynamic Buttons
                Container(
                  padding: const EdgeInsets.only(top: 8),
                  decoration: const BoxDecoration(
                    border: Border(
                      top: BorderSide(color: AppColors.border, width: 0.8),
                    ),
                  ),
                  child: Row(
                    children: [
                      if (isApproval) ...[
                        _NotificationActionButton(
                          icon: Icons.check_circle_outline,
                          label: t.x('notif.action_approve'),
                          color: AppColors.success,
                          onPressed: onApprove ?? () {},
                        ),
                        const SizedBox(width: 8),
                        _NotificationActionButton(
                          icon: Icons.highlight_off,
                          label: t.x('notif.action_reject'),
                          color: AppColors.danger,
                          onPressed: onReject ?? () {},
                        ),
                        const SizedBox(width: 8),
                      ] else if (isCollection) ...[
                        _NotificationActionButton(
                          icon: Icons.map_outlined,
                          label: t.x('admin.show_on_map'),
                          color: AppColors.success,
                          onPressed: onShowOnMap ?? () {},
                        ),
                        const SizedBox(width: 8),
                      ] else if (isFloatInsufficient) ...[
                        _NotificationActionButton(
                          icon: Icons.account_balance_wallet_outlined,
                          label: t.x('notif.action_topup_float'),
                          color: const Color(0xFFD97706),
                          onPressed: onTopUpFloat ?? () {},
                        ),
                        const SizedBox(width: 8),
                      ] else ...[
                        _NotificationActionButton(
                          icon: Icons.reply,
                          label: t.x('notif.action_reply'),
                          color: AppColors.primary,
                          onPressed: onReply,
                        ),
                        const SizedBox(width: 8),
                      ],
                      if (!item.isRead) ...[
                        _NotificationActionButton(
                          icon: Icons.done_all,
                          label: t.x('notif.action_mark_read'),
                          color: AppColors.textSecondary,
                          onPressed: onMarkRead,
                        ),
                        const SizedBox(width: 8),
                      ],
                      if (!isApproval && !isCollection && !isFloatInsufficient)
                        _NotificationActionButton(
                          icon: Icons.notifications_off_outlined,
                          label: t.x('notif.action_mute'),
                          color: AppColors.textLight,
                          onPressed: onMute,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  (IconData, Color, Color) _iconForType(String type) {
    if (type.contains('approval')) {
      return (Icons.approval_outlined, AppColors.info, AppColors.infoBg);
    }
    if (type == 'collection_received' || type == 'payment') {
      return (Icons.payments_outlined, AppColors.success, AppColors.successBg);
    }
    if (type == 'float_insufficient') {
      return (
        Icons.warning_amber_rounded,
        const Color(0xFFD97706),
        const Color(0xFFFEF3C7)
      );
    }
    return switch (type) {
      'payment' => (
          Icons.payments_outlined,
          AppColors.success,
          AppColors.successBg
        ),
      'penalty' => (
          Icons.warning_amber_outlined,
          AppColors.warning,
          AppColors.warningBg
        ),
      'approval' => (Icons.approval_outlined, AppColors.info, AppColors.infoBg),
      'new' => (Icons.fiber_new_outlined, AppColors.purple, AppColors.purpleBg),
      _ => (
          Icons.notifications_outlined,
          AppColors.primary,
          AppColors.primaryLight
        ),
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
    final ago = t.x('admin.ago');
    if (diff.inMinutes < 1) return t.x('admin.just_now');
    if (diff.inMinutes < 60) return '${diff.inMinutes}m $ago';
    if (diff.inHours < 24) return '${diff.inHours}h $ago';
    if (diff.inDays < 7) return '${diff.inDays}d $ago';
    return DateFormat('dd MMM yyyy').format(dt);
  }
}

class _NotificationActionButton extends StatelessWidget {
  const _NotificationActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 5),
              Text(
                label,
                style: AppTypography.extraTiny.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
