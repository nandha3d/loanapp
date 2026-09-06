import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:zolofund/data/services/collection_service.dart';

/// Local offline queue for collection submissions.
///
/// Spec §6.2: when offline, store pending entry with idempotency key
/// `collectionDate + ":" + instalmentId`; sync when connectivity restored.
///
/// Hive used instead of Isar to keep build simpler (no native isar binaries).
/// Same contract — pending/synced/failed lifecycle. Migrate to Isar later if
/// you need indexed queries on the queue.
class QueuedCollection {
  QueuedCollection({
    required this.idempotencyKey,
    required this.instalmentId,
    required this.receivedAmount,
    required this.paymentMode,
    required this.collectionDate,
    required this.status,
    this.failureReason,
    this.customerName,
    this.loanCode,
  });

  final String idempotencyKey;
  final String instalmentId;
  final double receivedAmount;
  final String paymentMode;
  final DateTime collectionDate;
  String status; // pending | synced | failed
  String? failureReason;
  final String? customerName;
  final String? loanCode;

  Map<String, dynamic> toJson() => {
        'idempotencyKey': idempotencyKey,
        'instalmentId': instalmentId,
        'receivedAmount': receivedAmount,
        'paymentMode': paymentMode,
        'collectionDate': collectionDate.toIso8601String(),
        'status': status,
        'failureReason': failureReason,
        'customerName': customerName,
        'loanCode': loanCode,
      };

  factory QueuedCollection.fromJson(Map<String, dynamic> j) => QueuedCollection(
        idempotencyKey: j['idempotencyKey'] as String,
        instalmentId: j['instalmentId'] as String,
        receivedAmount: (j['receivedAmount'] as num).toDouble(),
        paymentMode: j['paymentMode'] as String,
        collectionDate: DateTime.parse(j['collectionDate'] as String),
        status: j['status'] as String,
        failureReason: j['failureReason'] as String?,
        customerName: j['customerName'] as String?,
        loanCode: j['loanCode'] as String?,
      );
}

class CollectionQueue {
  CollectionQueue(this._service);

  static const _boxName = 'collection_queue';
  final CollectionService _service;
  Box<String>? _box;

  Future<Box<String>> _open() async {
    return _box ??= await Hive.openBox<String>(_boxName);
  }

  Future<void> add(QueuedCollection q) async {
    final box = await _open();
    await box.put(q.idempotencyKey, jsonEncode(q.toJson()));
  }

  Future<List<QueuedCollection>> all() async {
    final box = await _open();
    return box.values
        .map(
          (raw) => QueuedCollection.fromJson(
              jsonDecode(raw) as Map<String, dynamic>,),
        )
        .toList(growable: false);
  }

  Future<void> _update(QueuedCollection q) async {
    final box = await _open();
    await box.put(q.idempotencyKey, jsonEncode(q.toJson()));
  }

  /// Push all pending entries. Stops on first network failure.
  Future<({int synced, int failed})> syncPending() async {
    int synced = 0, failed = 0;
    final pending = (await all()).where((q) => q.status == 'pending');
    for (final q in pending) {
      try {
        await _service.submit(
          instalmentId: q.instalmentId,
          receivedAmount: q.receivedAmount,
          paymentMode: q.paymentMode,
          idempotencyKey: q.idempotencyKey,
          collectionDate: q.collectionDate,
        );
        q.status = 'synced';
        await _update(q);
        synced++;
      } on Object catch (e) {
        final msg = e.toString();
        if (msg.contains('already_paid') || msg.contains('409')) {
          q.status = 'failed';
          q.failureReason = 'already_paid';
          await _update(q);
          failed++;
        } else {
          // Network failure — leave as pending, abort run.
          break;
        }
      }
    }
    return (synced: synced, failed: failed);
  }
}

final collectionQueueProvider = Provider<CollectionQueue>(
  (ref) => CollectionQueue(ref.watch(collectionServiceProvider)),
);

/// Listens to connectivity events and triggers sync on reconnect.
class CollectionSyncController extends StateNotifier<CollectionSyncState> {
  CollectionSyncController(this._queue)
      : super(const CollectionSyncState(online: true, pending: 0)) {
    _conn = Connectivity().onConnectivityChanged.listen((results) async {
      final online = results.any((r) => r != ConnectivityResult.none);
      state = state.copyWith(online: online);
      if (online) await sync();
    });
    refresh();
  }

  final CollectionQueue _queue;
  late final StreamSubscription<List<ConnectivityResult>> _conn;

  Future<void> refresh() async {
    final all = await _queue.all();
    state = state.copyWith(
      pending: all.where((q) => q.status == 'pending').length,
      failed: all.where((q) => q.status == 'failed').length,
      synced: all.where((q) => q.status == 'synced').length,
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

class CollectionSyncState {
  const CollectionSyncState({
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

  CollectionSyncState copyWith({
    bool? online,
    int? pending,
    int? synced,
    int? failed,
    int? lastSyncedCount,
  }) {
    return CollectionSyncState(
      online: online ?? this.online,
      pending: pending ?? this.pending,
      synced: synced ?? this.synced,
      failed: failed ?? this.failed,
      lastSyncedCount: lastSyncedCount ?? this.lastSyncedCount,
    );
  }
}

final collectionSyncProvider =
    StateNotifierProvider<CollectionSyncController, CollectionSyncState>(
  (ref) => CollectionSyncController(ref.watch(collectionQueueProvider)),
);
