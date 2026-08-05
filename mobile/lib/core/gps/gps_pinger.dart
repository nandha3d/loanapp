import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/core/gps/gps_service.dart';

const _kQueueBox = 'gps_ping_queue';
const _kQueueKey = 'pending';
const _kQueueCap = 1000; // FIFO cap — oldest dropped first

/// GPS-05: batches pings + posts every 30s while active.
/// Stops on `stop()` to save battery.
///
/// Durability: the in-memory buffer is mirrored to a Hive box so pings
/// survive app kill / crash. On start() any persisted backlog is restored
/// and sent with the next flush.
class GpsPinger {
  GpsPinger(this._ref);
  final Ref _ref;
  final _buffer = <Map<String, dynamic>>[];
  StreamSubscription<Position>? _sub;
  Timer? _flushTimer;
  String? _routeId;

  Future<Box<dynamic>> _openBox() async {
    if (Hive.isBoxOpen(_kQueueBox)) return Hive.box(_kQueueBox);
    return Hive.openBox(_kQueueBox);
  }

  Future<void> _persist() async {
    try {
      final box = await _openBox();
      await box.put(_kQueueKey, jsonEncode(_buffer));
    } catch (_) {
      // persistence is best-effort — never break tracking over it
    }
  }

  Future<void> _restore() async {
    try {
      final box = await _openBox();
      final raw = box.get(_kQueueKey) as String?;
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        for (final item in decoded) {
          if (item is Map) _buffer.add(Map<String, dynamic>.from(item));
        }
      }
    } catch (_) {
      // corrupt queue — drop it rather than crash
    }
  }

  void _capBuffer() {
    if (_buffer.length > _kQueueCap) {
      _buffer.removeRange(0, _buffer.length - _kQueueCap);
    }
  }

  Future<void> start({String? routeId, int distanceFilterM = 20}) async {
    await stop();
    _routeId = routeId;
    final gps = _ref.read(gpsServiceProvider);
    if (!await gps.ensurePermission()) return;

    // Recover any backlog persisted before an app kill.
    if (_buffer.isEmpty) await _restore();

    _sub = gps.trackStream(distanceFilterM: distanceFilterM).listen((p) {
      _buffer.add({
        'lat': p.latitude,
        'lng': p.longitude,
        'accuracyM': p.accuracy,
        'speedMps': p.speed,
        'capturedAt': p.timestamp.toIso8601String(),
        // Fraud signal: Android reports fake-GPS providers via isMocked.
        'isMocked': p.isMocked,
        if (_routeId != null) 'routeId': _routeId,
      });
      _capBuffer();
      _persist();
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
      await _persist(); // buffer now empty — clear persisted backlog too
    } catch (_) {
      // re-buffer on failure, FIFO-capped, and keep on disk for next attempt
      _buffer.insertAll(0, pings);
      _capBuffer();
      await _persist();
    }
  }
}

final gpsPingerProvider = Provider<GpsPinger>((ref) => GpsPinger(ref));
