import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:zolofund/data/models/announcement.dart';
import 'package:zolofund/data/services/announcements_service.dart';

class AnnouncementPopupDialog extends ConsumerStatefulWidget {
  final Announcement announcement;
  final VoidCallback? onDismissed;

  const AnnouncementPopupDialog({
    super.key,
    required this.announcement,
    this.onDismissed,
  });

  static Future<void> show(
    BuildContext context,
    Announcement announcement, {
    VoidCallback? onDismissed,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AnnouncementPopupDialog(
        announcement: announcement,
        onDismissed: onDismissed,
      ),
    );
  }

  @override
  ConsumerState<AnnouncementPopupDialog> createState() =>
      _AnnouncementPopupDialogState();
}

class _AnnouncementPopupDialogState
    extends ConsumerState<AnnouncementPopupDialog> {
  bool _submitting = false;

  Color _getHeaderColor() {
    switch (widget.announcement.type) {
      case 'critical':
        return const Color(0xFFDC2626);
      case 'warning':
        return const Color(0xFFD97706);
      case 'update':
        return const Color(0xFF4F46E5);
      case 'celebration':
        return const Color(0xFF9333EA);
      default:
        return const Color(0xFF7D287E); // Zolo Brand Purple
    }
  }

  IconData _getIcon() {
    switch (widget.announcement.type) {
      case 'critical':
        return Icons.error_outline_rounded;
      case 'warning':
        return Icons.warning_amber_rounded;
      case 'update':
        return Icons.rocket_launch_rounded;
      case 'celebration':
        return Icons.celebration_rounded;
      default:
        return Icons.campaign_rounded;
    }
  }

  Future<void> _handleAcknowledge() async {
    setState(() => _submitting = true);
    try {
      await ref
          .read(announcementsServiceProvider)
          .dismissAnnouncement(widget.announcement.id);
      widget.onDismissed?.call();
    } finally {
      if (mounted) {
        Navigator.of(context).pop();
      }
    }
  }

  Future<void> _handleAction() async {
    final url = widget.announcement.actionUrl;
    if (url != null && url.isNotEmpty) {
      final uri = Uri.tryParse(url);
      if (uri != null && await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final headerColor = _getHeaderColor();
    final a = widget.announcement;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      clipBehavior: Clip.antiAlias,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              color: headerColor,
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(_getIcon(), color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          a.type.toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.1,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          a.title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Message Body
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      a.message,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.55,
                        color: Color(0xFF374151),
                      ),
                    ),
                    if (a.actionLabel != null && a.actionUrl != null) ...[
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: _handleAction,
                        icon: const Icon(Icons.open_in_new, size: 16),
                        label: Text(a.actionLabel!),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: headerColor,
                          side: BorderSide(color: headerColor),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // Footer Actions
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: Color(0xFFF9FAFB),
                border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  ElevatedButton.icon(
                    onPressed: _submitting ? null : _handleAcknowledge,
                    icon: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.check, size: 18),
                    label: Text(_submitting ? 'Acknowledging...' : 'Acknowledge'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: headerColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
