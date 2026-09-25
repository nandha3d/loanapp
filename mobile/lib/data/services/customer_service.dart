import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/api_exception.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/customer.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class KycDocInput {
  const KycDocInput({required this.type, required this.url});
  final String type;
  final String url;
  Map<String, String> toJson() => {'type': type, 'url': url};
}

class CustomerService {
  CustomerService(this._dio);
  final Dio _dio;

  Future<List<Customer>> list(
      {String? query, String? cursor, int? limit}) async {
    // If a specific cursor is requested, fetch just that single page
    if (cursor != null && cursor.isNotEmpty) {
      final queryParams = <String, dynamic>{
        if (query != null && query.isNotEmpty) 'q': query,
        'cursor': cursor,
        if (limit != null) 'limit': limit,
      };
      final res = await _dio.get<Map<String, dynamic>>(
        Endpoints.customers,
        queryParameters: queryParams,
      );
      return unwrapEnvelope(res, (dynamic d) {
        final list = (d as List<dynamic>);
        return list
            .map((dynamic e) => Customer.fromJson(e as Map<String, dynamic>))
            .toList(growable: false);
      });
    }

    // Default: follow nextCursor across all pages (up to 50 pages) to match web parity
    final all = <Customer>[];
    String? currentCursor;
    for (var page = 0; page < 50; page++) {
      final queryParams = <String, dynamic>{
        if (query != null && query.isNotEmpty) 'q': query,
        'limit': limit ?? 100,
        if (currentCursor != null) 'cursor': currentCursor,
      };
      final res = await _dio.get<Map<String, dynamic>>(
        Endpoints.customers,
        queryParameters: queryParams,
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
          .map((dynamic e) => Customer.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
      all.addAll(pageRows);

      final pagination = body['pagination'] as Map<String, dynamic>?;
      final next = pagination?['nextCursor'] as String?;
      if (next == null || pageRows.isEmpty) break;
      currentCursor = next;
    }
    return all;
  }

  Future<Customer> getById(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.customer(id));
    return unwrapEnvelope(
      res,
      (dynamic d) => Customer.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<Customer> create({
    required String name,
    required String phone,
    String? address,
    String? aadharNumber,
    String? routeId,
    String? agentId,
    String? photoUrl,
    List<KycDocInput> kycDocs = const [],
    // Extended profile fields (PAN, email, company/business) — web parity.
    Map<String, dynamic> extra = const {},
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.customers,
      data: {
        'name': name,
        'phone': phone,
        if (address != null) 'address': address,
        if (aadharNumber != null) 'aadharNumber': aadharNumber,
        if (routeId != null) 'routeId': routeId,
        if (agentId != null) 'agentId': agentId,
        if (photoUrl != null) 'photoUrl': photoUrl,
        if (kycDocs.isNotEmpty)
          'kycDocs': kycDocs.map((d) => d.toJson()).toList(growable: false),
        ...extra,
      },
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => Customer.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<Customer> update(String id, Map<String, dynamic> patch) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.customer(id),
      data: patch,
    );
    return unwrapEnvelope(
      res,
      (dynamic d) => Customer.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<void> delete(String id) async {
    final res = await _dio.delete<Map<String, dynamic>>(Endpoints.customer(id));
    unwrapEnvelope(res, (_) => null);
  }

  Future<List<int>> collectionReceiptPdf(String id) async {
    final res = await _dio.get<List<int>>(
      Endpoints.customerCollectionReceipt(id),
      options: Options(responseType: ResponseType.bytes),
    );
    return unwrapPdfBytes(res);
  }
}

final customerServiceProvider = Provider<CustomerService>(
  (ref) => CustomerService(ref.watch(dioProvider)),
);
