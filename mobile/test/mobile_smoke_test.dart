import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';

import 'package:zolofund/app.dart';
import 'package:zolofund/core/network/dio_client.dart';

class _SmokeAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      '{"data": {}, "error": null}',
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
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    Hive.init(Directory.systemTemp.createTempSync().path);
    const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (_) async => null);
  });

  testWidgets('MOB-SMOKE-001 app boots with mocked network and no token',
      (tester) async {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
    dio.httpClientAdapter = _SmokeAdapter();

    await tester.runAsync(() async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [dioProvider.overrideWithValue(dio)],
          child: const App(),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    });

    expect(find.byType(App), findsOneWidget);
    expect(find.textContaining('ZoloFund'), findsWidgets);
  });
}
