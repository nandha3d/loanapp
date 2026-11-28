import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/local/chit_offline_cache.dart';
import 'package:zolofund/data/local/chit_payment_queue.dart';
import 'package:zolofund/data/local/offline_queue.dart';

class ChitOfflineQueueScreen extends ConsumerStatefulWidget {
  const ChitOfflineQueueScreen({super.key});

  @override
  ConsumerState<ChitOfflineQueueScreen> createState() =>
      _ChitOfflineQueueScreenState();
}

class _ChitOfflineQueueScreenState
    extends ConsumerState<ChitOfflineQueueScreen> {
  String _filter = 'ALL';
  bool _syncing = false;
  DateTime? _lastSyncedAt;
  List<QueuedMutation> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final queue = ref.read(chitPaymentQueueProvider);
    final items = await queue.all();
    final syncedAt = await ChitOfflineCache().lastSyncedAt();
    await ref.read(chitPaymentSyncProvider.notifier).refresh();
    if (mounted) {
      setState(() {
        _items = items;
        _lastSyncedAt = syncedAt;
      });
    }
  }

  Future<void> _syncAll() async {
    setState(() => _syncing = true);
    await ref.read(chitPaymentSyncProvider.notifier).sync();
    await _load();
    if (mounted) setState(() => _syncing = false);
  }

  @override
  Widget build(BuildContext context) {
    final syncState = ref.watch(chitPaymentSyncProvider);
    final filtered = _filter == 'ALL'
        ? _items
        : _items
            .where((m) => m.status.toUpperCase() == _filter)
            .toList(growable: false);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Offline Collection Queue'),
        actions: [
          TextButton.icon(
            onPressed: _syncing ? null : _syncAll,
            icon: _syncing
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.sync),
            label: const Text('Sync Now'),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: AppColors.surface,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  syncState.online ? '🟢 Online' : '🟠 Offline Mode',
                  style: AppTypography.caption
                      .copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  _lastSyncedAt == null
                      ? 'Cache: not synced yet'
                      : 'Last sync: ${DateFormat('dd MMM HH:mm').format(_lastSyncedAt!.toLocal())}',
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                for (final st in const [
                  'ALL',
                  'PENDING',
                  'CONFLICT',
                  'FAILED',
                  'SYNCED',
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(st),
                      selected: _filter == st,
                      onSelected: (_) => setState(() => _filter = st),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Text(
                      'No offline chit collections in $_filter',
                      style: AppTypography.caption,
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: filtered.length,
                    itemBuilder: (_, idx) {
                      final m = filtered[idx];
                      final p = m.payload;
                      final statusColor = switch (m.status) {
                        'synced' => AppColors.success,
                        'conflict' => Colors.deepOrange,
                        'failed' => AppColors.danger,
                        _ => AppColors.info,
                      };
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: ListTile(
                          title: Text(
                            '₹${p['amount']} · Cycle #${p['periodNumber']} (${p['paymentMode']})',
                            style: AppTypography.body
                                .copyWith(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${p['memberName'] ?? p['memberId']} · ${p['collectedAtLocal'] ?? ''}',
                                style: AppTypography.caption,
                              ),
                              if (m.failureReason != null &&
                                  m.failureReason!.isNotEmpty)
                                Text(
                                  m.failureReason!,
                                  style: AppTypography.caption
                                      .copyWith(color: statusColor),
                                ),
                            ],
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3,),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  m.status.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: statusColor,
                                  ),
                                ),
                              ),
                              if (m.status == 'failed' ||
                                  m.status == 'conflict')
                                IconButton(
                                  icon: const Icon(Icons.refresh, size: 20),
                                  tooltip: 'Retry',
                                  onPressed: () async {
                                    await ref
                                        .read(chitPaymentQueueProvider)
                                        .retryItem(m.id);
                                    await _syncAll();
                                  },
                                ),
                              if (m.status != 'synced')
                                IconButton(
                                  icon: const Icon(Icons.delete_outline,
                                      size: 20,),
                                  tooltip: 'Discard',
                                  onPressed: () async {
                                    await ref
                                        .read(chitPaymentQueueProvider)
                                        .remove(m.id);
                                    await _load();
                                  },
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
