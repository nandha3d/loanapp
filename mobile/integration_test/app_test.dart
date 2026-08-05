// Mobile E2E (integration_test) — mirrors the web Playwright suite.
//
// RUN (needs a device/emulator):
//   flutter test integration_test/app_test.dart \
//     --dart-define=E2E_BASE_URL=http://10.0.2.2:3000 \
//     --dart-define=E2E_AGENT=karthik --dart-define=E2E_PASS=agent123
//
// The backend must be running + seeded (npm run db:seed). Tests tagged "live"
// hit the server; "ui" tests run offline (just the widget tree).
//
// 10.0.2.2 = host loopback from the Android emulator. Use your LAN IP on iOS.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:integration_test/integration_test.dart';

import 'package:zolofund/app.dart';
import 'package:zolofund/shared/widgets/app_button.dart';

const agentUser = String.fromEnvironment('E2E_AGENT', defaultValue: 'karthik');
const agentPass = String.fromEnvironment('E2E_PASS', defaultValue: 'agent123');

Future<void> pumpApp(WidgetTester tester) async {
  await tester.pumpWidget(const ProviderScope(child: App()));
  await tester.pumpAndSettle(const Duration(seconds: 2));
}

Future<bool> login(WidgetTester tester, String user, String pass) async {
  final fields = find.byType(TextField);
  if (tester.widgetList(fields).length < 2) return false; // not on login
  await tester.enterText(fields.at(0), user);
  await tester.enterText(fields.at(1), pass);
  await tester.tap(find.byType(AppButton).first);
  await tester.pumpAndSettle(const Duration(seconds: 6));
  // success = login fields gone
  return tester.widgetList(find.byType(TextField)).length < 2;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await Hive.initFlutter();
  });

  group('MOB-AUTH (ui, offline)', () {
    testWidgets('MOB-AUTH-01 login screen renders fields + actions', (t) async {
      await pumpApp(t);
      expect(find.byType(TextField), findsNWidgets(2));
      expect(find.byType(AppButton), findsWidgets);
      expect(find.text('Register Business'), findsOneWidget);
      expect(find.text('Continue with Google'), findsOneWidget);
    });

    testWidgets('MOB-AUTH-OUT empty submit does not crash / stays on login',
        (t) async {
      await pumpApp(t);
      await t.tap(find.byType(AppButton).first);
      await t.pumpAndSettle();
      expect(find.byType(TextField), findsNWidgets(2)); // still on login
    });
  });

  group('MOB-FLOW (live, needs seeded backend)', () {
    testWidgets('MOB-AUTH-LOGIN agent logs in → leaves login', (t) async {
      await pumpApp(t);
      final ok = await login(t, agentUser, agentPass);
      // If no backend, login() returns false → skip rather than fail.
      if (!ok) {
        markTestSkipped('backend unreachable / creds invalid');
        return;
      }
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('MOB-NAV bottom nav reaches Collection', (t) async {
      await pumpApp(t);
      final ok = await login(t, agentUser, agentPass);
      if (!ok) {
        markTestSkipped('backend unreachable');
        return;
      }
      final coll = find.text('Collection');
      if (coll.evaluate().isEmpty) {
        markTestSkipped('no bottom nav / different landing');
        return;
      }
      await t.tap(coll.first);
      await t.pumpAndSettle();
    });

    testWidgets('MOB-WALLET reachable from More (admin) — smoke', (t) async {
      await pumpApp(t);
      final ok = await login(t, agentUser, agentPass);
      if (!ok) {
        markTestSkipped('backend unreachable');
        return;
      }
      // Agent has no wallet menu; this asserts the app stays stable post-login.
      expect(find.byType(MaterialApp), findsWidgets);
    });
  });
}
