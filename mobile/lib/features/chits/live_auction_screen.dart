import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/app_strings.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/authed_image.dart';
import 'package:loantrack/core/network/api_exception.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit_live.dart';
import 'package:loantrack/data/services/chit_service.dart';
import 'package:loantrack/features/chits/voice_bid_parser.dart';
import 'package:loantrack/features/collection/voice_entry_controller.dart';
import 'package:loantrack/data/models/chit.dart';

/// Live chit auction — a "poker table" where subscribers sit around an oval, a
/// server-authoritative countdown runs, and the foreman raises bids for members
/// (by tap or by voice). Polls `…/state` every 1.5s; write responses return the
/// fresh state so the UI reconciles immediately.
class LiveAuctionScreen extends ConsumerStatefulWidget {
  const LiveAuctionScreen({super.key, required this.groupId, required this.period});
  final String groupId;
  final int period;

  @override
  ConsumerState<LiveAuctionScreen> createState() => _LiveAuctionScreenState();
}

class _LiveAuctionScreenState extends ConsumerState<LiveAuctionScreen> {
  Timer? _pollTimer;
  Timer? _tickTimer;
  bool _busy = false;
  bool _closing = false;
  bool _showMinutes = false;
  String? _lastAnnouncedBidId;

  ({String groupId, int period}) get _key =>
      (groupId: widget.groupId, period: widget.period);

  @override
  void initState() {
    super.initState();
    // 1.5s poll of the live state.
    _pollTimer = Timer.periodic(const Duration(milliseconds: 1500), (_) {
      if (mounted) ref.invalidate(liveAuctionStateProvider(_key));
    });
    // 1s tick just to re-render the countdown ring between polls.
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    super.dispose();
  }

  ChitService get _svc => ref.read(chitServiceProvider);

  void _applyState(LiveAuctionState s) {
    _maybeAnnounce(s);
    ref.invalidate(liveAuctionStateProvider(_key));
  }

  void _maybeAnnounce(LiveAuctionState s) {
    if (s.recentBids.isEmpty) return;
    final latest = s.recentBids.first;
    if (latest.kind != 'bid' || latest.id == _lastAnnouncedBidId) return;
    _lastAnnouncedBidId = latest.id;
    final seat = s.seatOf(latest.memberId);
    final name = seat?.name ?? '';
    ref.speak('$name ${_speakAmount(latest.prizeAmount)}');
  }

  Future<void> _open() async {
    setState(() => _busy = true);
    try {
      final s = await _svc.openAuction(widget.groupId, widget.period);
      _applyState(s);
    } catch (e) {
      _snack(_msg(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _placeBid(
    String memberId,
    double prize, {
    String source = 'tap',
    String? transcript,
  }) async {
    setState(() => _busy = true);
    try {
      final s = await _svc.submitBid(
        widget.groupId,
        widget.period,
        memberId: memberId,
        prizeAmount: prize,
        source: source,
        transcript: transcript,
      );
      _applyState(s);
    } catch (e) {
      _snack(_msg(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pass(String memberId) async {
    setState(() => _busy = true);
    try {
      final s = await _svc.passMember(widget.groupId, widget.period, memberId: memberId);
      _applyState(s);
      if (s.autoClose) await _declare(s);
    } catch (e) {
      _snack(_msg(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _undo() async {
    setState(() => _busy = true);
    try {
      final s = await _svc.undoBid(widget.groupId, widget.period);
      _applyState(s);
    } catch (e) {
      _snack(_msg(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _declare(LiveAuctionState s) async {
    if (_closing) return;
    if (s.currentBest == null) {
      _snack(T.of(ref).x('chit.live.no_bids'));
      return;
    }
    _closing = true;
    setState(() => _busy = true);
    try {
      final res = await _svc.closeAuction(widget.groupId, widget.period);
      final w = res.settlement ?? res.winner;
      final seat = w != null ? res.seatOf(w.winnerMemberId) : null;
      if (w != null) {
        ref.speak(
            '${T.of(ref).x('chit.live.winner_is')} ${seat?.name ?? ''}, ${_speakAmount(w.prizeAmount)}');
      }
      ref.invalidate(liveAuctionStateProvider(_key));
    } catch (e) {
      _closing = false;
      _snack(_msg(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ── Voice raise ──────────────────────────────────────────────────────────
  Future<void> _raiseByVoice(LiveAuctionState s) async {
    final t = T.of(ref);
    final lang = ref.read(languageProvider).code;
    final members = s.seats
        .where((seat) => seat.active)
        .map((seat) => ChitMember(
              id: seat.memberId,
              memberNumber: seat.memberNumber,
              customerName: seat.name,
              customerCode: seat.customerCode,
              hasWon: seat.hasWon,
              profilePhoto: seat.profilePhoto,
            ))
        .toList();
    await ref.read(voiceEntryProvider.notifier).listen(
      lang,
      onFinal: (text) {
        if (!mounted) return;
        final res = parseVoiceBid(text, members);
        final amount = res.amount ??
            (s.currentPrize - s.minBidDecrement).clamp(0, double.infinity).toDouble();
        if (res.candidates.isEmpty) {
          ref.speak(t.x('chit.live.not_understood'));
          _snack(t.x('chit.live.not_understood'));
          return;
        }
        if (res.isConfident) {
          _placeBid(res.best!.member.id, amount, source: 'voice', transcript: res.raw);
        } else {
          _chooseCandidate(res, amount);
        }
      },
    );
  }

  void _chooseCandidate(VoiceBidResult res, double amount) {
    final t = T.of(ref);
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
              Text('${t.x('chit.live.did_you_mean')}  •  ${fmt.format(amount)}',
                  style: AppTypography.nameLg),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: res.candidates.take(4).map((c) {
                  return ActionChip(
                    label: Text(c.member.customerName),
                    onPressed: () {
                      Navigator.of(context).pop();
                      _placeBid(c.member.id, amount, source: 'voice', transcript: res.raw);
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

  // ── Tap to bid ─────────────────────────────────────────────────────────
  void _tapSeat(LiveAuctionState s, SeatState seat) {
    if (!s.isLive || !seat.active || _busy) return;
    final start = (s.currentPrize - s.minBidDecrement)
        .clamp(0, s.chitValue)
        .toDouble();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      builder: (_) => _BidSheet(
        seat: seat,
        initial: start,
        step: s.minBidDecrement > 0 ? s.minBidDecrement : 1,
        max: (s.currentPrize - s.minBidDecrement).clamp(0, s.chitValue).toDouble(),
        onConfirm: (amt) {
          Navigator.of(context).pop();
          _placeBid(seat.memberId, amt, source: 'tap');
        },
      ),
    );
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  String _msg(Object e) =>
      e is ApiException ? e.message : e.toString().replaceFirst('Exception: ', '');

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final async = ref.watch(liveAuctionStateProvider(_key));
    return Scaffold(
      backgroundColor: AppColors.ink,
      appBar: AppBar(
        backgroundColor: AppColors.ink,
        foregroundColor: AppColors.onInk,
        elevation: 0,
        title: Text('${t.x('chit.live.title')} · ${t.x('chit.live.period')} ${widget.period}'),
        actions: [
          IconButton(
            tooltip: t.x('chit.live.minutes'),
            icon: Icon(_showMinutes ? Icons.close : Icons.receipt_long_rounded),
            onPressed: () => setState(() => _showMinutes = !_showMinutes),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.onInk)),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(_msg(e),
                style: AppTypography.body.copyWith(color: AppColors.onInkMuted),
                textAlign: TextAlign.center),
          ),
        ),
        data: (s) {
          _maybeCheckAutoClose(s);
          if (_showMinutes) return _MinutesPanel(state: s);
          if (s.isCompleted) return _WinnerView(state: s);
          if (!s.isLive) return _IdleView(state: s, busy: _busy, onOpen: _open);
          return _LiveView(
            state: s,
            busy: _busy,
            onTapSeat: (seat) => _tapSeat(s, seat),
            onVoice: () => _raiseByVoice(s),
            onPass: _showPassPicker,
            onUndo: _undo,
            onDeclare: () => _declare(s),
            listening: ref.watch(voiceEntryProvider).listening,
          );
        },
      ),
    );
  }

  void _maybeCheckAutoClose(LiveAuctionState s) {
    if (!s.isLive || _closing || _busy) return;
    if (s.currentBest == null) return;
    if (s.remaining(DateTime.now()) == Duration.zero) {
      // Countdown elapsed — settle automatically.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _declare(s);
      });
    }
  }

  void _showPassPicker(LiveAuctionState s) {
    final active = s.seats.where((seat) => seat.active).toList();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (_) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final seat in active)
              ListTile(
                leading: _SeatAvatar(seat: seat, radius: 18),
                title: Text(seat.name),
                onTap: () {
                  Navigator.of(context).pop();
                  _pass(seat.memberId);
                },
              ),
          ],
        ),
      ),
    );
  }
}

String _speakAmount(double amount) {
  if (amount <= 0) return 'zero rupees';
  final rounded = amount.round();
  if (rounded >= 100000) return '${(amount / 100000).toStringAsFixed(2)} lakh rupees';
  if (rounded >= 1000) return '${(amount / 1000).toStringAsFixed(1)} thousand rupees';
  return '$rounded rupees';
}

// ───────────────────────── Idle (not yet open) ─────────────────────────

class _IdleView extends ConsumerWidget {
  const _IdleView({required this.state, required this.busy, required this.onOpen});
  final LiveAuctionState state;
  final bool busy;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return Column(
      children: [
        Expanded(child: _PokerTable(state: state, onTapSeat: (_) {})),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.onPrimary,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: busy ? null : onOpen,
              icon: busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.play_circle_fill_rounded),
              label: Text(busy ? t.x('chit.live.opening') : t.x('chit.live.open'),
                  style: AppTypography.bodyLarge
                      .copyWith(color: AppColors.onPrimary, fontWeight: FontWeight.w700)),
            ),
          ),
        ),
      ],
    );
  }
}

// ───────────────────────── Live view ─────────────────────────

class _LiveView extends ConsumerWidget {
  const _LiveView({
    required this.state,
    required this.busy,
    required this.onTapSeat,
    required this.onVoice,
    required this.onPass,
    required this.onUndo,
    required this.onDeclare,
    required this.listening,
  });
  final LiveAuctionState state;
  final bool busy;
  final void Function(SeatState) onTapSeat;
  final VoidCallback onVoice;
  final void Function(LiveAuctionState) onPass;
  final VoidCallback onUndo;
  final VoidCallback onDeclare;
  final bool listening;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return Column(
      children: [
        Expanded(child: _PokerTable(state: state, onTapSeat: onTapSeat)),
        _BenchStrip(state: state),
        _BottomBar(
          busy: busy,
          listening: listening,
          onVoice: onVoice,
          onPass: () => onPass(state),
          onUndo: onUndo,
          onDeclare: onDeclare,
          canDeclare: state.currentBest != null,
          t: t,
        ),
      ],
    );
  }
}

// ───────────────────────── Poker table ─────────────────────────

class _PokerTable extends ConsumerWidget {
  const _PokerTable({required this.state, required this.onTapSeat});
  final LiveAuctionState state;
  final void Function(SeatState) onTapSeat;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Seat everyone still in the running around the ring; passed/won members are
    // shown compact in the bench strip below, so the ring stays readable > 10.
    final ring = state.seats.where((s) => s.active).toList();
    final n = ring.isEmpty ? state.seats.length : ring.length;
    final seats = ring.isEmpty ? state.seats : ring;

    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final h = box.maxHeight;
        final cx = w / 2;
        final cy = h / 2;
        final rx = w * 0.40;
        final ry = h * 0.38;
        // Shrink avatars as the ring grows.
        final avatar = (n <= 8 ? 30.0 : (n <= 14 ? 24.0 : 18.0));

        return Stack(
          children: [
            // Felt oval.
            Center(
              child: Container(
                width: w * 0.82,
                height: h * 0.78,
                decoration: BoxDecoration(
                  color: const Color(0xFF14532D), // deep felt green (const)
                  borderRadius: BorderRadius.all(Radius.elliptical(w, h)),
                  border: Border.all(color: AppColors.inkBorder, width: 6),
                  boxShadow: const [
                    BoxShadow(color: Color(0x66000000), blurRadius: 24, spreadRadius: 2),
                  ],
                ),
              ),
            ),
            // Center pot + countdown.
            Center(child: _CenterPot(state: state)),
            // Seats.
            for (var i = 0; i < seats.length; i++)
              _positioned(
                cx: cx,
                cy: cy,
                rx: rx,
                ry: ry,
                angle: -math.pi / 2 + (2 * math.pi * i / seats.length),
                child: _SeatChip(
                  seat: seats[i],
                  state: state,
                  radius: avatar,
                  onTap: () => onTapSeat(seats[i]),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _positioned({
    required double cx,
    required double cy,
    required double rx,
    required double ry,
    required double angle,
    required Widget child,
  }) {
    final x = cx + rx * math.cos(angle);
    final y = cy + ry * math.sin(angle);
    return Positioned(
      left: x - 44,
      top: y - 44,
      width: 88,
      child: child,
    );
  }
}

class _SeatChip extends StatelessWidget {
  const _SeatChip({
    required this.seat,
    required this.state,
    required this.radius,
    required this.onTap,
  });
  final SeatState seat;
  final LiveAuctionState state;
  final double radius;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isLeader = state.currentBest?.memberId == seat.memberId;
    final border = isLeader ? AppColors.primary : AppColors.inkBorder;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: border, width: isLeader ? 3 : 1.5),
              boxShadow: isLeader
                  ? [BoxShadow(color: AppColors.primary.withAlpha(120), blurRadius: 12)]
                  : null,
            ),
            child: _SeatAvatar(seat: seat, radius: radius),
          ),
          const SizedBox(height: 2),
          Text(
            seat.name.split(' ').first,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.tiny.copyWith(color: AppColors.onInk),
          ),
          if (seat.latestPrize != null)
            Text(
              '₹${_short(seat.latestPrize!)}',
              style: AppTypography.tiny.copyWith(
                color: isLeader ? AppColors.primary : AppColors.onInkMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ),
    );
  }
}

class _SeatAvatar extends ConsumerWidget {
  const _SeatAvatar({required this.seat, required this.radius});
  final SeatState seat;
  final double radius;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasPhoto = seat.profilePhoto != null && seat.profilePhoto!.isNotEmpty;
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.inkElevated,
      foregroundImage: hasPhoto ? authedImage(ref, seat.profilePhoto!) : null,
      child: hasPhoto
          ? null
          : Text(
              seat.name.isEmpty ? '?' : seat.name[0].toUpperCase(),
              style: AppTypography.body.copyWith(color: AppColors.onInk),
            ),
    );
  }
}

String _short(double v) {
  if (v >= 100000) return '${(v / 100000).toStringAsFixed(1)}L';
  if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}k';
  return v.round().toString();
}

// ───────────────────────── Center pot + countdown ─────────────────────────

class _CenterPot extends ConsumerStatefulWidget {
  const _CenterPot({required this.state});
  final LiveAuctionState state;
  @override
  ConsumerState<_CenterPot> createState() => _CenterPotState();
}

class _CenterPotState extends ConsumerState<_CenterPot> {
  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final s = widget.state;
    final remaining = s.remaining(DateTime.now());
    final total = s.countdownSeconds > 0 ? s.countdownSeconds : 60;
    final frac = (remaining.inMilliseconds / (total * 1000)).clamp(0.0, 1.0);
    final urgent = remaining.inSeconds <= 5 && s.isLive;
    final ringColor = urgent ? AppColors.danger : AppColors.primary;

    return SizedBox(
      width: 150,
      height: 150,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (s.isLive)
            SizedBox(
              width: 150,
              height: 150,
              child: CircularProgressIndicator(
                value: frac,
                strokeWidth: 6,
                backgroundColor: AppColors.inkBorder,
                valueColor: AlwaysStoppedAnimation<Color>(ringColor),
              ),
            ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(t.x('chit.live.current_prize'),
                  style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted)),
              Text(
                fmt.format(s.currentPrize),
                style: AppTypography.nameLg.copyWith(
                    color: AppColors.onInk, fontWeight: FontWeight.w800),
              ),
              Text(
                '${t.x('chit.live.discount')} ${fmt.format(s.currentDiscount)}',
                style: AppTypography.tiny.copyWith(color: AppColors.primary),
              ),
              if (s.isLive) ...[
                const SizedBox(height: 4),
                Text(
                  '${remaining.inSeconds}s',
                  style: AppTypography.nameLg.copyWith(
                    color: ringColor,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ───────────────────────── Bench strip (passed / won) ─────────────────────

class _BenchStrip extends StatelessWidget {
  const _BenchStrip({required this.state});
  final LiveAuctionState state;

  @override
  Widget build(BuildContext context) {
    final bench = state.seats.where((s) => !s.active).toList();
    if (bench.isEmpty) return const SizedBox.shrink();
    return Container(
      height: 62,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: bench.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final s = bench[i];
          return Opacity(
            opacity: 0.55,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _SeatAvatar(seat: s, radius: 16),
                const SizedBox(height: 2),
                Text(
                  s.name.split(' ').first,
                  style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ───────────────────────── Bottom bar ─────────────────────────

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.busy,
    required this.listening,
    required this.onVoice,
    required this.onPass,
    required this.onUndo,
    required this.onDeclare,
    required this.canDeclare,
    required this.t,
  });
  final bool busy;
  final bool listening;
  final VoidCallback onVoice;
  final VoidCallback onPass;
  final VoidCallback onUndo;
  final VoidCallback onDeclare;
  final bool canDeclare;
  final T t;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        child: Column(
          children: [
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: listening ? AppColors.danger : AppColors.primary,
                  foregroundColor: AppColors.onPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: busy ? null : onVoice,
                icon: Icon(listening ? Icons.mic : Icons.mic_none_rounded),
                label: Text(t.x('chit.live.voice_raise'),
                    style: AppTypography.bodyLarge.copyWith(
                        color: AppColors.onPrimary, fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.onInk,
                      side: const BorderSide(color: AppColors.inkBorder),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: busy ? null : onPass,
                    icon: const Icon(Icons.pan_tool_alt_outlined, size: 18),
                    label: Text(t.x('chit.live.pass')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.onInk,
                      side: const BorderSide(color: AppColors.inkBorder),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: busy ? null : onUndo,
                    icon: const Icon(Icons.undo_rounded, size: 18),
                    label: Text(t.x('chit.live.undo')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: canDeclare ? AppColors.success : AppColors.inkElevated,
                      foregroundColor: AppColors.onInk,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: (busy || !canDeclare) ? null : onDeclare,
                    icon: const Icon(Icons.emoji_events_rounded, size: 18),
                    label: Text(t.x('chit.live.declare'),
                        maxLines: 1, overflow: TextOverflow.ellipsis),
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

// ───────────────────────── Bid sheet (tap) ─────────────────────────

class _BidSheet extends ConsumerStatefulWidget {
  const _BidSheet({
    required this.seat,
    required this.initial,
    required this.step,
    required this.max,
    required this.onConfirm,
  });
  final SeatState seat;
  final double initial;
  final double step;
  final double max;
  final void Function(double) onConfirm;

  @override
  ConsumerState<_BidSheet> createState() => _BidSheetState();
}

class _BidSheetState extends ConsumerState<_BidSheet> {
  late double _amount = widget.initial;

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                _SeatAvatar(seat: widget.seat, radius: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(widget.seat.name, style: AppTypography.nameLg),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(t.x('chit.live.enter_bid'),
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton.filledTonal(
                  onPressed: _amount - widget.step > 0
                      ? () => setState(() => _amount -= widget.step)
                      : null,
                  icon: const Icon(Icons.remove),
                ),
                Text(fmt.format(_amount),
                    style: AppTypography.heroNumber.copyWith(color: AppColors.textPrimary)),
                IconButton.filledTonal(
                  onPressed: _amount + widget.step <= widget.max
                      ? () => setState(() => _amount += widget.step)
                      : null,
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
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: _amount > 0 ? () => widget.onConfirm(_amount) : null,
                child: Text('${t.x('chit.live.bid')} ${fmt.format(_amount)}',
                    style: AppTypography.bodyLarge.copyWith(
                        color: AppColors.onPrimary, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Minutes panel ─────────────────────────

class _MinutesPanel extends ConsumerWidget {
  const _MinutesPanel({required this.state});
  final LiveAuctionState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = ref.watch(currencyFmtProvider);
    final tf = DateFormat('HH:mm:ss');
    // Merge bids + events into one reverse-chronological trail.
    final rows = <(_MinuteKind, DateTime, String)>[];
    for (final b in state.recentBids) {
      final seat = state.seatOf(b.memberId);
      final name = seat?.name ?? '';
      if (b.kind == 'pass') {
        rows.add((_MinuteKind.pass, b.createdAt, '$name passed'));
      } else if (b.kind == 'bid') {
        rows.add((_MinuteKind.bid, b.createdAt,
            '$name → ${fmt.format(b.prizeAmount)} (${b.source})'));
      }
    }
    for (final e in state.events) {
      rows.add((_MinuteKind.event, e.createdAt, e.message ?? e.type));
    }
    rows.sort((a, b) => b.$2.compareTo(a.$2));

    return Container(
      color: AppColors.ink,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: rows.length,
        itemBuilder: (_, i) {
          final r = rows[i];
          final color = switch (r.$1) {
            _MinuteKind.bid => AppColors.primary,
            _MinuteKind.pass => AppColors.onInkMuted,
            _MinuteKind.event => AppColors.info,
          };
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tf.format(r.$2),
                    style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(r.$3,
                      style: AppTypography.body.copyWith(color: color)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

enum _MinuteKind { bid, pass, event }

// ───────────────────────── Winner view ─────────────────────────

class _WinnerView extends ConsumerWidget {
  const _WinnerView({required this.state});
  final LiveAuctionState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final w = state.winner ?? state.settlement;
    final seat = w != null ? state.seatOf(w.winnerMemberId) : null;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.emoji_events_rounded, color: AppColors.primary, size: 72),
            const SizedBox(height: 16),
            Text(t.x('chit.live.winner_is'),
                style: AppTypography.caption.copyWith(color: AppColors.onInkMuted)),
            const SizedBox(height: 6),
            if (seat != null) ...[
              _SeatAvatar(seat: seat, radius: 36),
              const SizedBox(height: 8),
              Text(seat.name,
                  style: AppTypography.nameLg.copyWith(color: AppColors.onInk)),
            ],
            const SizedBox(height: 12),
            if (w != null) ...[
              Text(fmt.format(w.prizeAmount),
                  style: AppTypography.heroNumber.copyWith(color: AppColors.primary)),
              const SizedBox(height: 6),
              Text('${t.x('chit.live.dividend')}: ${fmt.format(w.dividend)}',
                  style: AppTypography.body.copyWith(color: AppColors.onInkMuted)),
            ],
          ],
        ),
      ),
    );
  }
}
