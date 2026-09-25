// ignore_for_file: inference_failure_on_collection_literal, require_trailing_commas

import 'package:flutter_test/flutter_test.dart';

import 'package:zolofund/data/models/approval.dart';
import 'package:zolofund/data/models/collection_entry.dart';
import 'package:zolofund/data/models/collection_run.dart';
import 'package:zolofund/data/models/customer.dart';
import 'package:zolofund/data/models/instalment.dart';
import 'package:zolofund/data/models/loan.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/models/vehicle.dart';
import 'package:zolofund/data/models/wallet.dart';
import 'package:zolofund/data/models/dashboard_summary.dart';

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
        'gpsTrackingEnabled': true,
      });

      expect(user.role, UserRole.agent);
      expect(user.totpEnabled, isTrue);
      expect(user.hasModule('collection'), isTrue);
      expect(user.tenantSlug, 'qa');
      expect(user.gpsTrackingEnabled, isTrue);
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
        String? frequency,
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
          frequency: frequency,
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
      for (final cadence in [
        'daily', 'weekly', 'biweekly', 'monthly',
        'single_payment', 'custom_duration',
      ]) {
        expect(row(
          id: cadence,
          dueDate: today,
          dueAmount: 100,
          receivedAmount: 0,
          status: 'upcoming',
          frequency: cadence,
        ).cadence, cadence);
      }
      expect(row(
        id: 'legacy',
        dueDate: today,
        dueAmount: 100,
        receivedAmount: 0,
        status: 'upcoming',
      ).cadence, 'daily');
    });

    test('MOB-MODEL-006 dashboard summary parses todayBreakdown and overdueBreakdown with fallbacks', () {
      final summaryWithBreakdowns = DashboardSummary.fromJson({
        'activeLoans': 10,
        'overdueLoans': 2,
        'totalCustomers': 15,
        'todayExpected': 5000,
        'todayCollected': 2500,
        'todayGap': 2500,
        'hitRate': 50,
        'todayBreakdown': {
          'total': {
            'expected': 5000,
            'collected': 2500,
            'remaining': 2500,
            'loanCount': 10,
            'customerCount': 8,
            'pct': 50,
          },
          'active': {
            'expected': 4000,
            'collected': 2000,
            'remaining': 2000,
            'loanCount': 8,
            'customerCount': 6,
            'pct': 50,
          },
          'inactive': {
            'expected': 1000,
            'collected': 500,
            'remaining': 500,
            'loanCount': 2,
            'customerCount': 2,
            'pct': 50,
          },
          'breakdown': {
            'daily': {
              'total': {'expected': 3000, 'collected': 1500, 'remaining': 1500, 'loanCount': 6, 'pct': 50},
              'active': {'expected': 2500, 'collected': 1200, 'remaining': 1300, 'loanCount': 5, 'pct': 48},
              'inactive': {'expected': 500, 'collected': 300, 'remaining': 200, 'loanCount': 1, 'pct': 60},
            },
          },
        },
        'overdueBreakdown': {
          'total': {
            'totalOverdue': 12000,
            'collectedToday': 3000,
            'remaining': 9000,
            'loanCount': 4,
            'customerCount': 4,
            'pct': 25,
          },
          'active': {
            'totalOverdue': 8000,
            'collectedToday': 2000,
            'remaining': 6000,
            'loanCount': 3,
            'customerCount': 3,
            'pct': 25,
          },
          'inactive': {
            'totalOverdue': 4000,
            'collectedToday': 1000,
            'remaining': 3000,
            'loanCount': 1,
            'customerCount': 1,
            'pct': 25,
          },
          'breakdown': {
            'weekly': {
              'total': {'totalOverdue': 6000, 'collectedToday': 1500, 'remaining': 4500, 'loanCount': 2, 'pct': 25},
              'active': {'totalOverdue': 4000, 'collectedToday': 1000, 'remaining': 3000, 'loanCount': 1, 'pct': 25},
              'inactive': {'totalOverdue': 2000, 'collectedToday': 500, 'remaining': 1500, 'loanCount': 1, 'pct': 25},
            },
          },
        },
      });

      expect(summaryWithBreakdowns.todayBreakdown.total.expected, 5000);
      expect(summaryWithBreakdowns.todayBreakdown.active.loanCount, 8);
      expect(summaryWithBreakdowns.todayBreakdown.breakdown['daily']?.active.remaining, 1300);
      expect(summaryWithBreakdowns.overdueBreakdown.total.totalOverdue, 12000);
      expect(summaryWithBreakdowns.overdueBreakdown.breakdown['weekly']?.total.remaining, 4500);

      // Fallback verification when breakdown payload is not provided
      final summaryWithFallback = DashboardSummary.fromJson({
        'todayExpected': 2000,
        'todayCollected': 1000,
        'todayGap': 1000,
        'hitRate': 50,
        'overdueTotalTillToday': 5000,
        'overdueCollectedToday': 1000,
        'overdueOutstanding': 4000,
      });

      expect(summaryWithFallback.todayBreakdown.total.expected, 2000);
      expect(summaryWithFallback.todayBreakdown.total.collected, 1000);
      expect(summaryWithFallback.todayBreakdown.total.remaining, 1000);
      expect(summaryWithFallback.overdueBreakdown.total.totalOverdue, 5000);
      expect(summaryWithFallback.overdueBreakdown.total.collectedToday, 1000);
      expect(summaryWithFallback.overdueBreakdown.total.remaining, 4000);
    });

    test('MOB-MODEL-009 KYC document parses backend Prisma format and API contract', () {
      final kycFromPrisma = KycDocument.fromJson({
        'id': 'k1',
        'docType': 'aadhaar',
        'fileName': 'aadhaar.jpg',
        'filePath': '/uploads/tenants/demo/aadhaar.jpg',
        'fileSize': 102400,
      });
      expect(kycFromPrisma.type, 'aadhaar');
      expect(kycFromPrisma.url, '/uploads/tenants/demo/aadhaar.jpg');
      expect(kycFromPrisma.fileName, 'aadhaar.jpg');

      final kycFromApi = KycDocument.fromJson({
        'id': 'k2',
        'type': 'pan',
        'fileName': 'pan.jpg',
        'url': '/api/files/demo/pan.jpg',
      });
      expect(kycFromApi.type, 'pan');
      expect(kycFromApi.url, '/api/files/demo/pan.jpg');
    });

    test('MOB-MODEL-010 Approval parses float shortage warning fields', () {
      final approval = Approval.fromJson({
        'id': 'appr-1',
        'entityType': 'loan',
        'action': 'create',
        'status': 'pending',
        'insufficientFloat': true,
        'createdAt': '2026-09-01T00:00:00.000Z',
        'agentFloat': 20000.0,
        'floatDeficit': 10000.0,
        'floatWarning': 'Agent float shortfall: available ₹20000, required ₹30000',
        'requestedChanges': {
          'principal': 30000,
        },
      });

      expect(approval.insufficientFloat, isTrue);
      expect(approval.agentFloat, 20000.0);
      expect(approval.floatDeficit, 10000.0);
      expect(approval.floatWarning, contains('shortfall'));
    });

    test('MOB-MODEL-011 Loan parses rich detail, metrics, and restructure', () {
      final loan = Loan.fromJson({
        'id': 'l-detail',
        'loanCode': 'ML-001',
        'customerId': 'c1',
        'principalAmount': 50000,
        'disbursedAmount': 47500,
        'interestRate': 12,
        'frequency': 'monthly',
        'status': 'active',
        'npaStatus': 'standard',
        'npaClassifiedAt': '2026-09-01T00:00:00.000Z',
        'paidCount': 3,
        'totalPayable': 56000,
        'totalCollected': 14000,
        'metrics': {
          'totalOutstanding': 42000,
          'overdueAmount': 0,
          'missedCount': 0,
          'paidCount': 3,
        },
        'restructure': {
          'restructuredRate': 4500,
          'arrears': 1000,
          'futureInstalmentsCount': 9,
          'isApplicable': true,
        },
        'payments': [
          {
            'id': 'p1',
            'amount': 4666,
            'paymentDate': '2026-07-01T00:00:00.000Z',
            'paymentMode': 'cash',
          }
        ],
        'guarantor': {
          'id': 'g1',
          'name': 'Ramesh Kumar',
          'phone': '9876543210',
          'relation': 'Brother',
        },
      });

      expect(loan.metrics?.totalOutstanding, 42000);
      expect(loan.metrics?.paidCount, 3);
      expect(loan.restructure?.restructuredRate, 4500);
      expect(loan.restructure?.isApplicable, isTrue);
      expect(loan.payments.length, 1);
      expect(loan.guarantor?.name, 'Ramesh Kumar');
    });
  });
}
