import 'package:flutter_test/flutter_test.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';

void main() {
  test('staff capital is parsed and agent capital stays absent', () {
    expect(DashboardSummary.fromJson({'currentCapital': '1310.50'}).currentCapital, 1310.50);
    expect(DashboardSummary.fromJson({}).currentCapital, isNull);
  });
}
