// ignore_for_file: inference_failure_on_collection_literal, require_trailing_commas

import 'package:flutter_test/flutter_test.dart';

import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/models/collection_run.dart';
import 'package:loantrack/data/models/customer.dart';
import 'package:loantrack/data/models/instalment.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/models/vehicle.dart';
import 'package:loantrack/data/models/wallet.dart';

void main() {
  group('MOB-MODEL contract tests', () {
    test('MOB-MODEL-001 user parses role, modules, and tenant slug', () {
      final user = User.fromJson({
        'id': 'u1',
        'name': 'Karthik',
        'phone': '9000000001',
        'username': 'karthik',
        'role': 'agent',
        'appType': 'microlending',
        'status': 'active',
        'totpEnabled': true,
        'enabledModules': ['customers', 'collection'],
        'tenantSlug': 'qa',
      });

      expect(user.role, UserRole.agent);
      expect(user.totpEnabled, isTrue);
      expect(user.hasModule('collection'), isTrue);
      expect(user.tenantSlug, 'qa');
    });

    test('MOB-MODEL-002 customer parses KYC, route, agent, and credit score',
        () {
      final customer = Customer.fromJson({
        'id': 'c1',
        'customerCode': 'ML-C-001',
        'name': 'QA Customer',
        'phone': '9111111111',
        'status': 'active',
        'aadharNumber': 'XXXX XXXX 9012',
        'kycStatus': 'verified',
        'route': {'name': 'Route A'},
        'agent': {'name': 'Karthik'},
        'creditScore': {
          'score': 780,
          'grade': 'Excellent',
          'stats': {'totalBorrowed': 10000, 'totalPaid': 9000}
        },
        'kycDocuments': [
          {'id': 'k1', 'type': 'aadhaar', 'url': '/files/aadhaar.png'}
        ],
        'guarantors': [],
        'loans': [],
      });

      expect(customer.initials, 'QC');
      expect(customer.kycStatus, 'verified');
      expect(customer.routeName, 'Route A');
      expect(customer.creditScore?.rated, isTrue);
    });

    test('MOB-MODEL-003 loan and instalment parse financial fields', () {
      final loan = Loan.fromJson({
        'id': 'l1',
        'loanCode': 'DL-001',
        'customerId': 'c1',
        'principalAmount': '10000',
        'disbursedAmount': 9500,
        'interestRate': 2,
        'frequency': 'daily',
        'status': 'active',
        'startDate': '2026-06-01T00:00:00.000Z',
        'instalmentCount': 10,
        'penaltyRate': 20,
        'totalPayable': 11000,
        'totalCollected': 1000,
        'perInstalment': 1100,
        'instalments': [
          {
            'id': 'i1',
            'loanId': 'l1',
            'instalmentNo': 1,
            'dueDate': '2026-06-02T00:00:00.000Z',
            'dueAmount': 1100,
            'receivedAmount': 1100,
            'status': 'paid'
          }
        ],
      });

      expect(loan.principalAmount, 10000);
      expect(loan.disbursedAmount, 9500);
      expect(loan.instalments.single.dynamicStatus, 'paid');
    });

    test('MOB-MODEL-004 collection run lock and wallet/vehicle parsing', () {
      final run = CollectionRun.fromJson({
        'id': 'run1',
        'status': 'reconciled',
        'date': '2026-06-04',
        'expectedTotal': '2000',
        'collectedTotal': 1900,
        'cashCollected': 1200,
        'digitalCollected': 700,
        'stopsExpected': 5,
        'stopsCollected': 4,
      });
      final txn = WalletTxn.fromJson({
        'id': 'w1',
        'type': 'collection',
        'amount': 500,
        'balanceAfter': 1500,
        'createdAt': '2026-06-04T00:00:00.000Z',
      });
      final vehicle = Vehicle.fromJson({
        'id': 'v1',
        'registrationNo': 'TN01QA0001',
        'make': 'TVS',
        'model': 'XL',
        'vehicleType': 'two_wheeler',
        'repoFlag': true,
      });

      expect(run.isLocked, isTrue);
      expect(txn.isCredit, isTrue);
      expect(vehicle.repoFlag, isTrue);
      expect(
          Instalment.fromJson({
            'id': 'i2',
            'loanId': 'l1',
            'instalmentNo': 2,
            'dueDate': '2099-01-01T00:00:00.000Z',
            'dueAmount': 100,
            'status': 'upcoming',
          }).dynamicStatus,
          'upcoming');
    });

    test('MOB-MODEL-005 collection row bucket helpers stay in sync', () {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day, 9);
      final past = today.subtract(const Duration(days: 2));

      CollectionRow row({
        required String id,
        required DateTime dueDate,
        required double dueAmount,
        required double receivedAmount,
        required String status,
      }) {
        return CollectionRow(
          instalmentId: id,
          loanId: 'loan-$id',
          loanCode: 'LN-$id',
          customerId: 'cust-$id',
          customerName: 'Customer $id',
          customerCode: 'C-$id',
          customerPhone: '9000000000',
          routeName: 'Route A',
          dueAmount: dueAmount,
          receivedAmount: receivedAmount,
          dueDate: dueDate,
          status: status,
        );
      }

      final todayPartial = row(
        id: 'today',
        dueDate: today,
        dueAmount: 1000,
        receivedAmount: 400,
        status: 'partial',
      );
      final overduePartial = row(
        id: 'overdue',
        dueDate: past,
        dueAmount: 800,
        receivedAmount: 300,
        status: 'partial',
      );
      final overduePaid = row(
        id: 'paid',
        dueDate: past,
        dueAmount: 500,
        receivedAmount: 500,
        status: 'paid',
      );

      expect(todayPartial.isTodayBucket, isTrue);
      expect(todayPartial.todayOutstanding, 600);
      expect(todayPartial.overdueOutstanding, 0);
      expect(overduePartial.isOverdueBucket, isTrue);
      expect(overduePartial.todayOutstanding, 0);
      expect(overduePartial.overdueOutstanding, 500);
      expect(overduePaid.isResolved, isTrue);
      expect(overduePaid.overdueOutstanding, 0);
    });
  });
}
