import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

/// A place search result from OpenStreetMap Nominatim.
class PlaceResult {
  const PlaceResult({
    required this.displayName,
    required this.lat,
    required this.lng,
  });
  final String displayName;
  final double lat;
  final double lng;

  LatLng get point => LatLng(lat, lng);
}

/// Free geocoding via OpenStreetMap Nominatim (same data as the map tiles,
/// no API key). Nominatim asks for a descriptive User-Agent and light usage;
/// we search on submit only, not on every keystroke.
class GeocodingService {
  GeocodingService()
      : _dio = Dio(
          BaseOptions(
            baseUrl: 'https://nominatim.openstreetmap.org',
            connectTimeout: const Duration(seconds: 12),
            receiveTimeout: const Duration(seconds: 12),
            headers: const {
              'User-Agent': 'LoanTrack/1.0 (com.loantrack.app)',
              'Accept': 'application/json',
            },
          ),
        );

  final Dio _dio;

  /// Search places by free text (name / address). Biased to India (countrycodes=in).
  Future<List<PlaceResult>> search(String query) async {
    final q = query.trim();
    if (q.isEmpty) return const [];
    try {
      final res = await _dio.get<List<dynamic>>(
        '/search',
        queryParameters: {
          'q': q,
          'format': 'jsonv2',
          'addressdetails': 0,
          'limit': 6,
          'countrycodes': 'in',
        },
      );
      final data = res.data ?? const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map((m) => PlaceResult(
                displayName: (m['display_name'] as String?) ?? 'Unknown place',
                lat: double.tryParse('${m['lat']}') ?? 0,
                lng: double.tryParse('${m['lon']}') ?? 0,
              ))
          .where((p) => p.lat != 0 || p.lng != 0)
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  /// Reverse geocode a point into a human-readable address.
  Future<String?> reverse(double lat, double lng) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/reverse',
        queryParameters: {
          'lat': lat,
          'lon': lng,
          'format': 'jsonv2',
        },
      );
      return res.data?['display_name'] as String?;
    } catch (_) {
      return null;
    }
  }
}

final geocodingServiceProvider =
    Provider<GeocodingService>((ref) => GeocodingService());
