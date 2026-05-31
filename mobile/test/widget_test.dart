// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:hive/hive.dart';

import 'package:loantrack/app.dart';
import 'package:loantrack/core/network/dio_client.dart';

class MockAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    // Return standard empty response envelope to satisfy API services
    const json = '{"data": {}, "error": null}';
    return ResponseBody.fromString(
      json,
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    
    // Initialize Hive with a temporary directory for tests
    final tempDir = Directory.systemTemp.createTempSync();
    Hive.init(tempDir.path);

    const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    // Mock secure storage native methods to return null (no token)
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
      return null;
    });
  });

  testWidgets('App smoke test', (WidgetTester tester) async {
    final testDio = Dio(BaseOptions(
      baseUrl: 'http://localhost',
      connectTimeout: const Duration(seconds: 1),
    ));
    testDio.httpClientAdapter = MockAdapter();

    // Build our app and trigger a frame inside runAsync to allow background timers to run.
    await tester.runAsync(() async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            dioProvider.overrideWithValue(testDio),
          ],
          child: const App(),
        ),
      );
      expect(find.byType(App), findsOneWidget);
    });
  });
}
