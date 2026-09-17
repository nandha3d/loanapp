import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';

/// Product Finance item API service — repossession toggle.
class ProductService {
  ProductService(this._dio);
  final Dio _dio;

  /// Update repossession status: status: 'repossessed' | 'active'
  Future<void> updateRepossession(String loanId, {required String status, String reason = ''}) async {
    await _dio.post<Map<String, dynamic>>(
      '/loans/$loanId/product-repossession',
      data: {'status': status, 'reason': reason},
    );
  }
}

final productServiceProvider = Provider<ProductService>(
  (ref) => ProductService(ref.watch(dioProvider)),
);
