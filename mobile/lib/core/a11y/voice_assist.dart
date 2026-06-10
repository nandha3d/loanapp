import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:hive_flutter/hive_flutter.dart';

const _kPrefsBox = 'prefs';
const _kVoiceKey = 'voice_assist_enabled';

/// Voice guidance for low-literacy users.
///
/// Primary path: flutter_tts — speaks unconditionally when the toggle is on,
/// no TalkBack/VoiceOver setup needed. Language follows the app language
/// (en/ta/hi/te/kn/ml → BCP-47 locales).
///
/// Fallback: if the platform TTS engine fails to initialise (no engine,
/// emulator without voices), we degrade to SemanticsService.announce, which
/// still speaks when a screen reader is active. Either way speak() never
/// throws — voice is best-effort.
class VoiceAssistController extends StateNotifier<bool> {
  VoiceAssistController() : super(false) {
    _hydrate();
  }

  FlutterTts? _tts;
  bool _ttsReady = false;

  static const _localeMap = <String, String>{
    'en': 'en-IN',
    'ta': 'ta-IN',
    'hi': 'hi-IN',
    'te': 'te-IN',
    'kn': 'kn-IN',
    'ml': 'ml-IN',
  };

  Future<void> _hydrate() async {
    final box = await _openBox();
    state = (box.get(_kVoiceKey) as bool?) ?? false;
    if (state) await _initTts();
  }

  Future<Box<dynamic>> _openBox() async {
    if (Hive.isBoxOpen(_kPrefsBox)) {
      return Hive.box(_kPrefsBox);
    }
    return Hive.openBox(_kPrefsBox);
  }

  Future<void> _initTts() async {
    if (_ttsReady) return;
    try {
      final tts = FlutterTts();
      await tts.setSpeechRate(0.5);
      await tts.setVolume(1.0);
      await tts.awaitSpeakCompletion(false);
      _tts = tts;
      _ttsReady = true;
    } catch (_) {
      _tts = null;
      _ttsReady = false; // SemanticsService fallback
    }
  }

  Future<void> setEnabled(bool v) async {
    state = v;
    final box = await _openBox();
    await box.put(_kVoiceKey, v);
    if (v) await _initTts();
  }

  /// Set the spoken language to match the app language code (en/ta/hi/...).
  Future<void> setLanguageCode(String code) async {
    final locale = _localeMap[code] ?? 'en-IN';
    try {
      await _tts?.setLanguage(locale);
    } catch (_) {
      // engine may not have this voice — keep previous language
    }
  }

  /// Announce a phrase if voice-assist is on. Never throws.
  Future<void> speak(String phrase) async {
    if (!state) return;
    if (phrase.trim().isEmpty) return;
    if (_ttsReady && _tts != null) {
      try {
        await _tts!.stop();
        await _tts!.speak(phrase);
        return;
      } catch (_) {
        // fall through to semantics announce
      }
    }
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
