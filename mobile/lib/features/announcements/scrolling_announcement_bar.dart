import 'package:flutter/material.dart';
import 'package:zolofund/data/models/announcement.dart';
import 'package:zolofund/features/announcements/announcement_popup_dialog.dart';

class ScrollingAnnouncementBar extends StatefulWidget {
  final List<Announcement> announcements;
  final VoidCallback? onDismissed;

  const ScrollingAnnouncementBar({
    super.key,
    required this.announcements,
    this.onDismissed,
  });

  @override
  State<ScrollingAnnouncementBar> createState() => _ScrollingAnnouncementBarState();
}

class _ScrollingAnnouncementBarState extends State<ScrollingAnnouncementBar> {
  int _currentIndex = 0;
  bool _dismissed = false;

  Color _getBgColor(String type) {
    switch (type) {
      case 'critical':
        return const Color(0xFFDC2626);
      case 'warning':
        return const Color(0xFFD97706);
      case 'update':
        return const Color(0xFF4F46E5);
      case 'celebration':
        return const Color(0xFF701A75);
      default:
        return const Color(0xFF7D287E);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_dismissed || widget.announcements.isEmpty) {
      return const SizedBox.shrink();
    }

    final current = widget.announcements[_currentIndex % widget.announcements.length];
    final bgColor = _getBgColor(current.type);

    return Material(
      color: bgColor,
      child: InkWell(
        onTap: () {
          AnnouncementPopupDialog.show(
            context,
            current,
            onDismissed: () {
              setState(() => _dismissed = true);
              widget.onDismissed?.call();
            },
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  current.type.toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${current.title}: ${current.message}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (widget.announcements.length > 1) ...[
                GestureDetector(
                  onTap: () => setState(() => _currentIndex = (_currentIndex + 1) % widget.announcements.length),
                  child: const Icon(Icons.skip_next, color: Colors.white70, size: 16),
                ),
                const SizedBox(width: 4),
              ],
              const Icon(Icons.chevron_right, color: Colors.white70, size: 16),
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () => setState(() => _dismissed = true),
                child: const Icon(Icons.close, color: Colors.white70, size: 16),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
