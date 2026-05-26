import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

/// GPS-04/05: low-overhead location helper.
/// Battery-friendly: explicit one-shot reads + opt-in stream during collection.
class GpsService {
  GpsService();

  Future<bool> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.deniedForever) {
      await openAppSettings();
      return false;
    }
    return perm == LocationPermission.whileInUse ||
        perm == LocationPermission.always;
  }

  Future<Position?> currentPosition({
    LocationAccuracy accuracy = LocationAccuracy.high,
    Duration timeout = const Duration(seconds: 10),
  }) async {
    if (!await ensurePermission()) return null;
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: accuracy,
          timeLimit: timeout,
        ),
      );
    } catch (_) {
      return null;
    }
  }

  /// GPS-05: stream during active collection session only.
  /// `distanceFilter` reduces ping count (m).
  Stream<Position> trackStream({
    LocationAccuracy accuracy = LocationAccuracy.high,
    int distanceFilterM = 20,
  }) {
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: accuracy,
        distanceFilter: distanceFilterM,
      ),
    );
  }
}

final gpsServiceProvider = Provider<GpsService>((_) => GpsService());
