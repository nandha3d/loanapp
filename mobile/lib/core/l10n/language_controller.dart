import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:zolofund/core/l10n/app_strings.dart';

const _kPrefsBox = 'prefs';
const _kLangKey = 'app_language';

/// Resolves current [AppLang] and translation lookup.
class LanguageController extends StateNotifier<AppLang> {
  LanguageController() : super(AppLang.en) {
    _hydrate();
  }

  Future<void> _hydrate() async {
    final box = await _openBox();
    final code = box.get(_kLangKey) as String?;
    if (!mounted) return;
    state = AppLangX.fromCode(code);
  }

  Future<Box<dynamic>> _openBox() async {
    if (Hive.isBoxOpen(_kPrefsBox)) {
      return Hive.box(_kPrefsBox);
    }
    return Hive.openBox(_kPrefsBox);
  }

  Future<void> set(AppLang lang) async {
    state = lang;
    final box = await _openBox();
    await box.put(_kLangKey, lang.code);
  }
}

final languageProvider =
    StateNotifierProvider<LanguageController, AppLang>((ref) {
  return LanguageController();
});

/// Translation accessor.
class T {
  T._(this.lang);
  final AppLang lang;

  static T of(WidgetRef ref) => T._(ref.watch(languageProvider));
  static T watch(BuildContext context, WidgetRef ref) =>
      T._(ref.watch(languageProvider));

  /// Returns the translated string for [key]. Falls back to English,
  /// then to the key itself if missing.
  String x(String key) {
    final entry = kStrings[key];
    if (entry == null) return key;
    return entry[lang.code] ?? entry['en'] ?? key;
  }
}
