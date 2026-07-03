import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/nach.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class NachService {
  NachService(this._dio);
  final Dio _dio;

  /// Fetch the active mandate for a loan (if any).
  Future<NachMandate?> getMandate(String loanId) async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.nachLoan(loanId));
    return unwrapEnvelope(res, (dynamic d) {
      if (d == null) return null;
      return NachMandate.fromJson(d as Map<String, dynamic>);
    });
  }

  /// Register a new e-NACH mandate. Returns the created mandate (which may
  /// include a `razorpayOrderId` + `razorpayKeyId` for checkout).
  Future<NachMandate> createMandate({
    required String loanId,
    required String customerId,
    required String accountHolderName,
    required String accountNumber,
    required String ifscCode,
    required String accountType,
    required String authType,
    required double maxAmount,
    String? bankName,
    String? customerPhone,
    String? customerEmail,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.nachMandate,
      data: {
        'loanId': loanId,
        'customerId': customerId,
        'accountHolderName': accountHolderName,
        'accountNumber': accountNumber,
        'ifscCode': ifscCode,
        'accountType': accountType,
        'authType': authType,
        'maxAmount': maxAmount,
        if (bankName != null && bankName.isNotEmpty) 'bankName': bankName,
        if (customerPhone != null) 'customerPhone': customerPhone,
        if (customerEmail != null) 'customerEmail': customerEmail,
      },
    );
    return unwrapEnvelope(
        res, (dynamic d) => NachMandate.fromJson(d as Map<String, dynamic>));
  }

  /// Cancel an existing mandate.
  Future<void> cancelMandate(String mandateId, {String? reason}) async {
    final res = await _dio.delete<Map<String, dynamic>>(
      Endpoints.nachMandateCancel(mandateId),
      data: {if (reason != null) 'reason': reason},
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final nachServiceProvider = Provider<NachService>(
  (ref) => NachService(ref.watch(dioProvider)),
);
