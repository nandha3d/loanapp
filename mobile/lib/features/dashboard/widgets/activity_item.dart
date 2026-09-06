import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';

class ActivityItem extends StatelessWidget {
  const ActivityItem({
    super.key,
    required this.text,
    required this.timestamp,
  });

  final String text;
  final DateTime timestamp;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6, right: 12),
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text, style: AppTypography.bodySmall),
                const SizedBox(height: 2),
                Text(
                  _ago(timestamp),
                  style: AppTypography.extraTiny,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _ago(DateTime then) {
    final diff = DateTime.now().difference(then);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('dd MMM').format(then);
  }
}
