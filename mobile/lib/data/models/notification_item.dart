import 'package:zolofund/core/notifications/notification_text.dart';

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.message,
    required this.isRead,
    required this.createdAt,
    this.icon,
    this.title,
    this.link,
    this.titleKey,
    this.messageKey,
    this.params,
    this.approvalId,
    this.approvalStatus,
    this.canAct = false,
  });

  final String id;
  final String type;
  final String? icon;
  final String? title;
  final String message;
  final String? link;
  final bool isRead;
  final DateTime createdAt;

  /// i18n key + server-formatted params; null on legacy rows.
  final String? titleKey;
  final String? messageKey;
  final Map<String, dynamic>? params;

  /// Server-resolved approval state: the target id, `pending` / `handled`, and
  /// whether THIS viewer may Approve/Reject right now. The app only renders it.
  final String? approvalId;
  final String? approvalStatus;
  final bool canAct;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: (json['id'] as String?) ?? '',
      type: (json['type'] as String?) ?? 'system',
      icon: json['icon'] as String?,
      title: json['title'] as String?,
      message: (json['message'] as String?) ?? '',
      link: json['link'] as String?,
      isRead: (json['isRead'] as bool?) ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)?.toLocal() ?? DateTime.now()
          : DateTime.now(),
      titleKey: json['titleKey'] as String?,
      messageKey: json['messageKey'] as String?,
      params: decodeNotificationParams(json['params']),
      approvalId: json['approvalId'] as String?,
      approvalStatus: json['approvalStatus'] as String?,
      canAct: (json['canAct'] as bool?) ?? false,
    );
  }

  NotificationItem copyWith({bool? isRead}) {
    return NotificationItem(
      id: id,
      type: type,
      icon: icon,
      title: title,
      message: message,
      link: link,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
      titleKey: titleKey,
      messageKey: messageKey,
      params: params,
      approvalId: approvalId,
      approvalStatus: approvalStatus,
      canAct: canAct,
    );
  }
}
