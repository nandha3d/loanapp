import 'package:flutter_test/flutter_test.dart';
import 'package:zolofund/data/local/chit_payment_queue.dart';
import 'package:zolofund/data/local/offline_queue.dart';
import 'package:zolofund/features/chits/widgets/cash_denomination_sheet.dart';
import 'package:zolofund/features/chits/widgets/contact_quick_add_sheet.dart';

void main() {
  group('Chit P0-P2 Mobile Parity Tests', () {
    test('INR cash denomination math and greedy auto-fill', () {
      final counts = greedyFillInrDenominations(2888);
      expect(computeDenominationTotal(counts), 2888);
      final serialized = serializeDenominationBreakdown(counts);
      expect(serialized, isNotNull);
      expect(serialized!['currency'], 'INR');
      expect(serialized['computedTotal'], 2888);
    });

    test('chitPaymentIdempotencyKey is deterministic per member/cycle/day', () {
      final k1 = chitPaymentIdempotencyKey(
        groupId: 'grp-1',
        memberId: 'mem-1',
        periodNumber: 3,
        amount: 5000,
      );
      final k2 = chitPaymentIdempotencyKey(
        groupId: 'grp-1',
        memberId: 'mem-1',
        periodNumber: 3,
        amount: 5000,
      );
      expect(k1, equals(k2));
      expect(k1.contains('grp-1:mem-1:3:5000.00'), isTrue);
    });

    test('queuedChitPayment stores denomination breakdown and local timestamp', () {
      final m = queuedChitPayment(
        idempotencyKey: 'idem-1',
        groupId: 'grp-1',
        memberId: 'mem-1',
        memberName: 'Anitha',
        periodNumber: 2,
        amount: 2000,
        paymentMode: 'cash',
        denominationBreakdown: serializeDenominationBreakdown({500: 4}),
        collectedAtLocal: '2026-11-26T12:00:00Z',
        agentId: 'agent-1',
      );
      expect(m.status, 'pending');
      expect(m.payload['memberName'], 'Anitha');
      expect(m.payload['agentId'], 'agent-1');
      expect(m.payload['denominationBreakdown']['computedTotal'], 2000);
    });

    test('conflict vs transient error classification for offline sync', () {
      expect(
        isConflictSyncError('ApiException 409: Subscription already paid'),
        isTrue,
      );
      expect(isTerminalSyncError('ApiException 400: Invalid amount'), isTrue);
      expect(
        isConflictSyncError('SocketException: Connection timed out'),
        isFalse,
      );
      expect(
        isTerminalSyncError('SocketException: Connection timed out'),
        isFalse,
      );
    });

    test('Indian phone number normalizer strips +91 and leading 0', () {
      expect(normalizeIndianPhoneNumber('+91 98422-11001'), '9842211001');
      expect(normalizeIndianPhoneNumber('09842211001'), '9842211001');
      expect(normalizeIndianPhoneNumber('9842211001'), '9842211001');
    });
  });
}
