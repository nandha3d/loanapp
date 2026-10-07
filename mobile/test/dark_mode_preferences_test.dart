import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:zolofund/core/a11y/ui_prefs.dart';

void main() {
  late Directory directory;

  setUp(() async {
    directory = Directory.systemTemp.createTempSync('dark-mode-prefs');
    Hive.init(directory.path);
  });
  tearDown(() async {
    await Hive.close();
    directory.deleteSync(recursive: true);
  });

  test('dark mode defaults to light and survives controller recreation',
      () async {
    final first = DarkModeController();
    expect(first.state, isFalse);
    await first.set(true);
    first.dispose();
    final restored = DarkModeController();
    await Future<void>.delayed(Duration.zero);
    expect(restored.state, isTrue);
    await restored.set(false);
    restored.dispose();
    final light = DarkModeController();
    await Future<void>.delayed(Duration.zero);
    expect(light.state, isFalse);
    light.dispose();
  });

  test('a toggle during hydration wins over the saved preference', () async {
    final box = await Hive.openBox<dynamic>('prefs');
    await box.put('ui_dark_mode', true);
    await box.close();
    final controller = DarkModeController();
    await controller.set(false);
    expect(controller.state, isFalse);
    expect(Hive.box<dynamic>('prefs').get('ui_dark_mode'), isFalse);
    controller.dispose();
  });
}
