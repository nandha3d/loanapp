import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';

import 'package:zolofund/data/models/chit.dart';
import 'package:zolofund/data/services/chit_service.dart';
import 'package:zolofund/features/chits/chit_live_auction_screen.dart';

/// Regression: Prisma Decimal columns serialize to JSON *strings*
/// ("100000"), and a bare `as num?` cast on one throws a TypeError, which
/// release builds paint as a blank gray page (RenderErrorBox). The live room
/// must render even when every numeric field arrives as a string.
class _StringDecimalChitService extends ChitService {
  _StringDecimalChitService() : super(Dio());

  @override
  Future<Map<String, dynamic>> liveState(String id, String auctionId) async {
    return <String, dynamic>{
      'roomStatus': 'open',
      'auctionStatus': 'in_progress',
      'auctionType': 'open_live',
      'serverTime': '2026-07-11T07:00:00.000Z',
      'secondsRemaining': '95', // string on purpose
      'autoExtendSeconds': '60',
      'chitValue': '100000', // Decimal → string, the original crash
      'bidCount': '2',
      'bids': [
        {
          'id': 'b1',
          'ticketNo': 3,
          'memberName': 'Ramesh Kumar',
          'bidAmount': '95000',
          'bidDiscount': '5000',
          'bidTime': '2026-07-11T06:59:00.000Z',
          'status': 'valid',
        },
        {
          'id': 'b2',
          'ticketNo': 5,
          'memberName': 'Suresh',
          'bidAmount': '94000',
          'bidDiscount': '6000',
          'bidTime': '2026-07-11T06:59:30.000Z',
          'status': 'valid',
        },
      ],
      'highestBid': {
        'id': 'b2',
        'ticketNo': 5,
        'memberName': 'Suresh',
        'bidAmount': '94000',
        'bidDiscount': '6000',
      },
      'minNextDiscount': '6500',
      'attendance': <Map<String, dynamic>>[],
      'presentCount': '4',
      'totalMembers': '10',
      'winner': null,
    };
  }
}

ChitMember _member(int n, String name) => ChitMember.fromJson({
      'id': 'm$n',
      'memberNumber': n,
      'ticketNo': '$n',
      'hasWon': false,
      'subscriberStatus': 'active',
      'customer': {'id': 'c$n', 'name': name},
    });

void main() {
  setUpAll(() {
    // VoiceAssistController hydrates a Hive prefs box in its constructor.
    Hive.init(Directory.systemTemp.createTempSync('hive_test').path);
  });

  testWidgets('live room renders when numeric fields arrive as strings',
      (tester) async {
    // The test (Ahem) font renders every glyph as a full em square, which
    // falsely overflows the fixed-width center hub. Ignore overflow reports
    // only — any real exception (e.g. a TypeError from a bad cast) still
    // reaches the binding and fails the test.
    final oldOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      if (details.exceptionAsString().contains('overflowed')) return;
      oldOnError?.call(details);
    };
    addTearDown(() => FlutterError.onError = oldOnError);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          chitServiceProvider.overrideWithValue(_StringDecimalChitService()),
        ],
        child: MaterialApp(
          home: ChitLiveAuctionScreen(
            groupId: 'g1',
            auctionId: 'a1',
            periodNumber: 5,
            members: [_member(3, 'Ramesh Kumar'), _member(5, 'Suresh')],
            isAdmin: true,
            chitValue: null,
          ),
        ),
      ),
    );
    // First frame + a poll round-trip. The screen runs periodic timers, so
    // step frames manually instead of pumpAndSettle.
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(seconds: 1));

    expect(tester.takeException(), isNull);
    expect(find.text('Live Auction · Period 5'), findsOneWidget);
    // Countdown parsed from the string "95" → 01:35 rendered in the hub.
    expect(find.textContaining('01:3'), findsOneWidget);
  });
}
