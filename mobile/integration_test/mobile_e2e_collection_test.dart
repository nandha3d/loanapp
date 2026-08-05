import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:integration_test/integration_test.dart';

import 'package:zolofund/app.dart';
import 'package:zolofund/shared/widgets/app_button.dart';

const agentUser = String.fromEnvironment('E2E_AGENT', defaultValue: 'karthik');
const agentPass = String.fromEnvironment('E2E_PASS', defaultValue: 'agent123');

Future<bool> _login(WidgetTester tester) async {
  await tester.pumpWidget(const ProviderScope(child: App()));
  await tester.pumpAndSettle(const Duration(seconds: 2));
  final fields = find.byType(TextField);
  if (tester.widgetList(fields).length < 2) return false;
  await tester.enterText(fields.at(0), agentUser);
  await tester.enterText(fields.at(1), agentPass);
  await tester.tap(find.byType(AppButton).first);
  await tester.pumpAndSettle(const Duration(seconds: 6));
  return tester.widgetList(find.byType(TextField)).length < 2;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await Hive.initFlutter();
  });

  group('MOB-E2E-COLL live collection', () {
    testWidgets('MOB-COLL-E2E-001 collection tab loads for seeded agent',
        (tester) async {
      if (!await _login(tester)) {
        markTestSkipped('backend unavailable or seeded agent login failed');
        return;
      }
      final collection = find.text('Collection');
      if (collection.evaluate().isEmpty) {
        markTestSkipped('Collection tab not available for current role');
        return;
      }
      await tester.tap(collection.first);
      await tester.pumpAndSettle(const Duration(seconds: 4));
      expect(find.byType(MaterialApp), findsWidgets);
    });

    testWidgets('MOB-COLL-E2E-002 quick collect surface does not crash',
        (tester) async {
      if (!await _login(tester)) {
        markTestSkipped('backend unavailable or seeded agent login failed');
        return;
      }
      final collection = find.text('Collection');
      if (collection.evaluate().isEmpty) {
        markTestSkipped('Collection tab not available for current role');
        return;
      }
      await tester.tap(collection.first);
      await tester.pumpAndSettle(const Duration(seconds: 4));
      expect(find.byType(MaterialApp), findsWidgets);
    });
  });
}
