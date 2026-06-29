import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/local/collection_queue.dart';

/// App-wide connectivity / pending-sync banner. Driven by the existing
/// collection sync state so it needs no new plumbing. Renders nothing when
/// online with nothing pending, so it's safe to drop at the top of any screen.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sync = ref.watch(collectionSyncProvider);
    final t = T.of(ref);

    final offline = !sync.online;
    final pending = sync.pending;
    if (!offline && pending == 0) return const SizedBox.shrink();

    final Color bg;
    final IconData icon;
    final String text;
    if (offline) {
      bg = AppColors.warning;
      icon = Icons.cloud_off_rounded;
      text = pending > 0
          ? '${t.x('offline.banner.offline')} • ${t.x('offline.pending.count')}: $pending'
          : t.x('offline.banner.offline');
    } else {
      bg = AppColors.info;
      icon = Icons.sync_rounded;
      text = '${t.x('offline.banner.syncing')} • ${t.x('offline.pending.count')}: $pending';
    }

    return Container(
      width: double.infinity,
      color: bg.withAlpha(28),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: bg),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: AppTypography.caption.copyWith(color: bg, fontWeight: FontWeight.w600),
            ),
          ),
          if (sync.online && pending > 0)
            TextButton(
              onPressed: () => ref.read(collectionSyncProvider.notifier).sync(),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 28),
              ),
              child: Text(t.x('offline.synced.ok'), style: AppTypography.caption.copyWith(color: bg)),
            ),
        ],
      ),
    );
  }
}
