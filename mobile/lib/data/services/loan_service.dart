import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/loan.dart';
import 'package:loantrack/data/models/loan_calc.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class LoanService {
  LoanService(this._dio);
  final Dio _dio;

  Future<List<Map<String, dynamic>>> list({String? customerId, String? status}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.loans,
      queryParameters: {
        if (customerId != null) 'customerId': customerId,
        if (status != null) 'status': status,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => e as Map<String, dynamic>)
          .toList(growable: false);
    });
  }

  Future<Loan> getById(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.loan(id));
    return unwrapEnvelope(
      res,
      (dynamic d) => Loan.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<LoanCalculation> calculate({
    required double principal,
    required double interestRate,
    required String interestType,
    required int tenure,
    required String frequency,
    required DateTime startDate,
    int? dueDay,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '${Endpoints.loans}/calculate',
      data: {
        'principal': principal,
        'interestRate': interestRate,
        'interestType': interestType,
        'tenure': tenure,
        'frequency': frequency,
        'startDate': startDate.toIso8601String(),
        if (dueDay != null) 'dueDay': dueDay,
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => LoanCalculation.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<Loan> create({
    required String customerId,
    required double principal,
    required double deduction,
    required String deductionType,
    required int tenure,
    required String frequency,
    required DateTime startDate,
    required double penaltyRate,
    String loanType = 'cheque',
    String? collateralDetails,
    String? voucherRef,
    int? dueDay,
    Map<String, dynamic>? guarantor,
    List<Map<String, dynamic>>? securityCheques,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.loans,
      data: {
        'customerId': customerId,
        'principal': principal,
        'deduction': deduction,
        'deductionType': deductionType,
        'tenure': tenure,
        'frequency': frequency,
        'startDate': startDate.toIso8601String(),
        'penaltyRate': penaltyRate,
        'loanType': loanType,
        if (collateralDetails != null) 'collateralDetails': collateralDetails,
        if (voucherRef != null) 'voucherRef': voucherRef,
        if (dueDay != null) 'dueDay': dueDay,
        if (guarantor != null) 'guarantor': guarantor,
        if (securityCheques != null) 'securityCheques': securityCheques,
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => Loan.fromJson(d as Map<String, dynamic>),
    );
  }
}

final loanServiceProvider = Provider<LoanService>(
  (ref) => LoanService(ref.watch(dioProvider)),
);
