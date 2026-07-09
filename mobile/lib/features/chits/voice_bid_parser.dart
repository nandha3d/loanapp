/// Pure, testable matching of a spoken bid ("Ramesh forty thousand") to a chit
/// member + amount. No Flutter deps so it can be unit-tested.
///
/// Amount reuses [parseVoiceEntry] verbatim (understands thousand/hazaar/lakh).
/// Name matching is tolerant to STT errors: honorifics are stripped, then each
/// member is scored by token overlap plus a normalized edit-distance similarity
/// on the closest token. Callers auto-apply only a high, unambiguous top match;
/// otherwise they show a "Did you mean?" chooser. Tap is always the fallback.
library;

import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/features/collection/voice_amount_parser.dart';

class VoiceBidCandidate {
  const VoiceBidCandidate({required this.member, required this.score});
  final ChitMember member;

  /// 0..1 name-match confidence.
  final double score;
}

class VoiceBidResult {
  const VoiceBidResult({
    required this.candidates,
    required this.raw,
    this.amount,
  });

  /// Members ranked by name-match score (best first). May be empty.
  final List<VoiceBidCandidate> candidates;
  final double? amount;
  final String raw;

  bool get hasAmount => amount != null && amount! > 0;
  VoiceBidCandidate? get best => candidates.isEmpty ? null : candidates.first;

  /// A confident, unambiguous match: strong top score AND a clear gap to #2.
  bool get isConfident {
    if (candidates.isEmpty) return false;
    final top = candidates.first.score;
    if (top < 0.62) return false;
    if (candidates.length == 1) return true;
    return top - candidates[1].score >= 0.18;
  }
}

const List<String> _honorifics = [
  'mr', 'mrs', 'ms', 'shri', 'sri', 'smt', 'thiru', 'thiruvalar', 'selvi',
  'kumari', 'sir', 'madam',
];

/// Lowercase, strip honorifics + non-letter noise, collapse whitespace.
List<String> _tokens(String s) {
  final cleaned = s
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z-￿\s]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return cleaned
      .split(' ')
      .where((w) => w.isNotEmpty && !_honorifics.contains(w))
      .toList();
}

int _levenshtein(String a, String b) {
  if (a == b) return 0;
  if (a.isEmpty) return b.length;
  if (b.isEmpty) return a.length;
  final prev = List<int>.generate(b.length + 1, (i) => i);
  final cur = List<int>.filled(b.length + 1, 0);
  for (var i = 0; i < a.length; i++) {
    cur[0] = i + 1;
    for (var j = 0; j < b.length; j++) {
      final cost = a.codeUnitAt(i) == b.codeUnitAt(j) ? 0 : 1;
      cur[j + 1] = [cur[j] + 1, prev[j + 1] + 1, prev[j] + cost]
          .reduce((x, y) => x < y ? x : y);
    }
    for (var k = 0; k <= b.length; k++) {
      prev[k] = cur[k];
    }
  }
  return prev[b.length];
}

/// Similarity 0..1 between two tokens (1 = identical).
double _sim(String a, String b) {
  if (a.isEmpty || b.isEmpty) return 0;
  final d = _levenshtein(a, b);
  final maxLen = a.length > b.length ? a.length : b.length;
  return 1 - d / maxLen;
}

/// Best similarity of [nameToken] against any spoken token.
double _bestTokenSim(String nameToken, List<String> spoken) {
  double best = 0;
  for (final s in spoken) {
    final sim = _sim(nameToken, s);
    if (sim > best) best = sim;
  }
  return best;
}

VoiceBidResult parseVoiceBid(String transcript, List<ChitMember> members) {
  final raw = transcript.trim();
  final amount = parseVoiceEntry(raw).amount;
  final spoken = _tokens(raw);

  final scored = <VoiceBidCandidate>[];
  for (final m in members) {
    final nameTokens = _tokens(m.customerName);
    if (nameTokens.isEmpty || spoken.isEmpty) {
      scored.add(VoiceBidCandidate(member: m, score: 0));
      continue;
    }
    // Average of each name token's best match against the spoken tokens; the
    // first name usually carries the match, so weight the best token higher.
    double sum = 0;
    double bestSingle = 0;
    for (final nt in nameTokens) {
      final s = _bestTokenSim(nt, spoken);
      sum += s;
      if (s > bestSingle) bestSingle = s;
    }
    final avg = sum / nameTokens.length;
    final score = (avg * 0.5) + (bestSingle * 0.5);
    scored.add(VoiceBidCandidate(member: m, score: score));
  }

  scored.sort((a, b) => b.score.compareTo(a.score));
  // Drop obvious non-matches from the suggestion list.
  final candidates = scored.where((c) => c.score > 0.3).toList();
  return VoiceBidResult(
    candidates: candidates.isEmpty ? scored.take(1).toList() : candidates,
    amount: amount,
    raw: raw,
  );
}
