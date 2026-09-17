import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Speech-to-text capture for collection entry (the input counterpart to the
/// TTS output in core/a11y/voice_assist.dart). Mirrors that controller's
/// locale map so spoken language follows the app language.
///
/// Best-effort: if the platform has no STT engine or permission is denied,
/// [available] stays false and the UI simply hides the mic. listen() never
/// throws.
class VoiceEntryState {
  const VoiceEntryState({
    this.available = false,
    this.listening = false,
    this.transcript = '',
  });

  final bool available;
  final bool listening;
  final String transcript;

  VoiceEntryState copyWith({bool? available, bool? listening, String? transcript}) =>
      VoiceEntryState(
        available: available ?? this.available,
        listening: listening ?? this.listening,
        transcript: transcript ?? this.transcript,
      );
}

class VoiceEntryController extends StateNotifier<VoiceEntryState> {
  VoiceEntryController() : super(const VoiceEntryState());

  final SpeechToText _stt = SpeechToText();
  bool _initTried = false;

  // Same app-code → BCP-47 mapping used by VoiceAssistController.
  static const _localeMap = <String, String>{
    'en': 'en-IN',
    'ta': 'ta-IN',
    'hi': 'hi-IN',
    'te': 'te-IN',
    'kn': 'kn-IN',
    'ml': 'ml-IN',
  };

  Future<bool> _ensureInit() async {
    if (_stt.isAvailable) return true;
    if (_initTried && !_stt.isAvailable) {
      // already tried and failed; retry once more cheaply
    }
    _initTried = true;
    try {
      final ok = await _stt.initialize(
        onError: (_) => state = state.copyWith(listening: false),
        onStatus: (s) {
          if (s == 'done' || s == 'notListening') {
            state = state.copyWith(listening: false);
          }
        },
      );
      state = state.copyWith(available: ok);
      return ok;
    } catch (_) {
      state = state.copyWith(available: false);
      return false;
    }
  }

  /// Start listening in [langCode] (en/ta/hi/te/kn/ml). Streams partial text
  /// into state; calls [onFinal] with the last transcript when speech ends.
  Future<void> listen(String langCode, {required void Function(String) onFinal}) async {
    final ok = await _ensureInit();
    if (!ok) return;
    state = state.copyWith(listening: true, transcript: '');
    try {
      await _stt.listen(
        listenOptions: SpeechListenOptions(
          localeId: _localeMap[langCode] ?? 'en-IN',
          partialResults: true,
          cancelOnError: true,
        ),
        onResult: (r) {
          state = state.copyWith(transcript: r.recognizedWords);
          if (r.finalResult) {
            state = state.copyWith(listening: false);
            onFinal(r.recognizedWords);
          }
        },
      );
    } catch (_) {
      state = state.copyWith(listening: false);
    }
  }

  Future<void> stop() async {
    try {
      await _stt.stop();
    } catch (_) {}
    state = state.copyWith(listening: false);
  }
}

final voiceEntryProvider =
    StateNotifierProvider<VoiceEntryController, VoiceEntryState>((ref) {
  return VoiceEntryController();
});
