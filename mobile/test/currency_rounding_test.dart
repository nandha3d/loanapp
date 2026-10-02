import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';

/// DEC-03: mobile and web both show whole rupees, half away from zero.
void main() {
  test('whole-rupee display rounds like the web formatCurrency', () {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: 'Rs ', decimalDigits: 0);
    expect(fmt.format(0.5), 'Rs 1');
    expect(fmt.format(2.5), 'Rs 3');
    expect(fmt.format(1250.5), 'Rs 1,251');
  });
}
