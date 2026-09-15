import 'package:flutter_test/flutter_test.dart';
import 'package:zolofund/features/collection/voice_amount_parser.dart';

void main() {
  const synonyms = <String, List<String>>{
    'cash': ['cash', 'nagad'],
    'upi': ['upi', 'gpay', 'phonepe'],
    'bank': ['bank', 'neft'],
  };

  group('parseVoiceEntry — amounts', () {
    test('plain numerals', () {
      expect(parseVoiceEntry('5000').amount, 5000);
      expect(parseVoiceEntry('collect 250 rupees').amount, 250);
    });

    test('numerals with separators', () {
      expect(parseVoiceEntry('5,000 cash', modeSynonyms: synonyms).amount, 5000);
    });

    test('number + trailing scale word', () {
      expect(parseVoiceEntry('5 thousand').amount, 5000);
      expect(parseVoiceEntry('2 lakh').amount, 200000);
    });

    test('english word numbers', () {
      expect(parseVoiceEntry('five thousand').amount, 5000);
      expect(parseVoiceEntry('twenty five hundred').amount, 2500);
      expect(parseVoiceEntry('thousand').amount, 1000);
    });

    test('no amount → null', () {
      expect(parseVoiceEntry('hello there').amount, isNull);
      expect(parseVoiceEntry('').hasAmount, isFalse);
    });
  });

  group('parseVoiceEntry — mode', () {
    test('detects cash / upi / bank from synonyms', () {
      expect(parseVoiceEntry('5000 cash', modeSynonyms: synonyms).mode, 'cash');
      expect(parseVoiceEntry('paid 300 gpay', modeSynonyms: synonyms).mode, 'upi');
      expect(parseVoiceEntry('1000 neft', modeSynonyms: synonyms).mode, 'bank');
    });

    test('no mode keyword → null', () {
      expect(parseVoiceEntry('5000', modeSynonyms: synonyms).mode, isNull);
    });

    test('word-boundary match avoids false positives', () {
      // "casual" must not match "cash"
      expect(parseVoiceEntry('casual 500', modeSynonyms: synonyms).mode, isNull);
    });
  });

  test('combined amount + mode', () {
    final r = parseVoiceEntry('five thousand cash', modeSynonyms: synonyms);
    expect(r.amount, 5000);
    expect(r.mode, 'cash');
    expect(r.hasAmount, isTrue);
  });
}
