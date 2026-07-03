import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import 'package:loantrack/core/gps/gps_service.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/geocoding_service.dart';

/// Result returned by [LocationPickerScreen].
class PickedLocation {
  const PickedLocation({required this.lat, required this.lng, this.address});
  final double lat;
  final double lng;
  final String? address;
}

/// Full-screen map picker: drag the map to move the centre pin, jump to the
/// device's current location, or search a place by name. Returns the picked
/// point (and a reverse-geocoded address) via Navigator.pop.
class LocationPickerScreen extends ConsumerStatefulWidget {
  const LocationPickerScreen({
    super.key,
    this.initialLat,
    this.initialLng,
    this.title = 'Pin location',
  });

  final double? initialLat;
  final double? initialLng;
  final String title;

  @override
  ConsumerState<LocationPickerScreen> createState() =>
      _LocationPickerScreenState();
}

class _LocationPickerScreenState extends ConsumerState<LocationPickerScreen> {
  final _mapCtrl = MapController();
  final _searchCtrl = TextEditingController();

  LatLng _center = const LatLng(20.5937, 78.9629); // India centroid fallback
  bool _searching = false;
  bool _locating = false;
  List<PlaceResult> _results = const [];

  @override
  void initState() {
    super.initState();
    if (widget.initialLat != null && widget.initialLng != null) {
      _center = LatLng(widget.initialLat!, widget.initialLng!);
    } else {
      // No existing pin — try to open on the device's current location.
      WidgetsBinding.instance.addPostFrameCallback((_) => _useCurrentLocation());
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _mapCtrl.dispose();
    super.dispose();
  }

  bool get _hasInitial =>
      widget.initialLat != null && widget.initialLng != null;

  Future<void> _useCurrentLocation() async {
    setState(() => _locating = true);
    try {
      final pos = await ref.read(gpsServiceProvider).currentOrLastKnown();
      if (pos != null) {
        final p = LatLng(pos.latitude, pos.longitude);
        _mapCtrl.move(p, 16);
        setState(() => _center = p);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location unavailable — enable GPS')),
        );
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _runSearch() async {
    final q = _searchCtrl.text.trim();
    if (q.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() => _searching = true);
    final results = await ref.read(geocodingServiceProvider).search(q);
    if (!mounted) return;
    setState(() {
      _results = results;
      _searching = false;
    });
    if (results.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No places found')),
      );
    }
  }

  void _pickResult(PlaceResult r) {
    _mapCtrl.move(r.point, 16);
    setState(() {
      _center = r.point;
      _results = const [];
      _searchCtrl.text = r.displayName;
    });
  }

  Future<void> _confirm() async {
    // Reverse-geocode the final centre so the customer's address can be
    // auto-filled; failure is non-fatal (returns coords only).
    final address = await ref
        .read(geocodingServiceProvider)
        .reverse(_center.latitude, _center.longitude);
    if (!mounted) return;
    Navigator.of(context).pop(
      PickedLocation(
        lat: _center.latitude,
        lng: _center.longitude,
        address: address,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: _hasInitial ? 16 : 5,
              onPositionChanged: (camera, _) => _center = camera.center,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.loantrack.app',
              ),
            ],
          ),
          // Fixed centre pin — the map moves under it.
          const IgnorePointer(
            child: Center(
              child: Padding(
                // Nudge up so the pin tip points at the exact centre.
                padding: EdgeInsets.only(bottom: 40),
                child: Icon(
                  Icons.location_on_rounded,
                  size: 48,
                  color: AppColors.danger,
                  shadows: [
                    Shadow(color: Colors.black38, blurRadius: 4, offset: Offset(0, 2)),
                  ],
                ),
              ),
            ),
          ),
          // Search bar + results.
          Positioned(
            top: 10,
            left: 12,
            right: 12,
            child: Column(
              children: [
                Material(
                  elevation: 3,
                  borderRadius: BorderRadius.circular(12),
                  child: TextField(
                    controller: _searchCtrl,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _runSearch(),
                    decoration: InputDecoration(
                      hintText: 'Search place or address',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searching
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : IconButton(
                              icon: const Icon(Icons.arrow_forward),
                              onPressed: _runSearch,
                            ),
                      filled: true,
                      fillColor: AppColors.surface,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 12),
                    ),
                  ),
                ),
                if (_results.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 6),
                    constraints: const BoxConstraints(maxHeight: 240),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: AppTokens.shadow,
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      itemCount: _results.length,
                      separatorBuilder: (_, __) =>
                          const Divider(height: 1, color: AppColors.border),
                      itemBuilder: (_, i) => ListTile(
                        dense: true,
                        leading: Icon(Icons.place_outlined,
                            color: AppColors.primary),
                        title: Text(
                          _results[i].displayName,
                          style: AppTypography.caption,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        onTap: () => _pickResult(_results[i]),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          // Current-location FAB.
          Positioned(
            right: 16,
            bottom: 96,
            child: FloatingActionButton(
              heroTag: 'loc_picker_gps',
              backgroundColor: AppColors.surface,
              foregroundColor: AppColors.primary,
              onPressed: _locating ? null : _useCurrentLocation,
              child: _locating
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location_rounded),
            ),
          ),
          // Confirm button.
          Positioned(
            left: 16,
            right: 16,
            bottom: 20,
            child: SafeArea(
              top: false,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  minimumSize: const Size.fromHeight(52),
                ),
                onPressed: _confirm,
                icon: const Icon(Icons.check_rounded),
                label: const Text('Use this location'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
