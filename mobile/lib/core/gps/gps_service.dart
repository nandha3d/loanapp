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

  /// Requests foreground location first, then follows up with the
  /// "Allow all the time" (background) prompt — Android only shows the
  /// always-allow option as a separate, second request after while-in-use is
  /// already granted. Returns true only if background ("always") was granted.
  Future<bool> requestAlwaysPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    final whileInUse = await Permission.locationWhenInUse.request();
    if (!whileInUse.isGranted) return false;
    final always = await Permission.locationAlways.request();
    return always.isGranted;
  }

  /// Current permission tier, for banners/status checks — does not prompt.
  Future<LocationPermission> currentPermission() =>
      Geolocator.checkPermission();

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

  /// Best-effort location for capture-at-creation flows: try a live fix
  /// first, then fall back to the device's last cached fix (works even with
  /// GPS off / indoors — the OS keeps a network-based last-known location)
  /// so a customer's location still gets saved instead of staying blank.
  Future<Position?> currentOrLastKnown({
    LocationAccuracy accuracy = LocationAccuracy.high,
    Duration timeout = const Duration(seconds: 10),
  }) async {
    final live = await currentPosition(accuracy: accuracy, timeout: timeout);
    if (live != null) return live;
    if (!await ensurePermission()) return null;
    try {
      return await Geolocator.getLastKnownPosition();
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
