class Announcement {
  final String id;
  final String title;
  final String message;
  final String type;
  final String priority;
  final bool isScrollingBar;
  final bool isPopup;
  final String? actionLabel;
  final String? actionUrl;
  final bool isRead;
  final DateTime? createdAt;

  const Announcement({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.priority,
    required this.isScrollingBar,
    required this.isPopup,
    this.actionLabel,
    this.actionUrl,
    this.isRead = false,
    this.createdAt,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      type: json['type'] as String? ?? 'info',
      priority: json['priority'] as String? ?? 'normal',
      isScrollingBar: json['isScrollingBar'] as bool? ?? false,
      isPopup: json['isPopup'] as bool? ?? false,
      actionLabel: json['actionLabel'] as String?,
      actionUrl: json['actionUrl'] as String?,
      isRead: json['isRead'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'message': message,
      'type': type,
      'priority': priority,
      'isScrollingBar': isScrollingBar,
      'isPopup': isPopup,
      'actionLabel': actionLabel,
      'actionUrl': actionUrl,
      'isRead': isRead,
      'createdAt': createdAt?.toIso8601String(),
    };
  }
}
