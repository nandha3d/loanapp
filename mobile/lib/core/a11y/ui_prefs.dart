import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

const _kPrefsBox = 'prefs';
const _kTextScaleKey = 'ui_text_scale';
const _kSimpleModeKey = 'ui_simple_mode';

/// Allowed text-scale steps (U6). Applied app-wide via MediaQuery in app.dart.
const kTextScaleSteps = <double>[0.9, 1.0, 1.15, 1.3];

Future<Box<dynamic>> _openBox() async {
  if (Hive.isBoxOpen(_kPrefsBox)) return Hive.box(_kPrefsBox);
  return Hive.openBox(_kPrefsBox);
}

/// App-wide text scale multiplier, persisted across sessions.
class TextScaleController extends StateNotifier<double> {
  TextScaleController() : super(1.0) {
    _hydrate();
  }

  Future<void> _hydrate() async {
    final box = await _openBox();
    final v = (box.get(_kTextScaleKey) as num?)?.toDouble();
    if (v != null && kTextScaleSteps.contains(v)) state = v;
  }

  Future<void> set(double v) async {
    if (!kTextScaleSteps.contains(v)) return;
    state = v;
    final box = await _openBox();
    await box.put(_kTextScaleKey, v);
  }
}

final textScaleProvider =
    StateNotifierProvider<TextScaleController, double>((ref) {
  return TextScaleController();
});

/// Simple mode (U4): agents get a reduced UI — the More grid hides
/// non-daily-work sections. Read by screens that opt in; turning it on
/// never removes capability for admin roles (screens check role first).
class SimpleModeController extends StateNotifier<bool> {
  SimpleModeController() : super(false) {
    _hydrate();
  }

  Future<void> _hydrate() async {
    final box = await _openBox();
    state = (box.get(_kSimpleModeKey) as bool?) ?? false;
  }

  Future<void> set(bool v) async {
    state = v;
    final box = await _openBox();
    await box.put(_kSimpleModeKey, v);
  }
}

final simpleModeProvider =
    StateNotifierProvider<SimpleModeController, bool>((ref) {
  return SimpleModeController();
});
