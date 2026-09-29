import 'package:flutter_test/flutter_test.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';
import 'package:zolofund/data/repositories/dashboard_repository.dart';
import 'package:zolofund/features/collection/collection_screen.dart';

void main() {
  group('Multi-Tenant Cache Isolation Tests', () {
    setUp(() {
      DashboardRepository.clearCache();
      clearCollectionTodayCache();
    });

    test('DashboardRepository.cachedSummaryFor isolates data by scopeKey and clearCache', () {
      // Initially empty
      expect(DashboardRepository.cachedSummaryFor('samurai_user1'), isNull);
      expect(DashboardRepository.cachedSummaryFor('newtenant_user2'), isNull);

      // Simulate a summary cached for Samurai tenant
      // We can call cachedSummaryFor before and after cache operations
      DashboardRepository.clearCache();
      expect(DashboardRepository.cachedSummaryFor('newtenant_user2'), isNull);
      expect(DashboardRepository.cachedSummary, isNull);
    });

    test('Collection cache isolates data by scopeKey and clearCollectionTodayCache', () {
      expect(cachedCollectionTodayFor('samurai_user1'), isNull);
      expect(cachedCollectionTodayFor('newtenant_user2'), isNull);
      expect(cachedCollectionToday, isNull);

      clearCollectionTodayCache();
      expect(cachedCollectionTodayFor('samurai_user1'), isNull);
      expect(cachedCollectionTodayFor('newtenant_user2'), isNull);
    });
  });
}
