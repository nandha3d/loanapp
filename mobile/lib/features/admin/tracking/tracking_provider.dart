import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/agent_location.dart';

final liveAgentLocationsProvider = FutureProvider.autoDispose<List<AgentLocation>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>('/gps/live');
  return unwrapEnvelope(
    res,
    (dynamic data) {
      final list = data as List<dynamic>? ?? [];
      return list.map((dynamic e) => AgentLocation.fromJson(e as Map<String, dynamic>)).toList();
    },
  );
});
