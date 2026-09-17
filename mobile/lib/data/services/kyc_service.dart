import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class KycSession {
  const KycSession({
    required this.id,
    required this.method,
    required this.status,
    this.responseData,
    this.videoFilePath,
    this.videoFileName,
  });

  final String id;
  final String method;
  final String status;
  final String? responseData;
  final String? videoFilePath;
  final String? videoFileName;

  factory KycSession.fromJson(Map<String, dynamic> json) {
    return KycSession(
      id: json['id'] as String,
      method: json['method'] as String,
      status: json['status'] as String,
      responseData: json['responseData'] as String?,
      videoFilePath: json['videoFilePath'] as String?,
      videoFileName: json['videoFileName'] as String?,
    );
  }
}

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
    this.kycSessions = const [],
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
  final List<KycSession> kycSessions;

  factory KycQueueItem.fromJson(Map<String, dynamic> j) {
    final count = (j['_count'] as Map<String, dynamic>?) ?? const {};
    final agent = (j['agent'] as Map<String, dynamic>?) ?? const {};
    final sessionsList = (j['kycSessions'] as List<dynamic>? ?? const []);
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
      kycSessions: sessionsList
          .map((dynamic e) => KycSession.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
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
