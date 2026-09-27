import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zolofund/data/services/settings_service.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class _ImportAdapter implements HttpClientAdapter {
  String? method;
  String? path;
  dynamic body;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    method = options.method;
    path = options.path;
    body = jsonDecode(
      utf8.decode(await requestStream!.expand((part) => part).toList()),
    );
    return ResponseBody.fromString(
      jsonEncode({
        'data': {'total': 1, 'success': 1, 'failed': 0, 'errors': <dynamic>[]},
        'error': null,
      }),
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
  test('customer import sends JSON rows and unwraps result', () async {
    final adapter = _ImportAdapter();
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
    dio.httpClientAdapter = adapter;
    final rows = [
      {'name': 'Ravi', 'phone': '9876543210'},
    ];
    final result = await SettingsService(dio).importCustomers(rows);
    expect(adapter.method, 'POST');
    expect(adapter.path, Endpoints.importCustomers);
    expect(adapter.body, rows);
    expect(result['success'], 1);
  });
}
