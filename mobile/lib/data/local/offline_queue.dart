import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

/// Generic offline mutation queue — the reusable generalization of the
/// collection-specific queue in collection_queue.dart (which is intentionally
/// left untouched as the field-critical path).
///
/// A new write feature becomes offline-capable by:
///   1. registering a [MutationResolver] for its `type`, and
///   2. enqueuing a [QueuedMutation] when offline (or on network failure).
///
/// NOTE: only wire a feature to this queue once its server endpoint honours an
/// idempotency key — otherwise a sync retry could duplicate the write. See
/// docs/parity/02-offline-first-hardening.md.
class QueuedMutation {
  QueuedMutation({
    required this.id,
    required this.type,
    required this.payload,
    required this.status,
    this.failureReason,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  /// Idempotency key — also the Hive key, so a duplicate enqueue is a no-op.
  final String id;

  /// Logical mutation type, e.g. 'customer.create'. Selects the resolver.
  final String type;
  final Map<String, dynamic> payload;
  String status; // pending | synced | failed
  String? failureReason;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'payload': payload,
        'status': status,
        'failureReason': failureReason,
        'createdAt': createdAt.toIso8601String(),
      };

  factory QueuedMutation.fromJson(Map<String, dynamic> j) => QueuedMutation(
        id: j['id'] as String,
        type: j['type'] as String,
        payload: (j['payload'] as Map).cast<String, dynamic>(),
        status: j['status'] as String,
        failureReason: j['failureReason'] as String?,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? ''),
      );
}

typedef MutationResolver = Future<void> Function(QueuedMutation m);

/// Pure classification of a sync error: a 4xx/409 is terminal (the server
/// rejected it — don't retry), anything else is a transient network error
/// (keep pending, retry later). Extracted so it is unit-testable.
bool isTerminalSyncError(Object error) {
  final msg = error.toString().toLowerCase();
  if (msg.contains('already') || msg.contains('409') || msg.contains('duplicate')) {
    return true;
  }
  // 4xx client rejections are terminal; 5xx / timeouts are retryable.
  final m = RegExp(r'\b(4\d\d)\b').firstMatch(msg);
  return m != null;
}

class OfflineQueue {
  OfflineQueue({required this.boxName, required this.resolvers});

  final String boxName;
  final Map<String, MutationResolver> resolvers;
  Box<String>? _box;

  Future<Box<String>> _open() async =>
      _box ??= await Hive.openBox<String>(boxName);

  Future<void> add(QueuedMutation m) async {
    final box = await _open();
    await box.put(m.id, jsonEncode(m.toJson()));
  }

  Future<List<QueuedMutation>> all() async {
    final box = await _open();
    return box.values
        .map((raw) =>
            QueuedMutation.fromJson(jsonDecode(raw) as Map<String, dynamic>),)
        .toList(growable: false);
  }

  Future<void> _update(QueuedMutation m) async {
    final box = await _open();
    await box.put(m.id, jsonEncode(m.toJson()));
  }

  Future<int> pendingCount() async =>
      (await all()).where((m) => m.status == 'pending').length;

  /// Drain pending mutations. Terminal failures are marked 'failed'; the first
  /// transient (network) failure aborts the run so order is preserved.
  Future<({int synced, int failed})> syncPending() async {
    int synced = 0, failed = 0;
    final pending = (await all()).where((m) => m.status == 'pending');
    for (final m in pending) {
      final resolver = resolvers[m.type];
      if (resolver == null) continue; // no handler registered yet
      try {
        await resolver(m);
        m.status = 'synced';
        await _update(m);
        synced++;
      } on Object catch (e) {
        if (isTerminalSyncError(e)) {
          m.status = 'failed';
          m.failureReason = e.toString();
          await _update(m);
          failed++;
        } else {
          break; // transient — retry later
        }
      }
    }
    return (synced: synced, failed: failed);
  }
}
