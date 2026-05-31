import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

/// One customer awaiting KYC review.
class KycQueueItem {
  const KycQueueItem({
    required this.id,
    required this.customerCode,
    required this.name,
    required this.phone,
    required this.kycStatus,
    required this.docCount,
    this.kycMethod,
    this.aadhaarVerified = false,
    this.agentName,
  });

  final String id;
  final String customerCode;
  final String name;
  final String phone;
  final String kycStatus;
  final String? kycMethod;
  final bool aadhaarVerified;
  final int docCount;
  final String? agentName;

  factory KycQueueItem.fromJson(Map<String, dynamic> j) {
    final count = (j['_count'] as Map<String, dynamic>?) ?? const {};
    final agent = (j['agent'] as Map<String, dynamic>?) ?? const {};
    return KycQueueItem(
      id: j['id'] as String,
      customerCode: (j['customerCode'] as String?) ?? '',
      name: (j['name'] as String?) ?? '—',
      phone: (j['phone'] as String?) ?? '',
      kycStatus: (j['kycStatus'] as String?) ?? 'pending',
      kycMethod: j['kycMethod'] as String?,
      aadhaarVerified: (j['aadhaarVerified'] as bool?) ?? false,
      docCount: (count['kycDocuments'] as num?)?.toInt() ?? 0,
      agentName: agent['name'] as String?,
    );
  }
}

class KycService {
  KycService(this._dio);
  final Dio _dio;

  Future<List<KycQueueItem>> queue() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.kycQueue);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => KycQueueItem.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  /// decision: 'verified' | 'rejected'. Reason required when rejecting.
  Future<void> review(String customerId, String decision, {String? reason}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.kycReview(customerId),
      data: {'decision': decision, if (reason != null) 'reason': reason},
    );
    unwrapEnvelope(res, (_) => null);
  }
}

final kycServiceProvider = Provider<KycService>(
  (ref) => KycService(ref.watch(dioProvider)),
);

final kycQueueProvider = FutureProvider.autoDispose<List<KycQueueItem>>((ref) {
  return ref.watch(kycServiceProvider).queue();
});
