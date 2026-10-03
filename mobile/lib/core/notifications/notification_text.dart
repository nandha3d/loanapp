import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

import 'package:zolofund/core/l10n/app_strings.dart';

/// Renders a server notification in the device language.
///
/// The server ships an i18n key plus pre-formatted `params` (money and counts
/// are formatted there — STABLE-8) next to the English `title`/`message`. A
/// missing key or locale falls back to that English text, so legacy rows and
/// pushes keep working untouched.
String localizeNotificationText({
  required String? key,
  required String fallback,
  required Map<String, dynamic>? params,
  required String langCode,
}) {
  if (key == null || key.isEmpty) return fallback;
  final entry = kStrings[key];
  if (entry == null) return fallback;
  var text = entry[langCode] ?? entry['en'];
  if (text == null) return fallback;
  params?.forEach((k, v) {
    text = text!.replaceAll('{$k}', '${v ?? ''}');
  });
  return text!;
}

/// `params` arrives as a JSON object (API) or a JSON string (FCM data map).
Map<String, dynamic>? decodeNotificationParams(Object? raw) {
  if (raw is Map) return Map<String, dynamic>.from(raw);
  if (raw is String && raw.isNotEmpty) {
    try {
      final d = jsonDecode(raw);
      if (d is Map) return Map<String, dynamic>.from(d);
    } catch (_) {}
  }
  return null;
}

/// Language code for contexts with no Riverpod (background FCM isolate).
/// Reads the same Hive box LanguageController writes.
Future<String> readStoredLanguageCode() async {
  try {
    await Hive.initFlutter();
    final box = Hive.isBoxOpen('prefs') ? Hive.box<dynamic>('prefs') : await Hive.openBox<dynamic>('prefs');
    return AppLangX.fromCode(box.get('app_language') as String?).code;
  } catch (_) {
    return 'en';
  }
}
