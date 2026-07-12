import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/app_strings.dart'; // AppLangX.code extension
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/authed_image.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/models/chit_live.dart' show RoomMessage;
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/features/chits/voice_bid_parser.dart';
import 'package:loantrack/features/collection/voice_entry_controller.dart';

// Table palette — the wooden auction table is deliberately fixed-color (not
// themed): it mirrors the web live room so both screens read as one product.
const _kFeltFrame = Color(0xFF111827);
const _kHub = Color(0xFF0B1220);
const _kHubBorder = Color(0xFF1E3A5F);
const _kTimerCyan = Color(0xFF38BDF8);

/// Live chit auction as a rich "poker table" (web-parity): subscribers seated
/// around a wooden oval with numbered seat tags, a server-authoritative
/// digital countdown in the hub, and every action one tap away — tap a seat
/// to bid with quick-step chips, long-press for an instant minimum bid,
/// voice raise, room chat, attendance, minutes. Presentation only — the
/// auction lifecycle and settlement stay on the canonical room endpoints.
class ChitLiveAuctionScreen extends ConsumerStatefulWidget {
  const ChitLiveAuctionScreen({
    super.key,
    required this.groupId,
    required this.auctionId,
    required this.periodNumber,
    required this.members,
    this.isAdmin = false,
    this.chitValue,
  });

  final String groupId;
  final String auctionId;
  final int periodNumber;
  final List<ChitMember> members;
  final bool isAdmin;

  /// Fallback until the first live poll lands (avoids a "₹0" flash).
  final double? chitValue;

  @override
  ConsumerState<ChitLiveAuctionScreen> createState() =>
      _ChitLiveAuctionScreenState();
}

class _ChitLiveAuctionScreenState extends ConsumerState<ChitLiveAuctionScreen> {
  Timer? _pollTimer;
  Timer? _tickTimer;
  Map<String, dynamic>? _live;
  String? _error;
  bool _busy = false;
  bool _showMinutes = false;

  // Server-authoritative countdown: seed on each poll, tick down locally.
  int _secondsAtPoll = 0;
  DateTime _polledAt = DateTime.now();
  String? _lastAnnouncedBidId;
  bool _announcedWinner = false;

  @override
  void initState() {
    super.initState();
    _poll();
    _pollTimer =
        Timer.periodic(const Duration(milliseconds: 2500), (_) => _poll());
    _tickTimer =
        Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    super.dispose();
  }

  ChitService get _svc => ref.read(chitServiceProvider);

  Future<void> _poll() async {
    try {
      final state = await _svc.liveState(widget.groupId, widget.auctionId);
      if (!mounted) return;
      setState(() {
        _live = state;
        _secondsAtPoll = _numOrNull(state['secondsRemaining'])?.toInt() ?? 0;
        _polledAt = DateTime.now();
      });
      _announceLeader(state);
      _announceWinnerIfAny(state);
    } catch (_) {
      // transient — next tick retries
    }
  }

  int get _displaySeconds {
    final elapsed = DateTime.now().difference(_polledAt).inSeconds;
    final left = _secondsAtPoll - elapsed;
    return left > 0 ? left : 0;
  }

  void _announceLeader(Map<String, dynamic> state) {
    final highest = state['highestBid'] as Map<String, dynamic>?;
    if (highest == null) return;
    final id = highest['id'] as String?;
    if (id == null || id == _lastAnnouncedBidId) return;
    _lastAnnouncedBidId = id;
    final name = (highest['memberName'] as String?) ?? '';
    final chitValue = _numOrNull(state['chitValue']) ?? 0;
    final discount = _numOrNull(highest['bidDiscount']) ?? 0;
    ref.speak('$name ${_speakAmount(chitValue - discount)}');
  }

  void _announceWinnerIfAny(Map<String, dynamic> state) {
    final winner = state['winner'] as Map<String, dynamic>?;
    if (winner == null || _announcedWinner) return;
    _announcedWinner = true;
    final name = (winner['name'] as String?) ?? '';
    if (name.isNotEmpty) ref.speak('Winner $name');
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await fn();
      await _poll();
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _openRoom() async {
    int durationMinutes = 30;
    int antiSnipe = 60;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Open bidding room'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _NumberField(
                label: 'Duration (minutes)',
                value: durationMinutes,
                onChanged: (v) => setLocal(() => durationMinutes = v),
              ),
              _NumberField(
                label: 'Anti-snipe extend (seconds)',
                value: antiSnipe,
                onChanged: (v) => setLocal(() => antiSnipe = v),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Open')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    await _run(() => _svc
        .roomAction(widget.groupId, widget.auctionId,
            action: 'open',
            durationMinutes: durationMinutes.clamp(1, 120),
            autoExtendSeconds: antiSnipe)
        .then((_) {}));
    ref.speak('Bidding open. Period ${widget.periodNumber}.');
  }

  Future<void> _closeRoom() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Close bidding?'),
        content: const Text('No more bids will be accepted after closing.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Close room')),
        ],
      ),
    );
    if (confirm != true) return;
    await _run(() => _svc
        .roomAction(widget.groupId, widget.auctionId, action: 'close')
        .then((_) {}));
  }

  Future<void> _confirmWinner() async {
    final highest = _live?['highestBid'] as Map<String, dynamic>?;
    final bidId = highest?['id'] as String?;
    if (bidId == null) {
      setState(() => _error = 'No bids to confirm a winner');
      return;
    }
    final name = highest?['memberName'] as String? ?? '';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm winner'),
        content: Text('Declare $name as the winner and settle this period?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Confirm')),
        ],
      ),
    );
    if (confirm != true) return;
    await _run(() => _svc.confirmAuction(widget.groupId, widget.auctionId,
        winningBidId: bidId));
    ref.speak('Winner $name');
  }

  // ── Attendance ───────────────────────────────────────────────────────────
  Future<void> _markAttendance(ChitMember member, String status) async {
    String? proxyName;
    if (status == 'proxy') {
      final ctrl = TextEditingController();
      proxyName = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Proxy for ${member.customerName}'),
          content: TextField(
            controller: ctrl,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Proxy name'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('Mark proxy'),
            ),
          ],
        ),
      );
      ctrl.dispose();
      if (proxyName == null || proxyName.trim().isEmpty) return;
    }

    await _run(() => _svc.markAttendance(
          widget.groupId,
          widget.auctionId,
          memberId: member.id,
          status: status,
          proxyName: proxyName,
        ));
  }

  void _showAttendanceSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.how_to_reg_rounded),
                  const SizedBox(width: 8),
                  Text('Attendance', style: AppTypography.sectionTitle),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Mark members before confirming or drawing the winner.',
                style: AppTypography.caption
                    .copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(ctx).size.height * 0.7,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: widget.members.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, index) {
                    final member = widget.members[index];
                    final status = _attendanceStatus(member.id);
                    final proxyName = _attendanceProxyName(member.id);
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor:
                            _attendanceColor(status).withValues(alpha: 0.12),
                        foregroundColor: _attendanceColor(status),
                        child: Icon(_attendanceIcon(status), size: 20),
                      ),
                      title: Text(member.customerName),
                      subtitle: Text(
                        proxyName == null
                            ? _attendanceLabel(status)
                            : '${_attendanceLabel(status)}: $proxyName',
                      ),
                      trailing: PopupMenuButton<String>(
                        tooltip: 'Mark attendance',
                        enabled: !_busy,
                        onSelected: (value) {
                          Navigator.pop(ctx);
                          _markAttendance(member, value);
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(
                            value: 'present',
                            child: Text('Present'),
                          ),
                          PopupMenuItem(
                            value: 'absent',
                            child: Text('Absent'),
                          ),
                          PopupMenuItem(
                            value: 'proxy',
                            child: Text('Proxy'),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Live state helpers ─────────────────────────────────────────────────
  double get _chitValue =>
      _numOrNull(_live?['chitValue']) ?? widget.chitValue ?? 0;

  double? get _highestDiscount {
    final h = _live?['highestBid'] as Map<String, dynamic>?;
    return _numOrNull(h?['bidDiscount']);
  }

  double get _minNextPrize {
    // Prize must go DOWN. Prefer the server's min next discount; else step ₹1.
    final minNextDiscount = _numOrNull(_live?['minNextDiscount']);
    if (minNextDiscount != null && _chitValue > 0) {
      return (_chitValue - minNextDiscount).clamp(0, _chitValue).toDouble();
    }
    final cur = _highestDiscount ?? 0;
    return (_chitValue - cur - 1).clamp(0, _chitValue).toDouble();
  }

  String get _roomStatus => (_live?['roomStatus'] as String?) ?? 'scheduled';
  bool get _roomOpen => _roomStatus == 'open' || _roomStatus == 'extended';
  bool get _roomClosed => _roomStatus == 'closed';
  bool get _sealed =>
      (_live?['auctionType'] as String?) == 'sealed' && !_roomClosed;

  Map<String, dynamic>? get _winner =>
      _live?['winner'] as Map<String, dynamic>?;

  int get _presentCount => _numOrNull(_live?['presentCount'])?.toInt() ?? 0;
  int get _totalMembers =>
      _numOrNull(_live?['totalMembers'])?.toInt() ?? widget.members.length;
  int get _bidCount => _numOrNull(_live?['bidCount'])?.toInt() ?? _bids.length;

  List<Map<String, dynamic>> get _bids =>
      (_live?['bids'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

  List<Map<String, dynamic>> get _attendanceRows =>
      ((_live?['attendance'] as List?) ?? const <dynamic>[])
          .whereType<Map<dynamic, dynamic>>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList(growable: false);

  Map<String, dynamic>? _attendanceFor(String memberId) {
    for (final row in _attendanceRows) {
      if (row['memberId'] == memberId) return row;
    }
    return null;
  }

  String _attendanceStatus(String memberId) =>
      (_attendanceFor(memberId)?['status'] as String?) ?? 'unmarked';

  String? _attendanceProxyName(String memberId) =>
      _attendanceFor(memberId)?['proxyName'] as String?;

  /// Best (lowest) prize a member has bid this round, or null.
  double? _memberPrize(ChitMember m) {
    double? bestDiscount;
    for (final b in _bids) {
      final t = b['ticketNo'];
      final matches = (m.ticketNo != null && t == m.ticketNo) ||
          (b['memberName'] == m.customerName);
      if (!matches) continue;
      final d = _numOrNull(b['bidDiscount']) ?? 0;
      if (bestDiscount == null || d > bestDiscount) bestDiscount = d;
    }
    if (bestDiscount == null) return null;
    return _chitValue - bestDiscount;
  }

  bool _isLeader(ChitMember m) {
    final highest = _live?['highestBid'] as Map<String, dynamic>?;
    if (highest == null) return false;
    final t = highest['ticketNo'];
    return (m.ticketNo != null && t == m.ticketNo) ||
        highest['memberName'] == m.customerName;
  }

  bool _isWinner(ChitMember m) {
    final w = _winner;
    if (w == null) return false;
    return w['memberId'] == m.id ||
        (m.ticketNo != null && w['ticketNo'] == m.ticketNo);
  }

  // ── Bidding ──────────────────────────────────────────────────────────────
  Future<void> _placeBid(ChitMember m, double prize,
      {String? source, String? transcript}) async {
    HapticFeedback.mediumImpact();
    await _run(() => _svc.addBid(
          widget.groupId,
          widget.auctionId,
          memberId: m.id,
          bidAmount: prize,
          source: source ?? 'tap',
          transcript: transcript,
        ));
    ref.speak('${m.customerName.split(' ').first} ${_speakAmount(prize)}');
  }

  /// Long-press a seat: one-confirm minimum bid ("tap to bid").
  Future<void> _quickBid(ChitMember m) async {
    if (!_roomOpen || _busy || m.hasWon) return;
    final fmt = ref.read(currencyFmtProvider);
    final prize = _minNextPrize;
    HapticFeedback.selectionClick();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Quick bid — ${m.customerName.split(' ').first}'),
        content: Text(
            'Bid ${fmt.format(prize)} (discount ${fmt.format(_chitValue - prize)})?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Bid')),
        ],
      ),
    );
    if (confirm == true) await _placeBid(m, prize, source: 'tap');
  }

  /// Fast path from the bottom bar: pick a member, min bid lands instantly.
  void _quickBidPicker() {
    if (!_roomOpen || _busy) return;
    final fmt = ref.read(currencyFmtProvider);
    final eligible = widget.members.where((m) => !m.hasWon).toList()
      ..sort((a, b) => a.memberNumber.compareTo(b.memberNumber));
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.bolt_rounded, color: AppColors.warning),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Quick bid ${fmt.format(_minNextPrize)}',
                      style: AppTypography.sectionTitle,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text('Tap the member raising their hand — bid lands instantly.',
                  style: AppTypography.caption
                      .copyWith(color: AppColors.textSecondary)),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: eligible.map((m) {
                  return ActionChip(
                    avatar: CircleAvatar(
                      backgroundColor: AppColors.primaryLight,
                      child: Text(
                        '${m.memberNumber}',
                        style: AppTypography.tiny
                            .copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    label: Text(m.customerName.split(' ').first),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _placeBid(m, _minNextPrize, source: 'tap');
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  /// Tap a seat: full bid sheet with quick-step chips + custom amount.
  void _tapSeat(ChitMember m) {
    if (_busy || m.hasWon) return;
    if (!_roomOpen) {
      // Outside bidding, tapping a seat manages attendance instead.
      if (widget.isAdmin) _showAttendanceSheet();
      return;
    }
    double amount = _minNextPrize;
    final fmt = ref.read(currencyFmtProvider);
    final customCtrl = TextEditingController();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setLocal) {
          void setAmount(double v) =>
              setLocal(() => amount = v.clamp(0, _chitValue).toDouble());
          final discount = (_chitValue - amount).clamp(0, _chitValue);
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 18,
                bottom: 18 + MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: AppColors.primaryLight,
                        foregroundImage: (m.profilePhoto == null ||
                                m.profilePhoto!.isEmpty)
                            ? null
                            : authedImage(ref, m.profilePhoto!),
                        child: Text('${m.memberNumber}',
                            style: AppTypography.tiny
                                .copyWith(fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Bid for ${m.customerName}',
                                style: AppTypography.sectionTitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                            Text(
                              'Prize accepted — lower prize = bigger discount',
                              style: AppTypography.tiny
                                  .copyWith(color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Quick-step chips (web parity: Min / steps).
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Min'),
                        selected: amount == _minNextPrize,
                        onSelected: (_) => setAmount(_minNextPrize),
                      ),
                      for (final step in const [500, 1000, 2000, 5000])
                        ActionChip(
                          label: Text('−${_short(step.toDouble())}'),
                          onPressed: () => setAmount(amount - step),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton.filledTonal(
                        onPressed: () => setAmount(amount - 1000),
                        icon: const Icon(Icons.remove),
                      ),
                      Column(
                        children: [
                          Text(fmt.format(amount),
                              style: AppTypography.heroNumber
                                  .copyWith(color: AppColors.textPrimary)),
                          Text('Discount ${fmt.format(discount)}',
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.success)),
                        ],
                      ),
                      IconButton.filledTonal(
                        onPressed: () => setAmount(amount + 1000),
                        icon: const Icon(Icons.add),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: customCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Custom prize amount',
                      prefixText: '₹ ',
                      isDense: true,
                    ),
                    onChanged: (v) {
                      final parsed = double.tryParse(v.replaceAll(',', ''));
                      if (parsed != null) setAmount(parsed);
                    },
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.onPrimary,
                          padding: const EdgeInsets.symmetric(vertical: 16)),
                      onPressed: amount > 0
                          ? () {
                              Navigator.pop(ctx);
                              _placeBid(m, amount, source: 'tap');
                            }
                          : null,
                      icon: const Icon(Icons.gavel_rounded, size: 18),
                      label: Text('Bid ${fmt.format(amount)}'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _voiceRaise() async {
    if (!_roomOpen) return;
    final lang = ref.read(languageProvider).code;
    final eligible = widget.members.where((m) => !m.hasWon).toList();
    await ref.read(voiceEntryProvider.notifier).listen(
      lang,
      onFinal: (text) {
        if (!mounted) return;
        final res = parseVoiceBid(text, eligible);
        if (res.candidates.isEmpty || !res.hasAmount) {
          ref.speak("Didn't catch that. Tap a seat to bid.");
          _snack("Didn't catch that — tap a seat to bid.");
          return;
        }
        final amount = res.amount!;
        if (res.isConfident) {
          _placeBid(res.best!.member, amount,
              source: 'voice', transcript: res.raw);
        } else {
          _chooseCandidate(res, amount);
        }
      },
    );
  }

  void _chooseCandidate(VoiceBidResult res, double amount) {
    final fmt = ref.read(currencyFmtProvider);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Did you mean?  •  ${fmt.format(amount)}',
                  style: AppTypography.sectionTitle),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: res.candidates.take(4).map((c) {
                  return ActionChip(
                    label: Text(c.member.customerName),
                    onPressed: () {
                      Navigator.pop(context);
                      _placeBid(c.member, amount,
                          source: 'voice', transcript: res.raw);
                    },
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  void _openChat() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _RoomChatSheet(
        groupId: widget.groupId,
        auctionId: widget.auctionId,
        isAdmin: widget.isAdmin,
      ),
    );
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink,
      appBar: AppBar(
        backgroundColor: AppColors.ink,
        foregroundColor: AppColors.onInk,
        elevation: 0,
        title: Text('Live Auction · Period ${widget.periodNumber}'),
        actions: [
          if (widget.isAdmin)
            IconButton(
              tooltip: 'Attendance',
              icon: const Icon(Icons.how_to_reg_rounded),
              onPressed: _busy ? null : _showAttendanceSheet,
            ),
          IconButton(
            tooltip: 'Minutes',
            icon: Icon(_showMinutes ? Icons.close : Icons.receipt_long_rounded),
            onPressed: () => setState(() => _showMinutes = !_showMinutes),
          ),
        ],
      ),
      body: _showMinutes
          ? _MinutesPanel(bids: _bids, chitValue: _chitValue)
          : Column(
              children: [
                if (_error != null)
                  Container(
                    width: double.infinity,
                    color: AppColors.dangerBg,
                    padding: const EdgeInsets.all(10),
                    child: Text(_error!,
                        style: AppTypography.caption
                            .copyWith(color: AppColors.danger)),
                  ),
                _InfoStrip(
                  presentCount: _presentCount,
                  totalMembers: _totalMembers,
                  bidCount: _bidCount,
                  sealed: _sealed,
                  onAttendance:
                      widget.isAdmin && !_busy ? _showAttendanceSheet : null,
                  onBids: () => setState(() => _showMinutes = true),
                  onChat: _openChat,
                ),
                Expanded(
                  child: _PokerTable(
                    members: widget.members,
                    periodNumber: widget.periodNumber,
                    chitValue: _chitValue,
                    roomStatus: _roomStatus,
                    seconds: _displaySeconds,
                    connecting: _live == null,
                    sealed: _sealed,
                    bidCount: _bidCount,
                    winner: _winner,
                    memberPrize: _memberPrize,
                    isLeader: _isLeader,
                    isWinner: _isWinner,
                    attendanceStatus: _attendanceStatus,
                    onTapSeat: _tapSeat,
                    onLongPressSeat: _quickBid,
                  ),
                ),
                _BottomBar(
                  busy: _busy,
                  isAdmin: widget.isAdmin,
                  roomOpen: _roomOpen,
                  roomClosed: _roomClosed,
                  hasWinner: _winner != null,
                  listening: ref.watch(voiceEntryProvider).listening,
                  onOpen: _openRoom,
                  onClose: _closeRoom,
                  onVoice: _voiceRaise,
                  onConfirm: _confirmWinner,
                  onQuickBid: _quickBidPicker,
                  onChat: _openChat,
                ),
              ],
            ),
    );
  }
}

/// Numeric fields can arrive as JSON strings when a server payload passes a
/// Prisma Decimal through unconverted — a bare `as num?` cast throws on those
/// and blanks the whole screen in release. Parse tolerantly instead.
double? _numOrNull(dynamic v) =>
    v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);

String _speakAmount(double amount) {
  if (amount <= 0) return 'zero rupees';
  final r = amount.round();
  if (r >= 100000) return '${(amount / 100000).toStringAsFixed(2)} lakh rupees';
  if (r >= 1000) return '${(amount / 1000).toStringAsFixed(1)} thousand rupees';
  return '$r rupees';
}

String _short(double v) {
  if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
  if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}k';
  return v.round().toString();
}

// ───────────────────────── Attendance helpers ─────────────────────────

String _attendanceLabel(String status) {
  switch (status) {
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    case 'proxy':
      return 'Proxy';
    default:
      return 'Not marked';
  }
}

IconData _attendanceIcon(String status) {
  switch (status) {
    case 'present':
      return Icons.check_circle_rounded;
    case 'absent':
      return Icons.cancel_rounded;
    case 'proxy':
      return Icons.supervised_user_circle_rounded;
    default:
      return Icons.radio_button_unchecked_rounded;
  }
}

Color _attendanceColor(String status) {
  switch (status) {
    case 'present':
      return AppColors.success;
    case 'absent':
      return AppColors.danger;
    case 'proxy':
      return AppColors.warning;
    default:
      return AppColors.textSecondary;
  }
}

// ───────────────────────── Info strip ─────────────────────────

/// Thin strip above the table: wall-facing counters that would clutter the
/// felt — attendance, bid count, chat. Everything tappable.
class _InfoStrip extends StatelessWidget {
  const _InfoStrip({
    required this.presentCount,
    required this.totalMembers,
    required this.bidCount,
    required this.sealed,
    required this.onAttendance,
    required this.onBids,
    required this.onChat,
  });
  final int presentCount;
  final int totalMembers;
  final int bidCount;
  final bool sealed;
  final VoidCallback? onAttendance;
  final VoidCallback onBids;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Row(
        children: [
          _chip(
            icon: Icons.how_to_reg_rounded,
            label: '$presentCount/$totalMembers',
            onTap: onAttendance,
          ),
          const SizedBox(width: 8),
          _chip(
            icon: Icons.gavel_rounded,
            label: sealed ? '$bidCount sealed' : '$bidCount bids',
            onTap: onBids,
          ),
          const Spacer(),
          _chip(
            icon: Icons.forum_rounded,
            label: 'Chat',
            onTap: onChat,
          ),
        ],
      ),
    );
  }

  Widget _chip(
      {required IconData icon, required String label, VoidCallback? onTap}) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.inkElevated,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.inkBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppColors.onInkMuted),
            const SizedBox(width: 5),
            Text(label,
                style: AppTypography.tiny.copyWith(
                    color: AppColors.onInk, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Poker table ─────────────────────────

class _PokerTable extends StatelessWidget {
  const _PokerTable({
    required this.members,
    required this.periodNumber,
    required this.chitValue,
    required this.roomStatus,
    required this.seconds,
    required this.connecting,
    required this.sealed,
    required this.bidCount,
    required this.winner,
    required this.memberPrize,
    required this.isLeader,
    required this.isWinner,
    required this.attendanceStatus,
    required this.onTapSeat,
    required this.onLongPressSeat,
  });
  final List<ChitMember> members;
  final int periodNumber;
  final double chitValue;
  final String roomStatus;
  final int seconds;
  final bool connecting;
  final bool sealed;
  final int bidCount;
  final Map<String, dynamic>? winner;
  final double? Function(ChitMember) memberPrize;
  final bool Function(ChitMember) isLeader;
  final bool Function(ChitMember) isWinner;
  final String Function(String memberId) attendanceStatus;
  final void Function(ChitMember) onTapSeat;
  final void Function(ChitMember) onLongPressSeat;

  @override
  Widget build(BuildContext context) {
    // The same real wooden-table photograph the web auction room uses, turned
    // vertical to suit the portrait phone: a tall oval with seats around it.
    return Center(
      child: AspectRatio(
        aspectRatio: 1536 / 2712,
        child: LayoutBuilder(
          builder: (context, box) {
            final w = box.maxWidth;
            final h = box.maxHeight;
            final cx = w / 2;
            final cy = h / 2;
            // Tall ellipse: seats sit just inside the felt rail.
            final rx = w * 0.34;
            final ry = h * 0.40;
            // Seats shrink as the ring fills so 25 members still fit.
            final seatRadius = members.length <= 8
                ? 22.0
                : (members.length <= 14 ? 18.0 : 14.0);
            return Stack(
              clipBehavior: Clip.none,
              children: [
                // The real poker-table photograph (shared with the web room),
                // rotated a quarter-turn so the oval stands vertically.
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: RotatedBox(
                      quarterTurns: 1,
                      child: ColorFiltered(
                        colorFilter: const ColorFilter.mode(
                            Color(0x14000000), BlendMode.darken),
                        child: Image.asset(
                          'assets/images/poker_table.png',
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  ),
                ),
                // Dark radial vignette so seats/hub read over the wood,
                // matching the web overlay (rgba(15,23,42,0.35 → 0.7)).
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: const RadialGradient(
                        radius: 0.95,
                        colors: [Color(0x590F172A), Color(0xB30F172A)],
                      ),
                    ),
                  ),
                ),
                // Center hub: period, digital countdown, chit value.
                Center(
                  child: _CenterHub(
                    periodNumber: periodNumber,
                    chitValue: chitValue,
                    roomStatus: roomStatus,
                    seconds: seconds,
                    connecting: connecting,
                    sealed: sealed,
                    bidCount: bidCount,
                    winner: winner,
                    members: members,
                    memberPrize: memberPrize,
                  ),
                ),
                Positioned(
                  top: 12,
                  left: 12,
                  child: _CornerClock(now: DateTime.now()),
                ),
                for (var i = 0; i < members.length; i++)
                  _seat(
                      cx,
                      cy,
                      rx,
                      ry,
                      -math.pi / 2 + (2 * math.pi * i / members.length),
                      members[i],
                      seatRadius),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _seat(double cx, double cy, double rx, double ry, double angle,
      ChitMember m, double radius) {
    final x = cx + rx * math.cos(angle);
    final y = cy + ry * math.sin(angle);
    return Positioned(
      left: x - 46,
      top: y - radius - 18,
      width: 92,
      child: _SeatChip(
        member: m,
        prize: memberPrize(m),
        leader: isLeader(m),
        winner: isWinner(m),
        attendance: attendanceStatus(m.id),
        radius: radius,
        onTap: () => onTapSeat(m),
        onLongPress: () => onLongPressSeat(m),
      ),
    );
  }
}

class _SeatChip extends ConsumerWidget {
  const _SeatChip({
    required this.member,
    required this.prize,
    required this.leader,
    required this.winner,
    required this.attendance,
    required this.radius,
    required this.onTap,
    required this.onLongPress,
  });
  final ChitMember member;
  final double? prize;
  final bool leader;
  final bool winner;
  final String attendance;
  final double radius;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final won = member.hasWon || winner;
    final border = winner
        ? AppColors.warning
        : leader
            ? AppColors.primary
            : AppColors.inkBorder;
    final attColor = _attendanceColor(attendance);
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: border, width: leader || winner ? 3 : 1.5),
                  boxShadow: leader || winner
                      ? [
                          BoxShadow(
                              color: border.withAlpha(120), blurRadius: 12)
                        ]
                      : null,
                ),
                child: CircleAvatar(
                  radius: radius,
                  backgroundColor:
                      won ? AppColors.inkElevated : const Color(0xFF2A2D35),
                  foregroundImage:
                      (member.profilePhoto == null ||
                              member.profilePhoto!.isEmpty)
                          ? null
                          : authedImage(ref, member.profilePhoto!),
                  child: Text(
                    member.customerName.isEmpty
                        ? '?'
                        : member.customerName[0].toUpperCase(),
                    style: AppTypography.body.copyWith(
                        color: won ? AppColors.onInkMuted : AppColors.onInk),
                  ),
                ),
              ),
              // Attendance dot (present/absent/proxy) — top-right of avatar.
              if (attendance != 'unmarked')
                Positioned(
                  top: -1,
                  right: 18 - radius,
                  child: Container(
                    width: 11,
                    height: 11,
                    decoration: BoxDecoration(
                      color: attColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: _kFeltFrame, width: 1.5),
                    ),
                  ),
                ),
              // Winner crown.
              if (winner)
                Positioned(
                  top: -14,
                  child: Icon(Icons.emoji_events_rounded,
                      size: 18, color: AppColors.warning),
                ),
              // Leader chip: floats above whoever holds the current best bid,
              // moves automatically as the leader changes each poll.
              if (!winner && leader && prize != null)
                Positioned(
                  top: -26,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: [
                        BoxShadow(
                            color: AppColors.primary.withAlpha(140),
                            blurRadius: 8)
                      ],
                    ),
                    child: Text('₹${_short(prize!)}',
                        style: AppTypography.tiny.copyWith(
                            color: AppColors.onPrimary,
                            fontWeight: FontWeight.w800)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 3),
          // Numbered seat tag — "1. Ramesh" like the web table.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xCC0B1220),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                  color: leader || winner ? border : AppColors.inkBorder,
                  width: 1),
            ),
            child: Text(
              '${member.memberNumber}. ${member.customerName.split(' ').first}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.tiny.copyWith(
                  fontSize: 10,
                  color: won ? AppColors.onInkMuted : AppColors.onInk,
                  fontWeight: FontWeight.w700),
            ),
          ),
          if (prize != null)
            Text('₹${_short(prize!)}',
                style: AppTypography.tiny.copyWith(
                    color: leader ? AppColors.primary : AppColors.onInkMuted,
                    fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

/// Wall-clock corner badge. Rebuilds off the screen's existing 1s ticker
/// (parent already calls setState every second for the countdown) — no
/// separate timer needed here.
class _CornerClock extends StatelessWidget {
  const _CornerClock({required this.now});
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.ink.withAlpha(200),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.inkBorder, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(DateFormat('HH:mm:ss').format(now),
              style: AppTypography.tiny.copyWith(
                  color: AppColors.onInk,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()])),
          Text(DateFormat('EEE, d MMM y').format(now),
              style: AppTypography.tiny
                  .copyWith(color: AppColors.onInkMuted, fontSize: 9)),
        ],
      ),
    );
  }
}

/// Dark glass hub in the middle of the wooden table — the web parity piece:
/// "CHIT PERIOD N", the big digital countdown, and the chit value.
class _CenterHub extends StatelessWidget {
  const _CenterHub({
    required this.periodNumber,
    required this.chitValue,
    required this.roomStatus,
    required this.seconds,
    required this.connecting,
    required this.sealed,
    required this.bidCount,
    required this.winner,
    required this.members,
    required this.memberPrize,
  });
  final int periodNumber;
  final double chitValue;
  final String roomStatus;
  final int seconds;
  final bool connecting;
  final bool sealed;
  final int bidCount;
  final Map<String, dynamic>? winner;
  final List<ChitMember> members;
  final double? Function(ChitMember) memberPrize;

  @override
  Widget build(BuildContext context) {
    final open = roomStatus == 'open' || roomStatus == 'extended';
    // Lowest prize on the table = biggest discount = current leader.
    double? lowestPrize;
    for (final m in members) {
      final p = memberPrize(m);
      if (p != null && (lowestPrize == null || p < lowestPrize)) {
        lowestPrize = p;
      }
    }
    final prize = lowestPrize ?? chitValue;
    final discount = chitValue - prize;
    final urgent = open && seconds <= 10;
    final timerColor = urgent
        ? AppColors.danger
        : (roomStatus == 'extended' ? AppColors.warning : _kTimerCyan);
    final timeText =
        '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';

    return Container(
      constraints: const BoxConstraints(maxWidth: 210),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: _kHub.withAlpha(235),
        borderRadius: const BorderRadius.all(Radius.elliptical(220, 150)),
        border: Border.all(color: _kHubBorder, width: 1.5),
        boxShadow: const [
          BoxShadow(color: Color(0xAA000000), blurRadius: 20, spreadRadius: 2),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('CHIT PERIOD $periodNumber',
              style: AppTypography.tiny.copyWith(
                  color: AppColors.onInkMuted,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          if (connecting) ...[
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(height: 6),
            Text('Connecting…',
                style:
                    AppTypography.tiny.copyWith(color: AppColors.onInkMuted)),
          ] else if (winner != null) ...[
            Icon(Icons.emoji_events_rounded,
                color: AppColors.warning, size: 30),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                (winner!['name'] as String?) ?? '',
                style: AppTypography.sectionTitle
                    .copyWith(color: AppColors.onInk),
              ),
            ),
            Text('WINNER',
                style: AppTypography.tiny.copyWith(
                    color: AppColors.warning,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w800)),
            if (discount > 0)
              Text('Prize ₹${_short(prize)} · Discount ₹${_short(discount)}',
                  style: AppTypography.tiny
                      .copyWith(color: AppColors.onInkMuted)),
          ] else if (open) ...[
            // Digital countdown with a soft glow, web-style.
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.timer_outlined, size: 18, color: timerColor),
                const SizedBox(width: 6),
                AnimatedScale(
                  scale: urgent && seconds.isOdd ? 1.08 : 1.0,
                  duration: const Duration(milliseconds: 300),
                  child: Text(
                    timeText,
                    style: TextStyle(
                      color: timerColor,
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                      fontFeatures: const [FontFeature.tabularFigures()],
                      shadows: [
                        Shadow(color: timerColor.withAlpha(140), blurRadius: 16),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            Text(
              roomStatus == 'extended' ? 'ANTI-SNIPE' : 'BIDDING OPEN',
              style: AppTypography.tiny.copyWith(
                  color: timerColor,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            if (sealed)
              Text('Sealed · $bidCount bids in',
                  style:
                      AppTypography.tiny.copyWith(color: AppColors.onInkMuted))
            else ...[
              Text('Current prize ₹${_short(prize)}',
                  style: AppTypography.body.copyWith(
                      color: AppColors.onInk, fontWeight: FontWeight.w700)),
              if (discount > 0)
                Text('Discount ₹${_short(discount)}',
                    style:
                        AppTypography.tiny.copyWith(color: AppColors.success)),
            ],
          ] else ...[
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                roomStatus == 'closed' ? 'CLOSED' : 'SCHEDULED',
                style: AppTypography.sectionTitle.copyWith(
                    color: AppColors.onInkMuted,
                    fontSize: 24,
                    letterSpacing: 3),
              ),
            ),
            Text(
              roomStatus == 'closed'
                  ? 'Confirm the winner below'
                  : 'Waiting for the organizer to open',
              textAlign: TextAlign.center,
              style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted),
            ),
            if (!sealed && discount > 0) ...[
              const SizedBox(height: 4),
              Text('Best ₹${_short(prize)} · Discount ₹${_short(discount)}',
                  style: AppTypography.tiny.copyWith(color: AppColors.primary)),
            ],
          ],
          const SizedBox(height: 8),
          Text('Chit Value: ₹${NumberFormat('#,##,###').format(chitValue)}',
              style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted)),
        ],
      ),
    );
  }
}

// ───────────────────────── Bottom bar ─────────────────────────

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.busy,
    required this.isAdmin,
    required this.roomOpen,
    required this.roomClosed,
    required this.hasWinner,
    required this.listening,
    required this.onOpen,
    required this.onClose,
    required this.onVoice,
    required this.onConfirm,
    required this.onQuickBid,
    required this.onChat,
  });
  final bool busy;
  final bool isAdmin;
  final bool roomOpen;
  final bool roomClosed;
  final bool hasWinner;
  final bool listening;
  final VoidCallback onOpen;
  final VoidCallback onClose;
  final VoidCallback onVoice;
  final VoidCallback onConfirm;
  final VoidCallback onQuickBid;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (roomOpen) ...[
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor:
                            listening ? AppColors.danger : AppColors.primary,
                        foregroundColor: AppColors.onPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      onPressed: busy ? null : onVoice,
                      icon:
                          Icon(listening ? Icons.mic : Icons.mic_none_rounded),
                      label: Text(listening ? 'Listening…' : 'Voice Raise',
                          style: AppTypography.bodyLarge.copyWith(
                              color: AppColors.onPrimary,
                              fontWeight: FontWeight.w700)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.inkElevated,
                        foregroundColor: AppColors.onInk,
                        side: const BorderSide(color: AppColors.inkBorder),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      onPressed: busy ? null : onQuickBid,
                      icon: const Icon(Icons.bolt_rounded, size: 18),
                      label: const Text('Quick bid'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                if (isAdmin && !roomOpen && !roomClosed && !hasWinner)
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.onPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: busy ? null : onOpen,
                      icon: const Icon(Icons.play_arrow_rounded, size: 18),
                      label: const Text('Open room'),
                    ),
                  ),
                if (isAdmin && roomOpen)
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.onInk,
                        side: const BorderSide(color: AppColors.inkBorder),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: busy ? null : onClose,
                      icon: const Icon(Icons.stop_rounded, size: 18),
                      label: const Text('Close bidding'),
                    ),
                  ),
                if (isAdmin && roomClosed && !hasWinner)
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.success,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: busy ? null : onConfirm,
                      icon: const Icon(Icons.emoji_events_rounded, size: 18),
                      label: const Text('Confirm winner'),
                    ),
                  ),
                if (isAdmin && (roomOpen || (roomClosed && !hasWinner)))
                  const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.onInk,
                      side: const BorderSide(color: AppColors.inkBorder),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: onChat,
                    icon: const Icon(Icons.forum_rounded, size: 18),
                    label: const Text('Room chat'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Room chat ─────────────────────────

/// Bottom-sheet chat for the live room. Shares the ChitRoomMessage thread
/// with the web dashboard, so staff on web and the hall phone see one
/// conversation. Polls while open; the send row supports organizer-only
/// notes (staff never leak to the projector).
class _RoomChatSheet extends ConsumerStatefulWidget {
  const _RoomChatSheet({
    required this.groupId,
    required this.auctionId,
    required this.isAdmin,
  });
  final String groupId;
  final String auctionId;
  final bool isAdmin;

  @override
  ConsumerState<_RoomChatSheet> createState() => _RoomChatSheetState();
}

class _RoomChatSheetState extends ConsumerState<_RoomChatSheet> {
  final _ctrl = TextEditingController();
  final _scroll = ScrollController();
  Timer? _timer;
  List<RoomMessage> _messages = const [];
  bool _toOrganizer = false;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await ref
          .read(chitServiceProvider)
          .roomMessages(widget.groupId, widget.auctionId);
      if (!mounted) return;
      final atBottom = !_scroll.hasClients ||
          _scroll.position.pixels >= _scroll.position.maxScrollExtent - 60;
      setState(() {
        _messages = list;
        _error = null;
      });
      if (atBottom && _scroll.hasClients) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scroll.hasClients) {
            _scroll.jumpTo(_scroll.position.maxScrollExtent);
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(chitServiceProvider).sendRoomMessage(
            widget.groupId,
            widget.auctionId,
            body: text,
            toOrganizer: _toOrganizer,
          );
      _ctrl.clear();
      await _load();
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    }
    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    final tf = DateFormat('HH:mm');
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.62,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                child: Row(
                  children: [
                    const Icon(Icons.forum_rounded, size: 20),
                    const SizedBox(width: 8),
                    Text('Room chat', style: AppTypography.sectionTitle),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(_error!,
                      style: AppTypography.tiny
                          .copyWith(color: AppColors.danger)),
                ),
              Expanded(
                child: _messages.isEmpty
                    ? Center(
                        child: Text('No messages yet.',
                            style: AppTypography.caption
                                .copyWith(color: AppColors.textSecondary)),
                      )
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        itemCount: _messages.length,
                        itemBuilder: (_, i) {
                          final msg = _messages[i];
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 5),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (msg.isPrivate)
                                  const Padding(
                                    padding: EdgeInsets.only(right: 4, top: 2),
                                    child: Icon(Icons.lock_rounded,
                                        size: 12, color: AppColors.warning),
                                  ),
                                Expanded(
                                  child: RichText(
                                    text: TextSpan(
                                      style: AppTypography.body.copyWith(
                                          color: AppColors.textPrimary),
                                      children: [
                                        TextSpan(
                                          text: '${msg.senderName}  ',
                                          style: AppTypography.caption
                                              .copyWith(
                                                  fontWeight: FontWeight.w700),
                                        ),
                                        TextSpan(text: msg.body),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(tf.format(msg.createdAt),
                                    style: AppTypography.tiny.copyWith(
                                        color: AppColors.textLight)),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _ctrl,
                            minLines: 1,
                            maxLines: 3,
                            textInputAction: TextInputAction.send,
                            onSubmitted: (_) => _send(),
                            decoration: const InputDecoration(
                              hintText: 'Message the room…',
                              isDense: true,
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filled(
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.onPrimary,
                          ),
                          onPressed: _sending ? null : _send,
                          icon: const Icon(Icons.send_rounded),
                        ),
                      ],
                    ),
                    if (widget.isAdmin)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Checkbox(
                              value: _toOrganizer,
                              visualDensity: VisualDensity.compact,
                              onChanged: (v) =>
                                  setState(() => _toOrganizer = v ?? false),
                            ),
                            Text('Organizer-only',
                                style: AppTypography.caption),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ───────────────────────── Minutes ─────────────────────────

class _MinutesPanel extends ConsumerWidget {
  const _MinutesPanel({required this.bids, required this.chitValue});
  final List<Map<String, dynamic>> bids;
  final double chitValue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = ref.watch(currencyFmtProvider);
    final tf = DateFormat('HH:mm:ss');
    final rows = [...bids];
    rows.sort((a, b) {
      final ta =
          DateTime.tryParse(a['bidTime'] as String? ?? '') ?? DateTime(0);
      final tb =
          DateTime.tryParse(b['bidTime'] as String? ?? '') ?? DateTime(0);
      return tb.compareTo(ta);
    });
    return Container(
      color: AppColors.ink,
      child: rows.isEmpty
          ? Center(
              child: Text('No bids yet',
                  style:
                      AppTypography.body.copyWith(color: AppColors.onInkMuted)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: rows.length,
              itemBuilder: (_, i) {
                final b = rows[i];
                final t = DateTime.tryParse(b['bidTime'] as String? ?? '')
                        ?.toLocal() ??
                    DateTime.now();
                final discount = _numOrNull(b['bidDiscount']) ?? 0;
                final prize = chitValue - discount;
                final name = (b['memberName'] as String?) ?? '';
                final ticket = b['ticketNo'] ?? '—';
                final leading = i == 0;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tf.format(t),
                          style: AppTypography.tiny
                              .copyWith(color: AppColors.onInkMuted)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                            '$name (ticket $ticket) → ${fmt.format(prize)}'
                            '${discount > 0 ? '  (−${fmt.format(discount)})' : ''}',
                            style: AppTypography.body.copyWith(
                                color: leading
                                    ? AppColors.primary
                                    : AppColors.onInk)),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

// ───────────────────────── Small number field ─────────────────────────

class _NumberField extends StatelessWidget {
  const _NumberField(
      {required this.label, required this.value, required this.onChanged});
  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: value.toString(),
      decoration: InputDecoration(labelText: label),
      keyboardType: TextInputType.number,
      onChanged: (v) => onChanged(int.tryParse(v) ?? value),
    );
  }
}
