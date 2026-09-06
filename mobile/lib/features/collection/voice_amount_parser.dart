/// Pure, testable parsing of a spoken collection phrase into an amount + an
/// optional payment mode. No Flutter/engine deps so it can be unit-tested.
///
/// Strategy (best-effort, never throws):
///  1. Indian speech engines usually return the amount as numerals
///     ("collect 5000 cash"), so the primary path extracts digit groups.
///  2. As a convenience we also understand English scale words
///     (hundred/thousand/k/lakh) — e.g. "five thousand" → 5000.
///  3. Payment mode is matched against caller-supplied synonym lists, which
///     come from the i18n table (kStrings: voice.kw.cash / .upi / .bank) so the
///     keywords are translatable and NOT hardcoded in the UI.
library;

class VoiceParseResult {
  const VoiceParseResult({this.amount, this.mode, required this.raw});

  /// Parsed rupee amount, or null if nothing usable was heard.
  final double? amount;

  /// 'cash' | 'upi' | 'bank', or null if no mode keyword matched.
  final String? mode;

  /// The original transcript (for display / readback / debugging).
  final String raw;

  bool get hasAmount => amount != null && amount! > 0;
}

// English number words (0-19, tens) and scale multipliers. Linguistic logic,
// not a business value — safe to keep in code. Extend per language over time.
const Map<String, int> _units = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11,
  'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16,
  'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
};
const Map<String, int> _tens = {
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
};
// Scale words → multiplier. 'k' is colloquial for thousand.
const Map<String, int> _scales = {
  'hundred': 100, 'sau': 100,
  'thousand': 1000, 'k': 1000, 'hazaar': 1000, 'hajaar': 1000,
  'lakh': 100000, 'lac': 100000, 'laksh': 100000,
};

/// Parse [transcript]. [modeSynonyms] maps a mode key ('cash'|'upi'|'bank') to
/// a list of lowercase keywords (from i18n). Either may be empty.
VoiceParseResult parseVoiceEntry(
  String transcript, {
  Map<String, List<String>> modeSynonyms = const {},
}) {
  final raw = transcript.trim();
  final lower = raw.toLowerCase();

  final amount = _extractAmount(lower);
  final mode = _extractMode(lower, modeSynonyms);

  return VoiceParseResult(amount: amount, mode: mode, raw: raw);
}

double? _extractAmount(String lower) {
  // 1. Direct numerals win (strip separators): "5,000" / "5000".
  final numMatch = RegExp(r'(\d[\d,]*)').firstMatch(lower);
  if (numMatch != null) {
    final digits = numMatch.group(1)!.replaceAll(',', '');
    final n = double.tryParse(digits);
    if (n != null && n > 0) {
      // Honour a trailing scale word after the number ("5 thousand", "2 lakh").
      final after = lower.substring(numMatch.end).trimLeft().split(RegExp(r'\s+'));
      if (after.isNotEmpty && _scales.containsKey(after.first)) {
        return n * _scales[after.first]!;
      }
      return n;
    }
  }

  // 2. Word numbers ("five thousand", "twenty five hundred").
  final words = lower.split(RegExp(r'[^a-z]+')).where((w) => w.isNotEmpty);
  double total = 0;
  double current = 0;
  bool sawAny = false;
  for (final w in words) {
    if (_units.containsKey(w)) {
      current += _units[w]!;
      sawAny = true;
    } else if (_tens.containsKey(w)) {
      current += _tens[w]!;
      sawAny = true;
    } else if (_scales.containsKey(w)) {
      final mult = _scales[w]!;
      if (current == 0) current = 1; // "thousand" alone = 1000
      if (mult >= 1000) {
        total = (total + current) * mult;
        current = 0;
      } else {
        current *= mult;
      }
      sawAny = true;
    }
  }
  final result = total + current;
  if (sawAny && result > 0) return result;

  return null;
}

String? _extractMode(String lower, Map<String, List<String>> synonyms) {
  for (final entry in synonyms.entries) {
    for (final kw in entry.value) {
      final k = kw.trim().toLowerCase();
      if (k.isEmpty) continue;
      if (RegExp(r'\b' + RegExp.escape(k) + r'\b').hasMatch(lower)) {
        return entry.key;
      }
    }
  }
  return null;
}
