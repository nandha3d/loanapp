import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/nach.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class NachLoanInfo {
  const NachLoanInfo({this.mandate, this.isSubscribed = true});
  final NachMandate? mandate;
  final bool isSubscribed;
}

class NachService {
  NachService(this._dio);
  final Dio _dio;

  /// Fetch full mandate info for a loan (mandate + subscription status).
  Future<NachLoanInfo> getLoanMandateInfo(String loanId) async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.nachLoan(loanId));
    final body = res.data ?? const <String, dynamic>{};
    final isSub = body['isSubscribed'] == true || body['enabled'] == true;
    final d = body['data'];
    final mandate = d != null && d is Map<String, dynamic>
        ? NachMandate.fromJson(d)
        : null;
    return NachLoanInfo(mandate: mandate, isSubscribed: isSub);
  }

  /// Fetch the active mandate for a loan (if any).
  Future<NachMandate?> getMandate(String loanId) async {
    final info = await getLoanMandateInfo(loanId);
    return info.mandate;
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
        res, (dynamic d) => NachMandate.fromJson(d as Map<String, dynamic>),);
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
