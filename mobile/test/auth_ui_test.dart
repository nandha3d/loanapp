import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';

import 'package:loantrack/app.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class _EnvelopeAdapter implements HttpClientAdapter {
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

Future<void> _mockSecureStorage() async {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (_) async => null);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    Hive.init(Directory.systemTemp.createTempSync().path);
    await _mockSecureStorage();
  });

  testWidgets('MOB-AUTH-UI-001 login renders credential fields and actions',
      (tester) async {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
    dio.httpClientAdapter = _EnvelopeAdapter();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [dioProvider.overrideWithValue(dio)],
        child: const App(),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.byType(App), findsOneWidget);
    expect(find.byType(AppButton), findsWidgets);
    expect(find.byType(TextField), findsAtLeastNWidgets(2));
    expect(find.text('Register Business'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);
  });

  testWidgets('MOB-AUTH-UI-002 empty login submit stays on login surface',
      (tester) async {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
    dio.httpClientAdapter = _EnvelopeAdapter();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [dioProvider.overrideWithValue(dio)],
        child: const App(),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    await tester.tap(find.byType(AppButton).first);
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsAtLeastNWidgets(2));
  });
}
