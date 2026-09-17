import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/data/local/offline_queue.dart';
import 'package:zolofund/data/services/chit_service.dart';

const _boxName = 'chit_payment_queue';
const _mutationType = 'chit.payment';

String chitPaymentIdempotencyKey({
  required String groupId,
  required String memberId,
  required int periodNumber,
  required double amount,
}) {
  final today = DateTime.now();
  final date =
      '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
  return 'chit:$date:$groupId:$memberId:$periodNumber:${amount.toStringAsFixed(2)}';
}

QueuedMutation queuedChitPayment({
  required String idempotencyKey,
  required String groupId,
  required String memberId,
  required int periodNumber,
  required double amount,
  required String paymentMode,
  String mode = 'ADD_PAYMENT',
  String? referenceNo,
  String? note,
}) {
  return QueuedMutation(
    id: idempotencyKey,
    type: _mutationType,
    status: 'pending',
    payload: {
      'groupId': groupId,
      'memberId': memberId,
      'periodNumber': periodNumber,
      'amount': amount,
      'paymentMode': paymentMode,
      'mode': mode,
      if (referenceNo != null && referenceNo.trim().isNotEmpty)
        'referenceNo': referenceNo.trim(),
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    },
  );
}

final chitPaymentQueueProvider = Provider<OfflineQueue>((ref) {
  final service = ref.watch(chitServiceProvider);
  return OfflineQueue(
    boxName: _boxName,
    resolvers: {
      _mutationType: (mutation) async {
        final payload = mutation.payload;
        await service.collectContribution(
          payload['groupId'] as String,
          memberId: payload['memberId'] as String,
          periodNumber: (payload['periodNumber'] as num).toInt(),
          amount: (payload['amount'] as num).toDouble(),
          paymentMode: payload['paymentMode'] as String,
          mode: (payload['mode'] as String?) ?? 'ADD_PAYMENT',
          idempotencyKey: mutation.id,
          referenceNo: payload['referenceNo'] as String?,
          note: payload['note'] as String?,
        );
      },
    },
  );
});

class ChitPaymentSyncController extends StateNotifier<ChitPaymentSyncState> {
  ChitPaymentSyncController(this._queue)
      : super(const ChitPaymentSyncState(online: true, pending: 0)) {
    _conn = Connectivity().onConnectivityChanged.listen((results) async {
      final online = results.any((r) => r != ConnectivityResult.none);
      state = state.copyWith(online: online);
      if (online) await sync();
    });
    refresh();
  }

  final OfflineQueue _queue;
  late final StreamSubscription<List<ConnectivityResult>> _conn;

  Future<void> refresh() async {
    final all = await _queue.all();
    state = state.copyWith(
      pending: all.where((m) => m.status == 'pending').length,
      failed: all.where((m) => m.status == 'failed').length,
      synced: all.where((m) => m.status == 'synced').length,
    );
  }

  Future<void> sync() async {
    final result = await _queue.syncPending();
    await refresh();
    state = state.copyWith(lastSyncedCount: result.synced);
  }

  @override
  void dispose() {
    _conn.cancel();
    super.dispose();
  }
}

class ChitPaymentSyncState {
  const ChitPaymentSyncState({
    required this.online,
    required this.pending,
    this.synced = 0,
    this.failed = 0,
    this.lastSyncedCount = 0,
  });

  final bool online;
  final int pending;
  final int synced;
  final int failed;
  final int lastSyncedCount;

  ChitPaymentSyncState copyWith({
    bool? online,
    int? pending,
    int? synced,
    int? failed,
    int? lastSyncedCount,
  }) {
    return ChitPaymentSyncState(
      online: online ?? this.online,
      pending: pending ?? this.pending,
      synced: synced ?? this.synced,
      failed: failed ?? this.failed,
      lastSyncedCount: lastSyncedCount ?? this.lastSyncedCount,
    );
  }
}

final chitPaymentSyncProvider =
    StateNotifierProvider<ChitPaymentSyncController, ChitPaymentSyncState>(
  (ref) => ChitPaymentSyncController(ref.watch(chitPaymentQueueProvider)),
);
