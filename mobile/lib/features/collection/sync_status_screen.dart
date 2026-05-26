import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/local/collection_queue.dart';
import 'package:loantrack/shared/widgets/app_badge.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

class SyncStatusScreen extends ConsumerStatefulWidget {
  const SyncStatusScreen({super.key});

  @override
  ConsumerState<SyncStatusScreen> createState() => _SyncStatusScreenState();
}

class _SyncStatusScreenState extends ConsumerState<SyncStatusScreen> {
  List<QueuedCollection> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    _items = await ref.read(collectionQueueProvider).all();
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final sync = ref.watch(collectionSyncProvider);
    final t = T.of(ref);

    return Scaffold(
      appBar: AppBar(title: Text(t.x('title.sync_status')), centerTitle: true),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? EmptyState(
                  icon: Icons.cloud_done_outlined,
                  title: t.x('sync.queue_empty'),
                  subtitle: t.x('sync.all_synced'),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _row(_items[i], fmt),
                ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: AppButton(
            label: sync.online
                ? '${t.x('sync.now')} (${sync.pending} ${t.x('sync.pending_suffix')})'
                : t.x('sync.offline_cant'),
            expand: true,
            onPressed: sync.online && sync.pending > 0
                ? () async {
                    await ref.read(collectionSyncProvider.notifier).sync();
                    await _refresh();
                  }
                : null,
          ),
        ),
      ),
    );
  }

  Widget _row(QueuedCollection q, NumberFormat fmt) {
    final kind = switch (q.status) {
      'synced' => BadgeKind.active,
      'failed' => BadgeKind.overdue,
      _ => BadgeKind.pending,
    };
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(q.customerName ?? '—', style: AppTypography.bodyLarge),
                Text(
                  '${q.loanCode ?? ''} • ${q.paymentMode}',
                  style: AppTypography.caption,
                ),
                if (q.failureReason != null)
                  Text(
                    q.failureReason!,
                    style:
                        AppTypography.caption.copyWith(color: AppColors.danger),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmt.format(q.receivedAmount),
                style: AppTypography.bodyLarge,
              ),
              const SizedBox(height: 4),
              AppBadge(label: q.status, kind: kind),
            ],
          ),
        ],
      ),
    );
  }
}
