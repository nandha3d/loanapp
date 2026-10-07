import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:intl/intl.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_theme.dart';
import 'package:zolofund/data/models/analytics.dart';
import 'package:zolofund/data/services/analytics_service.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';
import 'package:zolofund/features/dashboard/widgets/disbursement_trend_card.dart';
import 'package:zolofund/features/dashboard/widgets/interactive_portfolio_donut_card.dart';
import 'package:zolofund/features/dashboard/widgets/overdue_aging_card.dart';
import 'package:zolofund/features/dashboard/widgets/collection_trend_card.dart';
import 'package:zolofund/features/dashboard/widgets/daily_collection_heat_map_card.dart';

class _Analytics extends AnalyticsService {
  _Analytics() : super(Dio());
  @override
  Future<List<CollectionPoint>> collections({int? range}) async =>
      List.generate(
        7,
        (i) => CollectionPoint.fromJson({
          'date': '2026-10-${(i + 1).toString().padLeft(2, '0')}',
          'expected': 10000,
          'collected': i * 4000,
          'overdue': 2000,
        }),
      );
}

double contrast(Color a, Color b) {
  final x = a.computeLuminance();
  final y = b.computeLuminance();
  return x > y ? (x + .05) / (y + .05) : (y + .05) / (x + .05);
}

final summary = DashboardSummary.fromJson({
  'todayExpected': 150000,
  'todayCollected': 100000,
  'todayGap': 50000,
  'overdueOutstanding': 25000,
  'portfolioHealth': {'onTrack': 80, 'withOverdue': 20, 'total': 100},
  'cashFlow': [
    {'label': 'August', 'disbursed': 100000, 'collected': 250000},
    {'label': 'September', 'disbursed': 200000, 'collected': 150000},
  ],
  'overdueAgeing': [
    {'label': '0–7 days', 'amount': 25000, 'count': 5},
    {'label': '90+ days', 'amount': 500000, 'count': 10},
  ],
});

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory prefsDirectory;
  setUpAll(() async {
    prefsDirectory = Directory.systemTemp.createTempSync('dark-mode-ui');
    Hive.init(prefsDirectory.path);
    await Hive.openBox<dynamic>('prefs');
  });
  tearDownAll(() async {
    await Hive.close();
    prefsDirectory.deleteSync(recursive: true);
  });
  tearDown(() => AppColors.isDark = false);

  test('dark secondary text and theme controls meet normal-text contrast', () {
    AppColors.isDark = true;
    expect(
      contrast(AppColors.textLight, AppColors.surface),
      greaterThanOrEqualTo(4.5),
    );
    final theme = AppTheme.dark();
    expect(
      contrast(theme.colorScheme.primary, theme.colorScheme.surface),
      greaterThanOrEqualTo(4.5),
    );
    expect(
      contrast(theme.colorScheme.onPrimary, theme.colorScheme.primary),
      greaterThanOrEqualTo(4.5),
    );
  });

  test('dark accents retain tenant hue and readable contrast across palettes',
      () {
    final original = AppColors.primary;
    addTearDown(() => AppColors.primary = original);
    AppColors.isDark = true;
    for (final color in [
      AppColors.defaultPrimary,
      Colors.blue.shade900,
      Colors.green.shade900,
      Colors.orange,
      Colors.black,
    ]) {
      AppColors.primary = color;
      expect(
        contrast(AppColors.accent, AppColors.darkRowHover),
        greaterThanOrEqualTo(4.5),
      );
      expect(AppTheme.light().colorScheme.primary, color);
      expect(
        AppTheme.light().appBarTheme.titleTextStyle!.color,
        AppColors.lightTextPrimary,
      );
    }
  });

  for (final width in [320.0, 390.0, 768.0]) {
    for (final scale in [1.0, 1.6]) {
      testWidgets('charts stay readable at width $width, text scale $scale',
          (tester) async {
        AppColors.isDark = true;
        tester.view.physicalSize = Size(width, 1400);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              analyticsServiceProvider.overrideWithValue(_Analytics()),
            ],
            child: MaterialApp(
              theme: AppTheme.dark(),
              home: MediaQuery(
                data: MediaQueryData(
                  size: Size(width, 1400),
                  textScaler: TextScaler.linear(scale),
                ),
                child: Scaffold(
                  body: SingleChildScrollView(
                    child: Column(
                      children: [
                        DisbursementTrendCard(summary: summary),
                        InteractivePortfolioDonutCard(
                          summary: summary,
                          fmt: NumberFormat.currency(
                            locale: 'en_IN',
                            symbol: '₹',
                          ),
                        ),
                        OverdueAgingCard(
                          summary: summary,
                          fmt: NumberFormat.currency(
                            locale: 'en_IN',
                            symbol: '₹',
                          ),
                        ),
                        const CollectionTrendCard(),
                        const DailyCollectionHeatMapCard(),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        final august = tester.getRect(find.text('August'));
        final september = tester.getRect(find.text('September'));
        expect(august.right + 8, lessThanOrEqualTo(september.left),
            reason: 'Cash-flow month labels must not touch at large text sizes');
        for (final title in [
          'Disbursement & Cash Flow',
          'Portfolio Health',
          'Overdue Aging',
        ]) {
          final text = tester.widget<Text>(find.text(title));
          expect(
            contrast(text.style!.color!, AppColors.surface),
            greaterThanOrEqualTo(4.5),
            reason: title,
          );
        }
      });
    }
  }
}
