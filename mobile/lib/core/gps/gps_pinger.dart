import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/gps/gps_service.dart';

/// GPS-05: batches pings + posts every 30s while active.
/// Stops on `stop()` to save battery.
class GpsPinger {
  GpsPinger(this._ref);
  final Ref _ref;
  final _buffer = <Map<String, dynamic>>[];
  StreamSubscription<Position>? _sub;
  Timer? _flushTimer;
  String? _routeId;

  Future<void> start({String? routeId, int distanceFilterM = 20}) async {
    await stop();
    _routeId = routeId;
    final gps = _ref.read(gpsServiceProvider);
    if (!await gps.ensurePermission()) return;

    _sub = gps.trackStream(distanceFilterM: distanceFilterM).listen((p) {
      _buffer.add({
        'lat': p.latitude,
        'lng': p.longitude,
        'accuracyM': p.accuracy,
        'speedMps': p.speed,
        'capturedAt': p.timestamp.toIso8601String(),
        if (_routeId != null) 'routeId': _routeId,
      });
    });

    _flushTimer = Timer.periodic(const Duration(seconds: 30), (_) => _flush());
  }

  Future<void> stop() async {
    _flushTimer?.cancel();
    _flushTimer = null;
    await _sub?.cancel();
    _sub = null;
    await _flush();
  }

  Future<void> _flush() async {
    if (_buffer.isEmpty) return;
    final pings = List<Map<String, dynamic>>.from(_buffer);
    _buffer.clear();
    try {
      final dio = _ref.read(dioProvider);
      // dio baseUrl already ends in /api/v1 — use a RELATIVE path. The old
      // '/api/v1/gps/ping' doubled the prefix (→ /api/v1/api/v1/gps/ping, 404),
      // so live pings were silently dropped and agents never appeared on the map.
      await dio.post<void>('/gps/ping', data: {'pings': pings});
    } catch (_) {
      // re-buffer on failure (cap at 200 to avoid OOM)
      if (_buffer.length < 200) _buffer.addAll(pings.take(200 - _buffer.length));
    }
  }
}

final gpsPingerProvider = Provider<GpsPinger>((ref) => GpsPinger(ref));
