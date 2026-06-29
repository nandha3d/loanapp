// ignore_for_file: inference_failure_on_collection_literal, require_trailing_commas

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:loantrack/data/services/auth_service.dart';
import 'package:loantrack/data/services/collection_run_service.dart';
import 'package:loantrack/data/services/loan_service.dart';
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
      default:
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
  });
}
