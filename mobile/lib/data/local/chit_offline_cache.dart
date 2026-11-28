import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';

/// Persistent Hive cache for chit groups, members, and subscription dues so
/// collection agents can inspect & record cash receipts without signal (Task 6).
class ChitOfflineCache {
  static const String boxName = 'chit_offline_cache';

  Future<Box<String>> _box() async {
    if (Hive.isBoxOpen(boxName)) return Hive.box<String>(boxName);
    return Hive.openBox<String>(boxName);
  }

  Future<void> saveGroups(List<Map<String, dynamic>> rawGroups) async {
    final b = await _box();
    await b.put('groups', jsonEncode(rawGroups));
    await b.put('last_synced_at', DateTime.now().toIso8601String());
  }

  Future<List<Map<String, dynamic>>> loadGroups() async {
    final b = await _box();
    final raw = b.get('groups');
    if (raw == null || raw.isEmpty) return const [];
    final decoded = jsonDecode(raw) as List<dynamic>;
    return decoded.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  Future<void> saveGroupSnapshot(
    String groupId, {
    Map<String, dynamic>? detail,
    List<Map<String, dynamic>>? members,
    List<Map<String, dynamic>>? subscriptions,
  }) async {
    final b = await _box();
    if (detail != null) await b.put('detail:$groupId', jsonEncode(detail));
    if (members != null) await b.put('members:$groupId', jsonEncode(members));
    if (subscriptions != null) {
      await b.put('subs:$groupId', jsonEncode(subscriptions));
    }
    await b.put('last_synced_at', DateTime.now().toIso8601String());
  }

  Future<Map<String, dynamic>?> loadDetail(String groupId) async {
    final b = await _box();
    final raw = b.get('detail:$groupId');
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>?> loadMembers(String groupId) async {
    final b = await _box();
    final raw = b.get('members:$groupId');
    if (raw == null) return null;
    return (jsonDecode(raw) as List<dynamic>)
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
  }

  Future<List<Map<String, dynamic>>?> loadSubscriptions(String groupId) async {
    final b = await _box();
    final raw = b.get('subs:$groupId');
    if (raw == null) return null;
    return (jsonDecode(raw) as List<dynamic>)
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
  }

  Future<DateTime?> lastSyncedAt() async {
    final b = await _box();
    final raw = b.get('last_synced_at');
    return raw == null ? null : DateTime.tryParse(raw);
  }
}
