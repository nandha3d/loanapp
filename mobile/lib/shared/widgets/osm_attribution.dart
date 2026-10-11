import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

/// Required credit for OpenStreetMap tiles (ODbL licence + OSM tile usage
/// policy). Add as a child of every FlutterMap that shows OSM tiles.
class OsmAttribution extends StatelessWidget {
  const OsmAttribution({super.key});

  @override
  Widget build(BuildContext context) {
    return const SimpleAttributionWidget(
      source: Text('OpenStreetMap contributors'),
    );
  }
}
