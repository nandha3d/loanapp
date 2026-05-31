import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/pricing.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class PricingService {
  PricingService(this._dio);

  final Dio _dio;

  Future<PricingCatalog> fetchPricingCatalog() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.pricing);
    return unwrapEnvelope(res, (dynamic d) {
      return PricingCatalog.fromJson(d as Map<String, dynamic>);
    });
  }
}

final pricingServiceProvider = Provider<PricingService>(
  (ref) => PricingService(ref.watch(dioProvider)),
);
