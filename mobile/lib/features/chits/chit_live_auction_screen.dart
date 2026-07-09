import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/app_strings.dart'; // AppLangX.code extension
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/features/chits/voice_bid_parser.dart';
import 'package:loantrack/features/collection/voice_entry_controller.dart';

/// Live chit auction as a "poker table": subscribers seated around an oval, a
/// server-authoritative countdown in the middle, and bids raised by tap OR by
/// voice ("Ramesh forty thousand"). Drives the existing room/bids/live/confirm
/// endpoints — the poker table is a presentation over that backend, nothing
/// about the auction lifecycle or settlement changes.
class ChitLiveAuctionScreen extends ConsumerStatefulWidget {
  const ChitLiveAuctionScreen({
    super.key,
    required this.groupId,
    required this.auctionId,
    required this.periodNumber,
    required this.members,
    this.isAdmin = false,
  });

  final String groupId;
  final String auctionId;
  final int periodNumber;
  final List<ChitMember> members;
  final bool isAdmin;

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
        _secondsAtPoll = (state['secondsRemaining'] as num?)?.toInt() ?? 0;
        _polledAt = DateTime.now();
      });
      _announceLeader(state);
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
    final chitValue = (state['chitValue'] as num?)?.toDouble() ?? 0;
    final discount = (highest['bidDiscount'] as num?)?.toDouble() ?? 0;
    ref.speak('$name ${_speakAmount(chitValue - discount)}');
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
        setState(
            () => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _openRoom() async {
    int duration = 30;
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
                label: 'Duration (seconds)',
                value: duration,
                onChanged: (v) => setLocal(() => duration = v),
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
            durationMinutes: (duration / 60).ceil().clamp(1, 120),
            autoExtendSeconds: antiSnipe)
        .then((_) {}));
  }

  Future<void> _closeRoom() async {
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

  // ── Bidding ──────────────────────────────────────────────────────────────
  double get _chitValue => (_live?['chitValue'] as num?)?.toDouble() ?? 0;

  double? get _highestDiscount {
    final h = _live?['highestBid'] as Map<String, dynamic>?;
    final d = h?['bidDiscount'] as num?;
    return d?.toDouble();
  }

  double get _minNextPrize {
    // Prize must go DOWN. Prefer the server's min next discount; else step ₹1.
    final minNextDiscount = (_live?['minNextDiscount'] as num?)?.toDouble();
    if (minNextDiscount != null && _chitValue > 0) {
      return (_chitValue - minNextDiscount).clamp(0, _chitValue).toDouble();
    }
    final cur = _highestDiscount ?? 0;
    return (_chitValue - cur - 1).clamp(0, _chitValue).toDouble();
  }

  Future<void> _placeBid(ChitMember m, double prize,
      {String? source, String? transcript}) async {
    await _run(() => _svc.addBid(
          widget.groupId,
          widget.auctionId,
          memberId: m.id,
          bidAmount: prize,
          remarks: transcript,
        ));
    ref.speak('${m.customerName.split(' ').first} ${_speakAmount(prize)}');
  }

  void _tapSeat(ChitMember m) {
    if (!_roomOpen || _busy || m.hasWon) return;
    double amount = _minNextPrize;
    final fmt = ref.read(currencyFmtProvider);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setLocal) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Bid for ${m.customerName}',
                    style: AppTypography.sectionTitle),
                const SizedBox(height: 4),
                Text('Prize accepted (lower = bigger discount)',
                    style: AppTypography.caption
                        .copyWith(color: AppColors.textSecondary)),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton.filledTonal(
                      onPressed: () => setLocal(() => amount =
                          (amount - 1000).clamp(0, _chitValue).toDouble()),
                      icon: const Icon(Icons.remove),
                    ),
                    Text(fmt.format(amount),
                        style: AppTypography.heroNumber
                            .copyWith(color: AppColors.textPrimary)),
                    IconButton.filledTonal(
                      onPressed: () => setLocal(() => amount =
                          (amount + 1000).clamp(0, _chitValue).toDouble()),
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
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
                    child: Text('Bid ${fmt.format(amount)}'),
                  ),
                ),
              ],
            ),
          ),
        ),
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

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  // ── Live state helpers ─────────────────────────────────────────────────
  String get _roomStatus => (_live?['roomStatus'] as String?) ?? 'scheduled';
  bool get _roomOpen => _roomStatus == 'open' || _roomStatus == 'extended';
  bool get _roomClosed => _roomStatus == 'closed';

  List<Map<String, dynamic>> get _bids =>
      (_live?['bids'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

  /// Best (lowest) prize a member has bid this round, or null.
  double? _memberPrize(ChitMember m) {
    double? bestDiscount;
    for (final b in _bids) {
      final t = b['ticketNo'];
      final matches = (m.ticketNo != null && t == m.ticketNo) ||
          (b['memberName'] == m.customerName);
      if (!matches) continue;
      final d = (b['bidDiscount'] as num?)?.toDouble() ?? 0;
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
                Expanded(
                  child: _PokerTable(
                    members: widget.members,
                    chitValue: _chitValue,
                    roomStatus: _roomStatus,
                    seconds: _displaySeconds,
                    memberPrize: _memberPrize,
                    isLeader: _isLeader,
                    onTapSeat: _tapSeat,
                  ),
                ),
                _BottomBar(
                  busy: _busy,
                  isAdmin: widget.isAdmin,
                  roomOpen: _roomOpen,
                  roomClosed: _roomClosed,
                  listening: ref.watch(voiceEntryProvider).listening,
                  onOpen: _openRoom,
                  onClose: _closeRoom,
                  onVoice: _voiceRaise,
                  onConfirm: _confirmWinner,
                ),
              ],
            ),
    );
  }
}

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

// ───────────────────────── Poker table ─────────────────────────

class _PokerTable extends StatelessWidget {
  const _PokerTable({
    required this.members,
    required this.chitValue,
    required this.roomStatus,
    required this.seconds,
    required this.memberPrize,
    required this.isLeader,
    required this.onTapSeat,
  });
  final List<ChitMember> members;
  final double chitValue;
  final String roomStatus;
  final int seconds;
  final double? Function(ChitMember) memberPrize;
  final bool Function(ChitMember) isLeader;
  final void Function(ChitMember) onTapSeat;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final h = box.maxHeight;
        final cx = w / 2;
        final cy = h / 2;
        final rx = w * 0.40;
        final ry = h * 0.40;
        return Stack(
          children: [
            Center(
              child: Container(
                width: w * 0.82,
                height: h * 0.80,
                decoration: BoxDecoration(
                  color: const Color(0xFF14532D),
                  borderRadius: BorderRadius.all(Radius.elliptical(w, h)),
                  border: Border.all(color: AppColors.inkBorder, width: 6),
                  boxShadow: const [
                    BoxShadow(
                        color: Color(0x66000000),
                        blurRadius: 24,
                        spreadRadius: 2),
                  ],
                ),
              ),
            ),
            Center(
              child: _CenterPot(
                members: members,
                chitValue: chitValue,
                roomStatus: roomStatus,
                seconds: seconds,
                memberPrize: memberPrize,
              ),
            ),
            for (var i = 0; i < members.length; i++)
              _seat(cx, cy, rx, ry,
                  -math.pi / 2 + (2 * math.pi * i / members.length), members[i]),
          ],
        );
      },
    );
  }

  Widget _seat(double cx, double cy, double rx, double ry, double angle,
      ChitMember m) {
    final x = cx + rx * math.cos(angle);
    final y = cy + ry * math.sin(angle);
    return Positioned(
      left: x - 44,
      top: y - 40,
      width: 88,
      child: _SeatChip(
        member: m,
        prize: memberPrize(m),
        leader: isLeader(m),
        radius: 24,
        onTap: () => onTapSeat(m),
      ),
    );
  }
}

class _SeatChip extends StatelessWidget {
  const _SeatChip({
    required this.member,
    required this.prize,
    required this.leader,
    required this.radius,
    required this.onTap,
  });
  final ChitMember member;
  final double? prize;
  final bool leader;
  final double radius;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final border = leader ? AppColors.primary : AppColors.inkBorder;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: border, width: leader ? 3 : 1.5),
              boxShadow: leader
                  ? [
                      BoxShadow(
                          color: AppColors.primary.withAlpha(120),
                          blurRadius: 12)
                    ]
                  : null,
            ),
            child: CircleAvatar(
              radius: radius,
              backgroundColor: member.hasWon
                  ? AppColors.inkElevated
                  : const Color(0xFF2A2D35),
              child: Text(
                member.customerName.isEmpty
                    ? '?'
                    : member.customerName[0].toUpperCase(),
                style: AppTypography.body.copyWith(
                    color:
                        member.hasWon ? AppColors.onInkMuted : AppColors.onInk),
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            member.customerName.split(' ').first,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.tiny.copyWith(
                color: member.hasWon ? AppColors.onInkMuted : AppColors.onInk),
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

class _CenterPot extends StatelessWidget {
  const _CenterPot({
    required this.members,
    required this.chitValue,
    required this.roomStatus,
    required this.seconds,
    required this.memberPrize,
  });
  final List<ChitMember> members;
  final double chitValue;
  final String roomStatus;
  final int seconds;
  final double? Function(ChitMember) memberPrize;

  @override
  Widget build(BuildContext context) {
    final open = roomStatus == 'open' || roomStatus == 'extended';
    // Lowest prize on the table = biggest discount = current leader.
    double? lowestPrize;
    for (final m in members) {
      final p = memberPrize(m);
      if (p != null && (lowestPrize == null || p < lowestPrize)) lowestPrize = p;
    }
    final prize = lowestPrize ?? chitValue;
    final discount = chitValue - prize;
    final urgent = open && seconds <= 5;
    final timeColor = urgent
        ? AppColors.danger
        : (roomStatus == 'extended' ? AppColors.warning : AppColors.primary);

    return SizedBox(
      width: 170,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Current prize',
              style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted)),
          Text('₹${_short(prize)}',
              style: AppTypography.sectionTitle
                  .copyWith(color: AppColors.onInk, fontSize: 26)),
          if (discount > 0)
            Text('Discount ₹${_short(discount)}',
                style: AppTypography.tiny.copyWith(color: AppColors.primary)),
          const SizedBox(height: 8),
          Text(
            open
                ? '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}'
                : roomStatus.toUpperCase(),
            style: AppTypography.heroNumber.copyWith(
                color: open ? timeColor : AppColors.onInkMuted, fontSize: 30),
          ),
          Text(
            open
                ? (roomStatus == 'extended' ? 'Anti-snipe' : 'Bidding open')
                : roomStatus == 'closed'
                    ? 'Closed — confirm winner'
                    : 'Not opened',
            style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted),
          ),
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
    required this.listening,
    required this.onOpen,
    required this.onClose,
    required this.onVoice,
    required this.onConfirm,
  });
  final bool busy;
  final bool isAdmin;
  final bool roomOpen;
  final bool roomClosed;
  final bool listening;
  final VoidCallback onOpen;
  final VoidCallback onClose;
  final VoidCallback onVoice;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (roomOpen)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        listening ? AppColors.danger : AppColors.primary,
                    foregroundColor: AppColors.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  onPressed: busy ? null : onVoice,
                  icon: Icon(listening ? Icons.mic : Icons.mic_none_rounded),
                  label: Text(listening ? 'Listening…' : 'Voice Raise',
                      style: AppTypography.bodyLarge.copyWith(
                          color: AppColors.onPrimary,
                          fontWeight: FontWeight.w700)),
                ),
              ),
            if (roomOpen) const SizedBox(height: 8),
            Row(
              children: [
                if (isAdmin && !roomOpen && !roomClosed)
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
                      label: const Text('Close'),
                    ),
                  ),
                if (isAdmin && roomClosed)
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
              ],
            ),
          ],
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
                  style: AppTypography.body
                      .copyWith(color: AppColors.onInkMuted)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: rows.length,
              itemBuilder: (_, i) {
                final b = rows[i];
                final t = DateTime.tryParse(b['bidTime'] as String? ?? '')
                        ?.toLocal() ??
                    DateTime.now();
                final discount = (b['bidDiscount'] as num?)?.toDouble() ?? 0;
                final prize = chitValue - discount;
                final name = (b['memberName'] as String?) ?? '';
                final ticket = b['ticketNo'] ?? '—';
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
                            '$name (ticket $ticket) → ${fmt.format(prize)}',
                            style: AppTypography.body
                                .copyWith(color: AppColors.primary)),
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
