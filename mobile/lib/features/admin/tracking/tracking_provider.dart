import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/agent_location.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

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

/// Query for an agent's collections over a date range (inclusive [from],
/// exclusive [to]). Used as a stable Riverpod family key — boundaries are
/// normalised to whole days by the caller so it doesn't refetch each rebuild.
typedef AgentCollectionsQuery = ({String agentId, DateTime from, DateTime to});

/// Raw location trail for a single agent over a date range — powers the
/// route polyline, the agent dot history and the tracking log list.
final agentHistoryProvider = FutureProvider.autoDispose
    .family<List<AgentPing>, AgentCollectionsQuery>((ref, q) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(
    Endpoints.gpsHistory(q.agentId),
    queryParameters: {
      'from': q.from.toIso8601String(),
      'to': q.to.toIso8601String(),
      'limit': 500,
    },
  );
  return unwrapEnvelope(
    res,
    (dynamic data) {
      final list = data as List<dynamic>? ?? [];
      return list
          .map((dynamic e) => AgentPing.fromJson(e as Map<String, dynamic>))
          .toList();
    },
  );
});

/// Collection entries for a single agent over a date range
/// (customer, due, collected).
final agentCollectionsProvider = FutureProvider.autoDispose
    .family<List<AgentCollection>, AgentCollectionsQuery>((ref, q) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(
    Endpoints.agentCollections(q.agentId),
    queryParameters: {
      'from': q.from.toIso8601String(),
      'to': q.to.toIso8601String(),
    },
  );
  return unwrapEnvelope(
    res,
    (dynamic data) {
      final list = data as List<dynamic>? ?? [];
      return list
          .map(
            (dynamic e) => AgentCollection.fromJson(e as Map<String, dynamic>),
          )
          .toList();
    },
  );
});
