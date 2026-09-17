import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/vehicle.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class VehiclesService {
  VehiclesService(this._dio);
  final Dio _dio;

  Future<List<Vehicle>> fetchVehicles({String? q, int page = 1}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.vehicles,
      queryParameters: {
        if (q != null && q.isNotEmpty) 'q': q,
        'page': page,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => Vehicle.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  Future<Vehicle> fetchVehicle(String id) async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.vehicle(id));
    return unwrapEnvelope(
      res,
      (dynamic d) => Vehicle.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<Vehicle> create(Map<String, dynamic> data) async {
    final res = await _dio.post<Map<String, dynamic>>(Endpoints.vehicles, data: data);
    return unwrapEnvelope(
      res,
      (dynamic d) => Vehicle.fromJson(d as Map<String, dynamic>),
    );
  }

  Future<Vehicle> update(String id, Map<String, dynamic> data) async {
    final res =
        await _dio.patch<Map<String, dynamic>>(Endpoints.vehicle(id), data: data);
    return unwrapEnvelope(
      res,
      (dynamic d) => Vehicle.fromJson(d as Map<String, dynamic>),
    );
  }
}

final vehiclesServiceProvider = Provider<VehiclesService>(
  (ref) => VehiclesService(ref.watch(dioProvider)),
);
