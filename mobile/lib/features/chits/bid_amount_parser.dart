/// Pure, testable parsing of a spoken bid amount into a rupee value —
/// English + Tamil. Separate from collection's voice_amount_parser.dart
/// because bids need no payment-mode detection, and Tamil numeral words are
/// specific to this feature (the design doc's "prize four lakh fifty
/// thousand" / "பரிசுத் தொகை நான்கு லட்சத்து ஐம்பதாயிரம்" examples).
/// Best-effort, never throws — an unparsed transcript just falls back to
/// manual entry in the UI.
library;

class BidAmountParseResult {
  const BidAmountParseResult({this.amount, required this.raw});

  /// Parsed rupee amount, or null if nothing usable was heard.
  final double? amount;

  /// The original transcript (for display / readback / debugging).
  final String raw;

  bool get hasAmount => amount != null && amount! > 0;
}

const Map<String, int> _enUnits = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11,
  'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16,
  'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
};
const Map<String, int> _enTens = {
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
};
const Map<String, int> _enScales = {
  'hundred': 100, 'sau': 100,
  'thousand': 1000, 'k': 1000, 'hazaar': 1000, 'hajaar': 1000,
  'lakh': 100000, 'lac': 100000, 'laksh': 100000,
};

// Tamil number words. Compound amounts are often spoken as fused single
// words (e.g. "ஐம்பதாயிரம்" = ஐம்பது + ஆயிரம், "fifty-thousand") rather than
// space-separated — covered by _taFusedThousands below rather than a full
// morphological decomposer.
const Map<String, int> _taUnits = {
  'ஒன்று': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5,
  'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
  'பதினொன்று': 11, 'பன்னிரண்டு': 12,
};
const Map<String, int> _taTens = {
  'இருபது': 20, 'முப்பது': 30, 'நாற்பது': 40, 'ஐம்பது': 50,
  'அறுபது': 60, 'எழுபது': 70, 'எண்பது': 80, 'தொண்ணூறு': 90,
};
const Map<String, int> _taScales = {
  'நூறு': 100,
  'ஆயிரம்': 1000, 'ஆயிரத்து': 1000,
  'லட்சம்': 100000, 'லட்சத்து': 100000, 'இலட்சம்': 100000,
};
const Map<String, int> _taFusedThousands = {
  'பத்தாயிரம்': 10000, 'இருபதாயிரம்': 20000, 'முப்பதாயிரம்': 30000,
  'நாற்பதாயிரம்': 40000, 'ஐம்பதாயிரம்': 50000, 'அறுபதாயிரம்': 60000,
  'எழுபதாயிரம்': 70000, 'எண்பதாயிரம்': 80000, 'தொண்ணூறாயிரம்': 90000,
};

BidAmountParseResult parseBidAmount(String transcript) {
  final raw = transcript.trim();
  final lower = raw.toLowerCase();

  final direct = _extractNumeral(lower);
  if (direct != null) return BidAmountParseResult(amount: direct, raw: raw);

  final en = _extractEnglishWords(lower);
  if (en != null) return BidAmountParseResult(amount: en, raw: raw);

  final ta = _extractTamilWords(raw);
  if (ta != null) return BidAmountParseResult(amount: ta, raw: raw);

  return BidAmountParseResult(amount: null, raw: raw);
}

double? _extractNumeral(String lower) {
  // Digit groups win outright: "5,00,000" / "500000". Indian STT engines
  // usually return spoken amounts this way already.
  final numMatch = RegExp(r'(\d[\d,]*)').firstMatch(lower);
  if (numMatch == null) return null;
  final digits = numMatch.group(1)!.replaceAll(',', '');
  final n = double.tryParse(digits);
  if (n == null || n <= 0) return null;

  // Honour a trailing scale word in either language ("5 lakh", "5 லட்சம்").
  final after = lower.substring(numMatch.end).trimLeft().split(RegExp(r'\s+'));
  if (after.isNotEmpty) {
    final word = after.first;
    if (_enScales.containsKey(word)) return n * _enScales[word]!;
    if (_taScales.containsKey(word)) return n * _taScales[word]!;
  }
  return n;
}

double? _extractEnglishWords(String lower) {
  final words = lower.split(RegExp(r'[^a-z]+')).where((w) => w.isNotEmpty);
  double total = 0;
  double current = 0;
  bool sawAny = false;
  for (final w in words) {
    if (_enUnits.containsKey(w)) {
      current += _enUnits[w]!;
      sawAny = true;
    } else if (_enTens.containsKey(w)) {
      current += _enTens[w]!;
      sawAny = true;
    } else if (_enScales.containsKey(w)) {
      final mult = _enScales[w]!;
      if (current == 0) current = 1;
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
  return (sawAny && result > 0) ? result : null;
}

double? _extractTamilWords(String text) {
  final words = text.split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  double total = 0;
  double current = 0;
  bool sawAny = false;
  for (final w in words) {
    if (_taFusedThousands.containsKey(w)) {
      total += current + _taFusedThousands[w]!;
      current = 0;
      sawAny = true;
    } else if (_taUnits.containsKey(w)) {
      current += _taUnits[w]!;
      sawAny = true;
    } else if (_taTens.containsKey(w)) {
      current += _taTens[w]!;
      sawAny = true;
    } else if (_taScales.containsKey(w)) {
      final mult = _taScales[w]!;
      if (current == 0) current = 1;
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
  return (sawAny && result > 0) ? result : null;
}
