import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';

class FcmService {
  FcmService(this._dio);
  final Dio _dio;

  Future<void> registerToken({required String token, required String platform}) async {
    await _dio.post<Map<String, dynamic>>(
      '/fcm-token',
      data: {'token': token, 'platform': platform},
    );
  }
}

final fcmServiceProvider = Provider<FcmService>(
  (ref) => FcmService(ref.watch(dioProvider)),
);
