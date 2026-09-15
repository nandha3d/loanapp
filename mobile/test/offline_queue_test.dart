import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:zolofund/data/local/offline_queue.dart';

void main() {
  group('isTerminalSyncError', () {
    test('4xx and dedupe markers are terminal', () {
      expect(isTerminalSyncError(Exception('already_paid')), isTrue);
      expect(isTerminalSyncError(Exception('HTTP 409 conflict')), isTrue);
      expect(isTerminalSyncError(Exception('duplicate entry')), isTrue);
      expect(isTerminalSyncError(Exception('status 422')), isTrue);
    });

    test('5xx and network errors are retryable', () {
      expect(isTerminalSyncError(Exception('500 server error')), isFalse);
      expect(isTerminalSyncError(Exception('SocketException: failed host')), isFalse);
      expect(isTerminalSyncError(Exception('timeout')), isFalse);
    });
  });

  group('OfflineQueue lifecycle', () {
    late Directory dir;

    setUp(() async {
      dir = await Directory.systemTemp.createTemp('offline_queue_test');
      Hive.init(dir.path);
    });

    tearDown(() async {
      await Hive.deleteFromDisk();
      await dir.delete(recursive: true);
    });

    QueuedMutation mut(String id) => QueuedMutation(
          id: id,
          type: 'customer.create',
          payload: {'name': 'A'},
          status: 'pending',
        );

    test('add is idempotent on id; pendingCount reflects state', () async {
      final q = OfflineQueue(boxName: 'q1', resolvers: {});
      await q.add(mut('k1'));
      await q.add(mut('k1')); // same key, no duplicate
      await q.add(mut('k2'));
      expect(await q.pendingCount(), 2);
    });

    test('syncPending marks synced when resolver succeeds', () async {
      final q = OfflineQueue(
        boxName: 'q2',
        resolvers: {'customer.create': (_) async {}},
      );
      await q.add(mut('a'));
      final r = await q.syncPending();
      expect(r.synced, 1);
      expect(await q.pendingCount(), 0);
    });

    test('terminal failure marks failed; transient keeps pending', () async {
      final qFail = OfflineQueue(
        boxName: 'q3',
        resolvers: {'customer.create': (_) async => throw Exception('409')},
      );
      await qFail.add(mut('a'));
      final r1 = await qFail.syncPending();
      expect(r1.failed, 1);
      expect(await qFail.pendingCount(), 0);

      final qNet = OfflineQueue(
        boxName: 'q4',
        resolvers: {'customer.create': (_) async => throw Exception('timeout')},
      );
      await qNet.add(mut('b'));
      final r2 = await qNet.syncPending();
      expect(r2.synced, 0);
      expect(await qNet.pendingCount(), 1); // still pending, will retry
    });

    test('unregistered type is skipped, stays pending', () async {
      final q = OfflineQueue(boxName: 'q5', resolvers: {});
      await q.add(mut('a'));
      final r = await q.syncPending();
      expect(r.synced, 0);
      expect(await q.pendingCount(), 1);
    });
  });
}
