import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zolofund/data/models/announcement.dart';
import 'package:zolofund/data/services/announcements_service.dart';

final activeAnnouncementsProvider = FutureProvider<
    ({List<Announcement> scrolling, List<Announcement> popups})>((ref) async {
  final service = ref.watch(announcementsServiceProvider);
  return service.fetchActiveAnnouncements();
});
