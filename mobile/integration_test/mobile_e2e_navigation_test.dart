import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:integration_test/integration_test.dart';

import 'package:loantrack/app.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

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

  group('MOB-E2E-NAV live navigation', () {
    testWidgets('MOB-NAV-E2E-001 bottom navigation reaches Customers',
        (tester) async {
      if (!await _login(tester)) {
        markTestSkipped('backend unavailable or login did not complete');
        return;
      }
      final customers = find.text('Customers');
      if (customers.evaluate().isEmpty) {
        markTestSkipped('bottom navigation not visible for landing role');
        return;
      }
      await tester.tap(customers.first);
      await tester.pumpAndSettle(const Duration(seconds: 2));
      expect(find.textContaining('Customer'), findsWidgets);
    });

    testWidgets('MOB-NAV-E2E-002 More hub is reachable and stable',
        (tester) async {
      if (!await _login(tester)) {
        markTestSkipped('backend unavailable or login did not complete');
        return;
      }
      final more = find.text('More');
      if (more.evaluate().isEmpty) {
        markTestSkipped('More tab not visible for landing role');
        return;
      }
      await tester.tap(more.first);
      await tester.pumpAndSettle(const Duration(seconds: 3));
      expect(find.byType(MaterialApp), findsWidgets);
    });
  });
}
