import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/borrower_chit_service.dart';
import 'package:zolofund/data/services/chit_service.dart';

class ChitGroupRoomScreen extends ConsumerStatefulWidget {
  const ChitGroupRoomScreen({
    super.key,
    required this.groupId,
    required this.isStaff,
    this.groupName,
  });

  final String groupId;
  final bool isStaff;
  final String? groupName;

  @override
  ConsumerState<ChitGroupRoomScreen> createState() =>
      _ChitGroupRoomScreenState();
}

class _ChitGroupRoomScreenState extends ConsumerState<ChitGroupRoomScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  Timer? _pollTimer;

  Map<String, dynamic>? _state;
  bool _loading = true;
  bool _sending = false;
  String? _error;
  String? _replyToId;
  String? _replyToSender;
  String? _replyToBody;
  bool _organizerOnly = false;
  String? _selectedPdfLang;

  static const _pdfLangChoices = [
    ('en', 'English'),
    ('ta', 'தமிழ்'),
    ('hi', 'हिन्दी'),
    ('te', 'తెలుగు'),
    ('kn', 'ಕನ್ನಡ'),
    ('ml', 'മലയാളം'),
  ];

  @override
  void initState() {
    super.initState();
    _loadRoom();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _loadRoom(silent: true),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  String get _effectivePdfLang =>
      _selectedPdfLang ?? ref.read(languageProvider).name;

  Future<void> _loadRoom({bool silent = false}) async {
    try {
      final data = widget.isStaff
          ? await ref.read(chitServiceProvider).groupRoomState(widget.groupId)
          : await ref
              .read(borrowerChitServiceProvider)
              .groupRoomState(widget.groupId);
      if (!mounted) return;
      setState(() {
        _state = data;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      if (widget.isStaff) {
        await ref.read(chitServiceProvider).sendGroupRoomMessage(
              widget.groupId,
              body: text,
              toOrganizer: _organizerOnly,
              replyToId: _replyToId,
            );
      } else {
        await ref.read(borrowerChitServiceProvider).sendGroupRoomMessage(
              widget.groupId,
              body: text,
              replyToId: _replyToId,
            );
      }
      _msgCtrl.clear();
      setState(() {
        _replyToId = null;
        _replyToSender = null;
        _replyToBody = null;
      });
      await _loadRoom(silent: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not send message: $e')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _downloadPdf(String auctionId, int periodNumber) async {
    final lang = _effectivePdfLang;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final bytes = widget.isStaff
          ? await ref.read(chitServiceProvider).downloadPeriodReportPdf(
                widget.groupId,
                auctionId,
                lang: lang,
              )
          : await ref.read(borrowerChitServiceProvider).downloadPeriodReportPdf(
                widget.groupId,
                auctionId,
                lang: lang,
              );
      await Printing.sharePdf(
        bytes: bytes,
        filename: 'chit-period-$periodNumber-$lang-report.pdf',
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Could not download report: $e')),
      );
    }
  }

  Future<void> _openSettingsSheet(Map<String, dynamic> group) async {
    String mode = (group['roomChatMode'] as String?) ?? 'open';
    final pinCtrl =
        TextEditingController(text: group['pinnedAnnouncement'] as String? ?? '');
    final remCtrl = TextEditingController();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Group Room Controls', style: AppTypography.sectionTitle),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'open', label: Text('Open Chat')),
                  ButtonSegment(
                    value: 'announcements_only',
                    label: Text('Announcements Only'),
                  ),
                ],
                selected: {mode},
                onSelectionChanged: (s) => setLocal(() => mode = s.first),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: pinCtrl,
                decoration: const InputDecoration(
                  labelText: 'Pinned Announcement',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    await ref.read(chitServiceProvider).updateGroupRoomSettings(
                          widget.groupId,
                          roomChatMode: mode,
                          pinnedAnnouncement: pinCtrl.text.trim(),
                        );
                    await _loadRoom(silent: true);
                  },
                  child: const Text('Save Room Settings'),
                ),
              ),
              const Divider(height: 24),
              TextField(
                controller: remCtrl,
                decoration: const InputDecoration(
                  labelText: 'Post Payment Reminder to Room',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () async {
                    final msg = remCtrl.text.trim();
                    if (msg.isEmpty) return;
                    Navigator.pop(ctx);
                    await ref
                        .read(chitServiceProvider)
                        .sendGroupRoomReminder(widget.groupId, msg);
                    await _loadRoom(silent: true);
                  },
                  child: const Text('Post Reminder Card'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    final group = _state?['group'] as Map<String, dynamic>?;
    final activeAuction = _state?['activeAuction'] as Map<String, dynamic>?;
    final my = _state?['mySummary'] as Map<String, dynamic>?;
    final messages = ((_state?['messages'] as List<dynamic>?) ?? [])
        .cast<Map<String, dynamic>>();
    final settlements = ((_state?['settlements'] as List<dynamic>?) ?? [])
        .cast<Map<String, dynamic>>();
    final roomChatMode = (group?['roomChatMode'] as String?) ?? 'open';
    final isMemberLocked = !widget.isStaff && roomChatMode == 'announcements_only';
    final roomOpen = activeAuction?['isOpen'] == true;
    final bounds = activeAuction?['bidBounds'] as Map<String, dynamic>?;
    final quickOpts = ((bounds?['quickOptions'] as List<dynamic>?) ?? [])
        .map((e) => (e as num).toDouble())
        .toList(growable: false);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              (group?['name'] as String?) ?? widget.groupName ?? 'Group Room',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            if (group != null)
              Text(
                '${group['enrolledCount']}/${group['totalMembers']} Members · '
                '${roomChatMode == 'announcements_only' ? 'Announcements Only' : 'Open Chat'}',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w400),
              ),
          ],
        ),
        actions: [
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _effectivePdfLang,
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
              items: _pdfLangChoices
                  .map(
                    (c) => DropdownMenuItem(
                      value: c.$1,
                      child: Text(c.$2, style: const TextStyle(fontSize: 12)),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _selectedPdfLang = v),
            ),
          ),
          if (widget.isStaff && group != null)
            IconButton(
              icon: const Icon(Icons.tune),
              tooltip: 'Room Settings',
              onPressed: () => _openSettingsSheet(group),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 10),
                        ElevatedButton(
                          onPressed: _loadRoom,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    if (group?['pinnedAnnouncement'] != null &&
                        (group!['pinnedAnnouncement'] as String).isNotEmpty)
                      Container(
                        width: double.infinity,
                        color: const Color(0xFFFEF9C3),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        child: Text(
                          '📌 ${group['pinnedAnnouncement']}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF713F12),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    if (activeAuction != null)
                      Container(
                        margin: const EdgeInsets.all(10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${roomOpen ? '🔴 Live' : 'Scheduled'} · Period ${activeAuction['periodNumber']}',
                                  style: AppTypography.body.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                if (roomOpen)
                                  Text(
                                    '⏱ ${(activeAuction['secondsRemaining'] ?? 0)}s',
                                    style: const TextStyle(
                                      color: AppColors.danger,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              activeAuction['leadingBid'] != null
                                  ? 'Leading: ${fmt.format((activeAuction['leadingBid']['prizeAmount'] as num).toDouble())} '
                                      '(#${activeAuction['leadingBid']['ticketNo']} ${activeAuction['leadingBid']['memberName']})'
                                  : 'Max Prize: ${fmt.format(((bounds?['nextValidPrize'] ?? group?['chitValue'] ?? 0) as num).toDouble())}',
                              style: AppTypography.caption,
                            ),
                            if (!widget.isStaff &&
                                roomOpen &&
                                activeAuction['supportsBidding'] == true &&
                                my?['hasWon'] != true &&
                                quickOpts.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 6,
                                children: [
                                  if (!['admitted', 'denied']
                                      .contains(my?['admissionStatus']))
                                    FilledButton.tonal(
                                      onPressed: () async {
                                        await ref
                                            .read(borrowerChitServiceProvider)
                                            .joinGroupRoom(widget.groupId);
                                        await _loadRoom(silent: true);
                                      },
                                      child: const Text('Join Table'),
                                    ),
                                  if (group?['roomAdmission'] != 'approval' ||
                                      my?['admissionStatus'] == 'admitted')
                                    ...quickOpts.take(3).map(
                                          (opt) => ActionChip(
                                            label: Text('Bid ${fmt.format(opt)}'),
                                            onPressed: () async {
                                              await ref
                                                  .read(borrowerChitServiceProvider)
                                                  .placeGroupRoomBid(
                                                    widget.groupId,
                                                    prizeAmount: opt,
                                                  );
                                              await _loadRoom(silent: true);
                                            },
                                          ),
                                        ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    if (settlements.isNotEmpty)
                      SizedBox(
                        height: 42,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          itemCount: settlements.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (_, idx) {
                            final st = settlements[idx];
                            return ActionChip(
                              avatar: const Icon(Icons.picture_as_pdf, size: 16),
                              label: Text('Period ${st['periodNumber']} PDF'),
                              onPressed: () => _downloadPdf(
                                st['auctionId'] as String,
                                (st['periodNumber'] as num).toInt(),
                              ),
                            );
                          },
                        ),
                      ),
                    Expanded(
                      child: ListView.builder(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.all(12),
                        itemCount: messages.length,
                        itemBuilder: (_, idx) {
                          final m = messages[idx];
                          final type = (m['messageType'] as String?) ?? 'text';
                          final isCard = [
                            'bid_event',
                            'settlement_card',
                            'payment_reminder',
                            'system_notice',
                          ].contains(type);
                          if (isCard) {
                            final meta = m['metadata'] as Map<String, dynamic>?;
                            final metaAuctionId = meta?['auctionId'] as String?;
                            final metaPeriod =
                                (meta?['periodNumber'] as num?)?.toInt();
                            return Container(
                              margin: const EdgeInsets.symmetric(vertical: 6),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: type == 'settlement_card'
                                    ? const Color(0xFFDCFCE7)
                                    : type == 'bid_event'
                                        ? const Color(0xFFFEF3C7)
                                        : const Color(0xFFE0F2FE),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    (m['senderName'] as String?) ?? '',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    (m['body'] as String?) ?? '',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                  if (metaAuctionId != null && metaPeriod != null)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 6),
                                      child: TextButton.icon(
                                        onPressed: () => _downloadPdf(
                                          metaAuctionId,
                                          metaPeriod,
                                        ),
                                        icon: const Icon(
                                          Icons.download,
                                          size: 16,
                                        ),
                                        label: const Text('Period PDF'),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          }
                          final isMine = widget.isStaff
                              ? m['senderUserId'] != null
                              : (my != null &&
                                  m['senderMemberId'] == my['memberId']);
                          return Align(
                            alignment: isMine
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: GestureDetector(
                              onLongPress: () => setState(() {
                                _replyToId = m['id'] as String?;
                                _replyToSender = m['senderName'] as String?;
                                _replyToBody = m['body'] as String?;
                              }),
                              child: Container(
                                margin: const EdgeInsets.symmetric(vertical: 4),
                                padding: const EdgeInsets.all(10),
                                constraints: BoxConstraints(
                                  maxWidth:
                                      MediaQuery.of(context).size.width * 0.78,
                                ),
                                decoration: BoxDecoration(
                                  color: isMine
                                      ? const Color(0xFFD9FDD3)
                                      : AppColors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: AppTokens.shadow,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${m['senderName'] ?? 'Member'}${m['visibility'] == 'organizer' ? ' · Private' : ''}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF075E54),
                                      ),
                                    ),
                                    if (m['replyToBody'] != null) ...[
                                      const SizedBox(height: 3),
                                      Container(
                                        padding: const EdgeInsets.all(6),
                                        decoration: BoxDecoration(
                                          color: Colors.black12,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          '${m['replyToSender'] ?? ''}: ${m['replyToBody']}',
                                          style: const TextStyle(fontSize: 11),
                                        ),
                                      ),
                                    ],
                                    const SizedBox(height: 3),
                                    Text(
                                      (m['body'] as String?) ?? '',
                                      style: const TextStyle(fontSize: 14),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    if (_replyToId != null)
                      Container(
                        color: AppColors.surface,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Replying to $_replyToSender: $_replyToBody',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.caption,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () => setState(() => _replyToId = null),
                            ),
                          ],
                        ),
                      ),
                    SafeArea(
                      top: false,
                      child: isMemberLocked
                          ? Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(12),
                              color: AppColors.surface,
                              child: const Text(
                                '📢 Only organizers can message in this group right now.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12),
                              ),
                            )
                          : Container(
                              padding: const EdgeInsets.all(8),
                              color: AppColors.surface,
                              child: Row(
                                children: [
                                  if (widget.isStaff)
                                    IconButton(
                                      icon: Icon(
                                        _organizerOnly
                                            ? Icons.lock
                                            : Icons.lock_open,
                                        size: 20,
                                      ),
                                      tooltip: 'Toggle Organizer-Only',
                                      onPressed: () => setState(
                                        () => _organizerOnly = !_organizerOnly,
                                      ),
                                    ),
                                  Expanded(
                                    child: TextField(
                                      controller: _msgCtrl,
                                      textInputAction: TextInputAction.send,
                                      onSubmitted: (_) => _sendMessage(),
                                      decoration: const InputDecoration(
                                        hintText: 'Message chit group...',
                                        isDense: true,
                                        border: OutlineInputBorder(),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton.filled(
                                    onPressed: _sending ? null : _sendMessage,
                                    icon: const Icon(Icons.send),
                                  ),
                                ],
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }
}
