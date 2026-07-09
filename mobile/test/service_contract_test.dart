// ignore_for_file: inference_failure_on_collection_literal, require_trailing_commas

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:loantrack/data/services/auth_service.dart';
import 'package:loantrack/data/services/borrower_service.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/data/services/collection_run_service.dart';
import 'package:loantrack/data/services/loan_service.dart';
import 'package:loantrack/data/services/nach_service.dart';
import 'package:loantrack/data/services/vehicles_service.dart';
import 'package:loantrack/data/services/wallet_service.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class _ContractAdapter implements HttpClientAdapter {
  final requests = <String>[];
  final requestBodies = <Map<String, dynamic>>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add('${options.method} ${options.path}');
    final bodyBytes = requestStream == null
        ? <int>[]
        : await requestStream.expand((chunk) => chunk).toList();
    if (bodyBytes.isNotEmpty) {
      final decoded = jsonDecode(utf8.decode(bodyBytes));
      if (decoded is Map<String, dynamic>) requestBodies.add(decoded);
    }
    final data = _responseFor(options);
    return ResponseBody.fromString(
      jsonEncode({'data': data, 'error': null}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  dynamic _responseFor(RequestOptions options) {
    switch (options.path) {
      case Endpoints.login:
        return {
          'token': 'token',
          'refreshToken': 'refresh',
          'user': {
            'id': 'u1',
            'name': 'Karthik',
            'phone': '9000000001',
            'username': 'karthik',
            'role': 'agent',
            'appType': 'microlending',
            'status': 'active',
            'totpEnabled': false,
            'enabledModules': ['collection'],
            'tenantSlug': 'qa'
          }
        };
      case Endpoints.walletMe:
        return {'balance': 2500, 'transactions': []};
      case Endpoints.borrowerLogin:
        return {'challengeToken': 'challenge'};
      case Endpoints.borrowerVerify:
        return {
          'token': 'borrower-token',
          'tenantSlug': 'qa',
          'customerId': 'cust1',
        };
      case Endpoints.borrowerLoans:
        return [
          {
            'id': 'loan1',
            'loanCode': 'DL-001',
            'status': 'active',
            'principalAmount': 10000,
            'totalPayable': 12000,
            'interestRate': 12,
            'tenure': 12,
            'frequency': 'monthly',
            'instalments': [],
          }
        ];
      case Endpoints.borrowerPay:
        return {'success': true};
      case Endpoints.nachMandate:
        return {
          'id': 'mandate1',
          'status': 'pending_auth',
          'accountHolderName': 'QA Borrower',
          'accountNumber': '1234567890',
          'ifscCode': 'HDFC0001234',
          'maxAmount': 1000,
          'authType': 'netbanking',
          'razorpayOrderId': 'order_1',
          'razorpayKeyId': 'rzp_test_1',
          'presentations': [],
        };
      case Endpoints.loans:
        if (options.method == 'POST') {
          return {
            'id': 'loan1',
            'loanCode': 'DL-001',
            'customerId': 'cust1',
            'principal': 30000,
            'disbursed': 27000,
            'interestRate': 3000,
            'frequency': 'daily',
            'status': 'active',
            'startDate': '2026-06-29T00:00:00.000Z',
            'totalInstalments': 100,
            'penaltyRate': 1.5,
            'instalments': [],
            'totalPayable': 33000,
            'totalCollected': 0,
            'perInstalment': 330,
          };
        }
        return [];
      case Endpoints.vehicles:
        if (options.method == 'POST') {
          return {
            'id': 'v2',
            'registrationNo': 'TN01QA0002',
            'make': 'TVS',
            'model': 'XL',
            'vehicleType': 'two_wheeler',
            'repoFlag': false
          };
        }
        return [
          {
            'id': 'v1',
            'registrationNo': 'TN01QA0001',
            'make': 'TVS',
            'model': 'XL',
            'vehicleType': 'two_wheeler',
            'repoFlag': false
          }
        ];
      case Endpoints.chits:
        if (options.method == 'POST') {
          return {
            'id': 'chit1',
            'name': 'QA Chit',
            'chitValue': 100000,
            'monthlyContrib': 5000,
            'totalMembers': 2,
            'durationMonths': 2,
            'status': 'draft',
            'startDate': '2026-07-01T00:00:00.000Z',
            'commissionPct': 5,
            '_count': {'members': 2, 'auctions': 0},
          };
        }
        return [
          {
            'id': 'chit1',
            'name': 'QA Chit',
            'chitValue': 100000,
            'monthlyContrib': 5000,
            'totalMembers': 2,
            'durationMonths': 2,
            'status': 'active',
            'startDate': '2026-07-01T00:00:00.000Z',
            'commissionPct': 5,
            '_count': {'members': 2, 'auctions': 1},
          }
        ];
      default:
        if (options.path == Endpoints.nachLoan('loan1')) {
          return null;
        }
        if (options.path == Endpoints.nachMandateCancel('mandate1')) {
          return {'id': 'mandate1', 'status': 'cancelled'};
        }
        if (options.path == Endpoints.chit('chit1')) {
          return {'id': 'chit1', 'status': 'active'};
        }
        if (options.path == Endpoints.chitActivate('chit1')) {
          return {'id': 'chit1', 'status': 'active'};
        }
        if (options.path == Endpoints.chitMembers('chit1')) {
          return [
            {
              'id': 'member1',
              'memberNumber': 1,
              'ticketNo': '1',
              'ticketShare': 1,
              'subscriberStatus': 'active',
              'agreementStatus': 'verified',
              'hasWon': false,
              'customer': {'name': 'QA Member', 'customerCode': 'C001'},
            }
          ];
        }
        if (options.path == Endpoints.chitMember('chit1', 'member1')) {
          return {'id': 'member1', 'ticketNo': '1A'};
        }
        if (options.path == Endpoints.chitMemberAgreement('chit1', 'member1')) {
          return {'id': 'member1', 'agreementStatus': 'verified'};
        }
        if (options.path == Endpoints.chitAuctions('chit1')) {
          return [
            {
              'id': 'auc1',
              'periodNumber': 1,
              'status': 'pending',
              'auctionDate': '2026-07-01T00:00:00.000Z',
              'payoutStatus': 'not_ready',
              'gstAmount': 0,
              'roundingIncome': 0,
              'bids': [],
              'attendance': [],
            }
          ];
        }
        if (options.path == Endpoints.chitAuctionBids('chit1', 'auc1')) {
          return {
            'id': 'bid1',
            'memberId': 'member1',
            'bidAmount': 80000,
            'bidDiscount': 20000,
            'bidTime': '2026-07-01T10:00:00.000Z',
            'status': 'valid',
          };
        }
        if (options.path == Endpoints.chitAuctionAttendance('chit1', 'auc1')) {
          return {'id': 'att1', 'memberId': 'member1', 'status': 'present'};
        }
        if (options.path == Endpoints.chitAuctionConfirm('chit1', 'auc1')) {
          return {'id': 'auc1', 'status': 'confirmed'};
        }
        if (options.path == Endpoints.chitAuctionSecurity('chit1', 'auc1')) {
          return {'id': 'sec1', 'status': 'approved'};
        }
        if (options.path == Endpoints.chitAuctionLive('chit1', 'auc1')) {
          return {
            'roomStatus': 'open',
            'secondsRemaining': 30,
            'bidCount': 1,
          };
        }
        if (options.path == Endpoints.chitAuctionRoom('chit1', 'auc1')) {
          return {'roomStatus': 'open'};
        }
        if (options.path == Endpoints.chitAuctionDraw('chit1', 'auc1')) {
          return {
            'auctionId': 'auc1',
            'winnerMemberId': 'member1',
            'drawEvidence': 'fixed seed',
          };
        }
        if (options.path == Endpoints.chitAuctionPayout('chit1', 'auc1')) {
          return {'receiptNo': 'CPO-BR-2026-000001'};
        }
        if (options.path == Endpoints.chitCancel('chit1')) {
          return {'id': 'chit1', 'status': 'cancelled'};
        }
        if (options.path == Endpoints.chitSubscriptions('chit1')) {
          return [
            {
              'id': 'sub1',
              'periodNumber': 1,
              'dueDate': '2026-07-01T00:00:00.000Z',
              'dueAmount': 500,
              'paidAmount': 0,
              'status': 'upcoming',
              'member': {
                'id': 'member1',
                'customer': {'name': 'QA Member'}
              },
            }
          ];
        }
        if (options.path == Endpoints.chitSubscriptionMiss('sub1')) {
          return {'id': 'sub1', 'status': 'missed'};
        }
        if (options.path == Endpoints.chitPayments('chit1')) {
          return {'id': 'sub1', 'status': 'paid'};
        }
        if (options.path == Endpoints.chitPenalties('chit1')) {
          if (options.method == 'POST') {
            return {'id': 'pen1', 'status': 'due'};
          }
          return [
            {'id': 'pen1', 'status': 'due', 'amount': 100}
          ];
        }
        if (options.path == Endpoints.chitPenaltyPay('chit1', 'pen1')) {
          return {'id': 'pen1', 'status': 'partial'};
        }
        if (options.path == Endpoints.chitPenaltyWaive('chit1', 'pen1')) {
          return {'id': 'pen1', 'status': 'waived'};
        }
        if (options.path == Endpoints.chitReceiptReverse('receipt1')) {
          return {'id': 'rev1', 'receiptType': 'reversal'};
        }
        if (options.path == Endpoints.dashboardVerifyUpi) {
          return {'success': true};
        }
        if (options.path == Endpoints.runSheet('run1')) {
          return {
            'run': {
              'id': 'run1',
              'status': 'open',
              'date': '2026-06-04',
              'expectedTotal': 100,
              'collectedTotal': 0,
              'cashCollected': 0,
              'digitalCollected': 0,
              'stopsExpected': 1,
              'stopsCollected': 0
            },
            'sheet': [
              {
                'stopSeq': 1,
                'customerId': 'c1',
                'name': 'QA Customer',
                'loanCode': 'DL-001',
                'instalmentId': 'i1',
                'instalmentNo': 1,
                'outstanding': 100,
                'overdue': false,
                'daysOverdue': 0
              }
            ]
          };
        }
        if (options.path == Endpoints.selfPayLink) {
          return {'payUrl': 'http://localhost/pay/self'};
        }
        return {};
    }
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('MOB-SERVICE contract tests', () {
    test('MOB-SVC-001 auth login unwraps v1 envelope and user modules',
        () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;

      final result = await AuthService(dio).login(
        username: 'karthik',
        password: 'agent123',
      );

      expect(result.token, 'token');
      expect(result.user?.hasModule('collection'), isTrue);
      expect(adapter.requests, contains('POST /auth/login'));
    });

    test('MOB-SVC-002 collection run sheet and self-pay routes are stable',
        () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;
      final service = CollectionRunService(dio);

      final sheet = await service.fetchSheet('run1');
      final link = await service.selfPayLink('i1');

      expect(sheet.rows.single.outstanding, 100);
      expect(link, contains('/pay/self'));
      expect(adapter.requests, contains('GET /collection/run/run1/sheet'));
      expect(adapter.requests, contains('POST /collection/self-pay/link'));
    });

    test('MOB-SVC-003 wallet and vehicles services unwrap list/detail data',
        () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;

      final wallet = await WalletService(dio).me();
      final vehicles = await VehiclesService(dio).fetchVehicles();
      final created = await VehiclesService(dio).create({
        'registrationNo': 'TN01QA0002',
        'make': 'TVS',
        'model': 'XL',
      });

      expect(wallet.balance, 2500);
      expect(vehicles.single.registrationNo, 'TN01QA0001');
      expect(created.id, 'v2');
    });

    test('MOB-SVC-004 loan create serializes property and product payloads',
        () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;
      final service = LoanService(dio);

      await service.create(
        customerId: 'cust1',
        principal: 30000,
        deduction: 3000,
        deductionType: 'upfront_fixed',
        tenure: 100,
        frequency: 'daily',
        startDate: DateTime.utc(2026, 6, 29),
        penaltyRate: 1.5,
        loanType: 'property',
        propertyCollateral: {
          'propertyType': 'residential',
          'marketValue': 500000,
          'address': 'Main Street',
        },
      );

      await service.create(
        customerId: 'cust1',
        principal: 30000,
        deduction: 3000,
        deductionType: 'upfront_fixed',
        tenure: 100,
        frequency: 'daily',
        startDate: DateTime.utc(2026, 6, 29),
        penaltyRate: 1.5,
        loanType: 'other',
        productItem: {
          'productName': 'LED TV',
          'brand': 'Acme',
          'dealerName': 'City Dealer',
          'invoiceNo': 'INV-1',
          'downPayment': 5000,
        },
      );

      expect(adapter.requests.where((r) => r == 'POST /loans').length, 2);
      expect(
        adapter.requestBodies.first['propertyCollateral'],
        containsPair('propertyType', 'residential'),
      );
      expect(
        adapter.requestBodies.first['propertyCollateral'],
        containsPair('marketValue', 500000),
      );
      expect(
        adapter.requestBodies.last['productItem'],
        containsPair('productName', 'LED TV'),
      );
      expect(
        adapter.requestBodies.last['productItem'],
        containsPair('downPayment', 5000),
      );
    });

    test('MOB-SVC-005 borrower portal uses v1 OTP and bearer endpoints',
        () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;
      final service = BorrowerService(dio);

      await service.login('9000000001');
      await service.verifyOtp('9000000001', '123456');
      final loans = await service.getLoans();
      await service.submitPayment(
        loanId: 'loan1',
        amount: 500,
        paymentMode: 'upi',
        referenceNumber: 'UPI123',
      );

      expect(loans.single.loanCode, 'DL-001');
      expect(adapter.requests, contains('POST /borrower/auth/login'));
      expect(adapter.requests, contains('POST /borrower/auth/verify'));
      expect(adapter.requests, contains('GET /borrower/loans'));
      expect(adapter.requests, contains('POST /borrower/pay'));
      expect(
        adapter.requestBodies.last,
        containsPair('referenceNumber', 'UPI123'),
      );
    });

    test('MOB-SVC-006 chit actions match backend payment contracts', () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;
      final service = ChitService(dio);

      await service.update('chit1', name: 'July Chit');
      final subscriptions = await service.subscriptions('chit1');
      await service.collectContribution(
        'chit1',
        memberId: 'member1',
        periodNumber: 1,
        amount: 500,
        paymentMode: 'cheque',
        idempotencyKey: 'chit-pay-1',
        referenceNo: 'CHQ-001',
      );
      await service.markMissed('sub1');
      await service.cancel('chit1');

      expect(subscriptions.single.memberName, 'QA Member');
      expect(adapter.requests, contains('PUT /chits/chit1'));
      expect(adapter.requests, contains('GET /chits/chit1/subscriptions'));
      expect(adapter.requests, contains('POST /chits/chit1/payments'));
      expect(adapter.requests, contains('POST /chits/subscriptions/sub1/miss'));
      expect(adapter.requests, contains('POST /chits/chit1/cancel'));
      expect(
        adapter.requestBodies.any(
          (body) =>
              body['memberId'] == 'member1' &&
              body['periodNumber'] == 1 &&
              body['amount'] == 500 &&
              body['mode'] == 'ADD_PAYMENT' &&
              body['paymentMode'] == 'cheque' &&
              body['idempotencyKey'] == 'chit-pay-1' &&
              body['referenceNo'] == 'CHQ-001',
        ),
        isTrue,
      );
    });

    test(
        'MOB-SVC-009 chit auction, security, payout, and penalty routes are stable',
        () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;
      final service = ChitService(dio);

      final created = await service.create(
        name: 'QA Chit',
        chitValue: 100000,
        monthlyContrib: 5000,
        totalMembers: 2,
        commissionPct: 5,
        startDate: '2026-07-01',
        memberIds: ['member1', 'member2'],
        auctionType: 'open_live',
        tieBreakRule: 'LOTTERY_AMONG_TIED',
      );
      final list = await service.list();
      final members = await service.members('chit1');
      final auctions = await service.auctions('chit1');
      await service.activate('chit1');
      await service.updateMember(
        'chit1',
        'member1',
        ticketNo: '1A',
        nomineeName: 'QA Nominee',
      );
      await service.updateAgreement(
        'chit1',
        'member1',
        status: 'verified',
      );
      final bid = await service.addBid(
        'chit1',
        'auc1',
        memberId: 'member1',
        bidAmount: 80000,
        bidDiscount: 20000,
      );
      await service.markAttendance('chit1', 'auc1', memberId: 'member1');
      await service.confirmAuction('chit1', 'auc1', winningBidId: 'bid1');
      await service.submitSecurity(
        'chit1',
        'auc1',
        securityType: 'guarantor',
        guarantorName: 'QA Guarantor',
      );
      await service.reviewSecurity('chit1', 'auc1', action: 'approve');
      final live = await service.liveState('chit1', 'auc1');
      final room = await service.roomAction(
        'chit1',
        'auc1',
        action: 'open',
        durationMinutes: 30,
        autoExtendSeconds: 60,
      );
      final draw = await service.drawWinner('chit1', 'auc1');
      await service.releasePayout('chit1', 'auc1', paymentMode: 'cash');
      final penalties = await service.penalties('chit1');
      await service.createPenalty(
        'chit1',
        memberId: 'member1',
        amount: 100,
        reason: 'late payment',
      );
      await service.payPenalty('chit1', 'pen1', amountPaid: 50);
      await service.waivePenalty('chit1', 'pen1', reason: 'manager waiver');
      await service.reverseReceipt('receipt1', reason: 'correction');

      expect(created['id'], 'chit1');
      expect(list.single.id, 'chit1');
      expect(members.single.customerName, 'QA Member');
      expect(auctions.single.id, 'auc1');
      expect(bid.id, 'bid1');
      expect(live['roomStatus'], 'open');
      expect(room['roomStatus'], 'open');
      expect(draw['winnerMemberId'], 'member1');
      expect(penalties.single['id'], 'pen1');
      expect(adapter.requests, contains('POST /chits'));
      expect(adapter.requests, contains('GET /chits'));
      expect(adapter.requests, contains('GET /chits/chit1/members'));
      expect(adapter.requests, contains('GET /chits/chit1/auctions'));
      expect(adapter.requests, contains('POST /chits/chit1/activate'));
      expect(adapter.requests, contains('PATCH /chits/chit1/members/member1'));
      expect(adapter.requests,
          contains('POST /chits/chit1/members/member1/agreement'));
      expect(
          adapter.requests, contains('POST /chits/chit1/auctions/auc1/bids'));
      expect(adapter.requests,
          contains('POST /chits/chit1/auctions/auc1/attendance'));
      expect(adapter.requests,
          contains('POST /chits/chit1/auctions/auc1/confirm'));
      expect(adapter.requests,
          contains('POST /chits/chit1/auctions/auc1/security'));
      expect(adapter.requests, contains('GET /chits/chit1/auctions/auc1/live'));
      expect(
          adapter.requests, contains('POST /chits/chit1/auctions/auc1/room'));
      expect(
          adapter.requests, contains('POST /chits/chit1/auctions/auc1/draw'));
      expect(
          adapter.requests, contains('POST /chits/chit1/auctions/auc1/payout'));
      expect(adapter.requests, contains('GET /chits/chit1/penalties'));
      expect(adapter.requests, contains('POST /chits/chit1/penalties'));
      expect(
          adapter.requests, contains('POST /chits/chit1/penalties/pen1/pay'));
      expect(
        adapter.requests,
        contains('POST /chits/chit1/penalties/pen1/waive'),
      );
      expect(
        adapter.requests,
        contains('POST /chits/receipts/receipt1/reverse'),
      );
      expect(
        adapter.requestBodies.any(
          (body) =>
              body['name'] == 'QA Chit' &&
              body['auctionType'] == 'open_live' &&
              body['tieBreakRule'] == 'LOTTERY_AMONG_TIED',
        ),
        isTrue,
      );
      expect(
        adapter.requestBodies.any(
          (body) =>
              body['memberId'] == 'member1' &&
              body['prizeAmount'] == 80000 &&
              body['bidDiscount'] == 20000,
        ),
        isTrue,
      );
      expect(
        adapter.requestBodies.any(
          (body) => body['action'] == 'open' && body['autoExtendSeconds'] == 60,
        ),
        isTrue,
      );
      expect(
        adapter.requestBodies.any(
          (body) => body['reason'] == 'correction',
        ),
        isTrue,
      );
    });

    test('MOB-SVC-007 dashboard verification uses action-based endpoint',
        () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;

      await dio.post<Map<String, dynamic>>(
        Endpoints.dashboardVerifyUpi,
        data: {
          'action': 'bulk-upi',
          'entryIds': ['entry1', 'entry2']
        },
      );
      await dio.post<Map<String, dynamic>>(
        Endpoints.dashboardCollectCash,
        data: {'action': 'collect-cash', 'routeId': 'route1', 'agentId': 'u1'},
      );

      expect(
        adapter.requests.where((r) => r == 'POST /collection/verify').length,
        2,
      );
      expect(adapter.requestBodies.first, containsPair('action', 'bulk-upi'));
      expect(adapter.requestBodies.last, containsPair('agentId', 'u1'));
    });

    test('MOB-SVC-008 NACH create/cancel routes unwrap mandate data', () async {
      final adapter = _ContractAdapter();
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'));
      dio.httpClientAdapter = adapter;
      final service = NachService(dio);

      final current = await service.getMandate('loan1');
      final created = await service.createMandate(
        loanId: 'loan1',
        customerId: 'cust1',
        accountHolderName: 'QA Borrower',
        accountNumber: '1234567890',
        ifscCode: 'HDFC0001234',
        accountType: 'savings',
        authType: 'netbanking',
        maxAmount: 1000,
      );
      await service.cancelMandate('mandate1', reason: 'customer request');

      expect(current, isNull);
      expect(created.razorpayOrderId, 'order_1');
      expect(adapter.requests, contains('GET /nach/loan/loan1'));
      expect(adapter.requests, contains('POST /nach/mandate'));
      expect(adapter.requests, contains('DELETE /nach/mandate/mandate1'));
    });
  });
}
