import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

const _kPrefsBox = 'prefs';
const _kVoiceKey = 'voice_assist_enabled';

/// Lightweight TTS layer using Flutter's SemanticsService.
///
/// Real TTS (flutter_tts) is not wired yet — that needs a pubspec entry
/// plus native config. SemanticsService.announce routes through the
/// platform's accessibility engine (TalkBack / VoiceOver), which already
/// speaks aloud when a screen reader is on. For low-literacy field
/// agents the recommended flow is: enable Android TalkBack once at
/// setup, then this announce() call speaks UI events.
///
/// Swap-in for true unconditional TTS later by replacing announce()
/// with a flutter_tts call.
class VoiceAssistController extends StateNotifier<bool> {
  VoiceAssistController() : super(false) {
    _hydrate();
  }

  Future<void> _hydrate() async {
    final box = await _openBox();
    state = (box.get(_kVoiceKey) as bool?) ?? false;
  }

  Future<Box<dynamic>> _openBox() async {
    if (Hive.isBoxOpen(_kPrefsBox)) {
      return Hive.box(_kPrefsBox);
    }
    return Hive.openBox(_kPrefsBox);
  }

  Future<void> setEnabled(bool v) async {
    state = v;
    final box = await _openBox();
    await box.put(_kVoiceKey, v);
  }

  /// Announce a phrase if voice-assist is on.
  void speak(String phrase) {
    if (!state) return;
    if (phrase.trim().isEmpty) return;
    // ignore: deprecated_member_use
    SemanticsService.announce(phrase, TextDirection.ltr);
  }
}

final voiceAssistProvider =
    StateNotifierProvider<VoiceAssistController, bool>((ref) {
  return VoiceAssistController();
});

/// Convenience: read voice service without watching.
extension VoiceRefX on WidgetRef {
  void speak(String phrase) {
    read(voiceAssistProvider.notifier).speak(phrase);
  }
}
