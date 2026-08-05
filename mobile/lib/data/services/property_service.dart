import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';

/// Property Collateral API service — mortgage release.
class PropertyService {
  PropertyService(this._dio);
  final Dio _dio;

  /// release mortgage on collateral
  Future<void> releaseProperty(String loanId) async {
    await _dio.post<Map<String, dynamic>>(
      '/loans/$loanId/property-release',
    );
  }
}

final propertyServiceProvider = Provider<PropertyService>(
  (ref) => PropertyService(ref.watch(dioProvider)),
);
