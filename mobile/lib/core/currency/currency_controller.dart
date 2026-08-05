import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/l10n/app_strings.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/services/settings_service.dart';

class CurrencyController extends StateNotifier<String> {
  CurrencyController(this._settings) : super('₹') {
    _load();
  }

  final SettingsService _settings;

  Future<void> _load() async {
    try {
      final rows = await _settings.all();
      final sym = rows
          .firstWhere(
            (r) => r['key'] == 'currency_symbol',
            orElse: () => {'value': '₹'},
          )['value'] as String? ?? '₹';
      if (sym.isNotEmpty) state = sym;
    } catch (_) {}
  }
}

/// Holds the active currency symbol (e.g. '₹', '$', '€').
/// Defaults to '₹' and loads the tenant setting asynchronously.
final currencySymbolProvider =
    StateNotifierProvider<CurrencyController, String>(
  (ref) => CurrencyController(ref.read(settingsServiceProvider)),
);

/// Ready-to-use [NumberFormat] for currency display.
/// Reacts to both symbol changes and language changes.
final currencyFmtProvider = Provider<NumberFormat>((ref) {
  final sym = ref.watch(currencySymbolProvider);
  final lang = ref.watch(languageProvider);
  return NumberFormat.currency(
    locale: lang.formatLocale,
    symbol: sym,
    decimalDigits: 0,
  );
});
