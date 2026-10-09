import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/data/models/announcement.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

final announcementsServiceProvider = Provider<AnnouncementsService>((ref) {
  return AnnouncementsService(ref.watch(dioProvider));
});

class AnnouncementsService {
  AnnouncementsService(this._dio);
  final Dio _dio;

  Future<({List<Announcement> scrolling, List<Announcement> popups})> fetchActiveAnnouncements() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(Endpoints.announcementsActive);
      return unwrapEnvelope(res, (dynamic d) {
        final map = d as Map<String, dynamic>;
        final scrollingList = (map['scrollingAnnouncements'] as List<dynamic>? ?? [])
            .map((dynamic e) => Announcement.fromJson(e as Map<String, dynamic>))
            .toList(growable: false);
        final popupsList = (map['popupAnnouncements'] as List<dynamic>? ?? [])
            .map((dynamic e) => Announcement.fromJson(e as Map<String, dynamic>))
            .toList(growable: false);
        return (scrolling: scrollingList, popups: popupsList);
      });
    } catch (_) {
      return (scrolling: <Announcement>[], popups: <Announcement>[]);
    }
  }

  Future<void> dismissAnnouncement(String id) async {
    try {
      await _dio.post<dynamic>(Endpoints.announcementDismiss(id));
    } catch (_) {}
  }

  Future<void> markAnnouncementRead(String id) async {
    try {
      await _dio.post<dynamic>(Endpoints.announcementRead(id));
    } catch (_) {}
  }
}
