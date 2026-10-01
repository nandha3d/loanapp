import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/api_exception.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/loan.dart';
import 'package:zolofund/data/models/loan_calc.dart';
import 'package:intl/intl.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class LoanService {
  LoanService(this._dio);
  final Dio _dio;

  Future<List<Map<String, dynamic>>> list({
    String? customerId,
    String? status,
    String? q,
    String? frequency,
    bool hideClosed = false,
  }) async {
    // The API is cursor-paginated (default 20, max 100 per page). Follow the
    // cursor and accumulate every page so the list shows ALL loans — previously
    // only the first 20 ever loaded, which is why the mobile list looked short
    // compared to the web. Page size is maxed out to minimise round-trips and a
    // hard page cap guards against an unbounded loop.
    final all = <Map<String, dynamic>>[];
    String? cursor;
    for (var page = 0; page < 50; page++) {
      final res = await _dio.get<Map<String, dynamic>>(
        Endpoints.loans,
        queryParameters: {
          if (customerId != null) 'customerId': customerId,
          if (status != null) 'status': status,
          if (q != null && q.isNotEmpty) 'q': q,
          if (frequency != null) 'frequency': frequency,
          // LOAN-01: closed loans are filtered on the server, as on web.
          if (hideClosed) 'hideClosed': '1',
          'limit': 100,
          if (cursor != null) 'cursor': cursor,
        },
      );
      final body = res.data;
      if (body is! Map<String, dynamic>) {
        throw ApiException('Malformed response', statusCode: res.statusCode);
      }
      final err = body['error'];
      if (err != null) {
        throw ApiException(
          err is String ? err : err.toString(),
          statusCode: res.statusCode,
        );
      }
      final pageRows = (body['data'] as List<dynamic>? ?? const <dynamic>[])
          .map((dynamic e) => e as Map<String, dynamic>)
          .toList(growable: false);
      all.addAll(pageRows);

      final pagination = body['pagination'] as Map<String, dynamic>?;
      final next = pagination?['nextCursor'] as String?;
      if (next == null || pageRows.isEmpty) break;
      cursor = next;
    }
    return all;
  }

  Future<Loan> getById(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.loan(id));
    return unwrapEnvelope(
      res,
      (dynamic d) => Loan.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Files an approval request to edit a loan (mirrors the web's approval-gated
  /// loan edit). Server computes the diff + guards schedule changes. Throws
  /// ApiException with the server message on rejection (e.g. has repayments).
  /// Admin direct edit — PUT /loans/[id], same as web LoanEditForm (LOAN-04).
  /// Sends the full term set; the server reschedules only when terms change.
  Future<void> update(String id, Map<String, dynamic> body) async {
    final res = await _dio.put<Map<String, dynamic>>(
      Endpoints.loan(id),
      data: body,
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<void> requestEdit(String id, Map<String, dynamic> changes) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.loan(id),
      data: changes,
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<LoanCalculation> calculate({
    required double principal,
    required double interestRate,
    required String interestType,
    required int tenure,
    required String frequency,
    required DateTime startDate,
    int? dueDay,
    DateTime? endDate,
    String? termType,
    int? termDays,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '${Endpoints.loans}/calculate',
      data: {
        'principal': principal,
        'interestRate': interestRate,
        'interestType': interestType,
        'tenure': tenure,
        'frequency': frequency,
        'startDate': DateFormat('yyyy-MM-dd').format(startDate),
        if (dueDay != null) 'dueDay': dueDay,
        if (endDate != null) 'endDate': DateFormat('yyyy-MM-dd').format(endDate),
        if (termType != null) 'termType': termType,
        if (termDays != null) 'termDays': termDays,
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
    double? penaltyRate,
    String loanType = 'cheque',
    String? collateralDetails,
    String? voucherRef,
    int? dueDay,
    DateTime? endDate,
    Map<String, dynamic>? guarantor,
    List<Map<String, dynamic>>? securityCheques,
    Map<String, dynamic>? goldCollateral,
    Map<String, dynamic>? propertyCollateral,
    Map<String, dynamic>? productItem,
    String? termType,
    int? termDays,
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
        'startDate': DateFormat('yyyy-MM-dd').format(startDate),
        if (penaltyRate != null) 'penaltyRate': penaltyRate,
        'loanType': loanType,
        if (collateralDetails != null) 'collateralDetails': collateralDetails,
        if (voucherRef != null) 'voucherRef': voucherRef,
        if (dueDay != null) 'dueDay': dueDay,
        if (endDate != null) 'endDate': DateFormat('yyyy-MM-dd').format(endDate),
        if (guarantor != null) 'guarantor': guarantor,
        if (securityCheques != null) 'securityCheques': securityCheques,
        if (goldCollateral != null) 'goldCollateral': goldCollateral,
        if (propertyCollateral != null)
          'propertyCollateral': propertyCollateral,
        if (productItem != null) 'productItem': productItem,
        if (termType != null) 'termType': termType,
        if (termDays != null) 'termDays': termDays,
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => Loan.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<void> performAction(
    String id,
    String action, {
    Map<String, dynamic>? data,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '${Endpoints.loans}/$id/$action',
      data: data,
    );
    unwrapEnvelope(res, (_) => null);
  }

  Future<List<int>> statementPdf(String loanId) async {
    final res = await _dio.get<List<int>>(
      '${Endpoints.loans}/$loanId/statement',
      options: Options(responseType: ResponseType.bytes),
    );
    return unwrapPdfBytes(res);
  }
}

final loanServiceProvider = Provider<LoanService>(
  (ref) => LoanService(ref.watch(dioProvider)),
);
