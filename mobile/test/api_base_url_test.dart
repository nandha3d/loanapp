import 'package:flutter_test/flutter_test.dart';
import 'package:loantrack/core/network/dio_client.dart';

void main() {
  group('API base URL resolution', () {
    test('explicit build URL wins on every build type', () {
      expect(
        resolveApiBaseUrl(
          configuredUrl: 'https://qa.example.test/api/v1',
          isRelease: true,
          isWeb: false,
          isAndroid: true,
        ),
        'https://qa.example.test/api/v1',
      );
    });

    test('release without an override uses production', () {
      expect(
        resolveApiBaseUrl(
          configuredUrl: '',
          isRelease: true,
          isWeb: false,
          isAndroid: true,
        ),
        'https://app.animazon.in/api/v1',
      );
    });

    test('debug Android uses the emulator host', () {
      expect(
        resolveApiBaseUrl(
          configuredUrl: '',
          isRelease: false,
          isWeb: false,
          isAndroid: true,
        ),
        'http://10.0.2.2:3000/api/v1',
      );
    });

    test('other debug targets use localhost', () {
      expect(
        resolveApiBaseUrl(
          configuredUrl: '',
          isRelease: false,
          isWeb: false,
          isAndroid: false,
        ),
        'http://localhost:3000/api/v1',
      );
    });
  });
}
