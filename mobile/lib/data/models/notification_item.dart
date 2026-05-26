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
  });

  final String id;
  final String type;
  final String? icon;
  final String? title;
  final String message;
  final String? link;
  final bool isRead;
  final DateTime createdAt;

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
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
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
    );
  }
}
