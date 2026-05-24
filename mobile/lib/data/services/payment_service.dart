import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class PaymentQrData {
  const PaymentQrData({this.upiId, this.qrUrl});
  final String? upiId;
  final String? qrUrl;
}

final paymentQrProvider = FutureProvider<PaymentQrData>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.paymentQr);
  return unwrapEnvelope(res, (dynamic d) {
    final map = d as Map<String, dynamic>;
    return PaymentQrData(
      upiId: map['upiId'] as String?,
      qrUrl: map['qrUrl'] as String?,
    );
  });
});
