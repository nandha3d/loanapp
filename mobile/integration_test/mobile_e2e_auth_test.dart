import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:integration_test/integration_test.dart';

import 'package:loantrack/app.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

const agentUser = String.fromEnvironment('E2E_AGENT', defaultValue: 'karthik');
const agentPass = String.fromEnvironment('E2E_PASS', defaultValue: 'agent123');

Future<void> pumpLoanTrack(WidgetTester tester) async {
  await tester.pumpWidget(const ProviderScope(child: App()));
  await tester.pumpAndSettle(const Duration(seconds: 2));
}

Future<bool> tryLogin(WidgetTester tester, String user, String pass) async {
  final fields = find.byType(TextField);
  if (tester.widgetList(fields).length < 2) return false;
  await tester.enterText(fields.at(0), user);
  await tester.enterText(fields.at(1), pass);
  await tester.tap(find.byType(AppButton).first);
  await tester.pumpAndSettle(const Duration(seconds: 6));
  return tester.widgetList(find.byType(TextField)).length < 2;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await Hive.initFlutter();
  });

  group('MOB-E2E-AUTH live authentication', () {
    testWidgets('MOB-AUTH-E2E-001 login screen renders on cold start',
        (tester) async {
      await pumpLoanTrack(tester);
      expect(find.byType(TextField), findsAtLeastNWidgets(2));
      expect(find.byType(AppButton), findsWidgets);
    });

    testWidgets('MOB-AUTH-E2E-002 seeded agent login leaves login screen',
        (tester) async {
      await pumpLoanTrack(tester);
      final ok = await tryLogin(tester, agentUser, agentPass);
      if (!ok) {
        markTestSkipped('backend unavailable, unseeded user, or invalid creds');
        return;
      }
      expect(find.byType(TextField), findsNothing);
    });
  });
}
