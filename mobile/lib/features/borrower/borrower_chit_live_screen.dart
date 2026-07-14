import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/app_strings.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/api_exception.dart';
import 'package:loantrack/core/network/authed_image.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit_live.dart';
import 'package:loantrack/data/services/borrower_chit_service.dart';
import 'package:loantrack/features/chits/bid_amount_parser.dart';
import 'package:loantrack/features/chits/dividend_breakdown.dart';
import 'package:loantrack/features/collection/voice_entry_controller.dart';

String _cleanError(Object e) {
  if (e is ApiException) return e.message;
  if (e is DioException) return ApiException.fromDio(e).message;
  return e.toString().replaceFirst('Exception: ', '');
}

/// Customer self-service live auction room — the "Join" counterpart of the
/// staff poker-table screen. One seat only (the customer's own ticket), no
/// admin controls. Polls the same cadence (2.5s) as the staff room per the
/// codebase's deliberate polling-only convention (lib/chits/liveAuction.ts).
class BorrowerChitLiveScreen extends ConsumerStatefulWidget {
  const BorrowerChitLiveScreen({
    super.key,
    required this.groupId,
    required this.auctionId,
    required this.groupName,
    this.fallbackChitValue,
  });

  final String groupId;
  final String auctionId;
  final String groupName;
  final double? fallbackChitValue;

  @override
  ConsumerState<BorrowerChitLiveScreen> createState() => _BorrowerChitLiveScreenState();
}

class _BorrowerChitLiveScreenState extends ConsumerState<BorrowerChitLiveScreen> {
  Timer? _pollTimer;
  Timer? _tickTimer;
  CustomerLiveAuctionState? _state;
  int _secondsAtPoll = 0;
  DateTime _polledAt = DateTime.now();
  bool _busy = false;
  String? _error;
  int _pollFailCount = 0;
  int _lastBellsRung = 0;
  String? _bellToast;
  Timer? _bellToastTimer;
  bool _summaryShown = false;

  final _discountCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _poll();
    _pollTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) => _poll());
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _bellToastTimer?.cancel();
    _discountCtrl.dispose();
    _messageCtrl.dispose();
    super.dispose();
  }

  BorrowerChitService get _svc => ref.read(borrowerChitServiceProvider);

  Future<void> _poll() async {
    try {
      final s = await _svc.liveState(widget.groupId, widget.auctionId);
      if (!mounted) return;
      setState(() {
        _state = s;
        _secondsAtPoll = s.secondsRemaining;
        _polledAt = DateTime.now();
        _pollFailCount = 0;
        _error = null;
      });
      _announceBellIfRung(s);
      // Fetch the full result exactly once per auction, on the transition to
      // confirmed — not on every poll. (roomStatus can close before staff
      // confirms the winner, so gate on auctionStatus, not roomStatus.)
      if (['confirmed', 'paid', 'completed'].contains(s.auctionStatus) && !_summaryShown) {
        _summaryShown = true;
        _showSummarySheet();
      }
    } catch (_) {
      // Transient — next tick retries. Only surface an error after repeated
      // failures so one dropped request doesn't flash a banner.
      if (!mounted) return;
      _pollFailCount++;
      if (_pollFailCount >= 3) {
        setState(() => _error = 'Connection trouble — retrying…');
      }
    }
  }

  int get _displaySeconds {
    final s = _state;
    if (s == null) return 0;
    final elapsed = DateTime.now().difference(_polledAt).inSeconds;
    final left = _secondsAtPoll - elapsed;
    return left < 0 ? 0 : left;
  }

  void _showTimelineSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TimelineSheet(groupId: widget.groupId, auctionId: widget.auctionId),
    );
  }

  void _showSummarySheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SummarySheet(groupId: widget.groupId, auctionId: widget.auctionId),
    );
  }

  /// Chime (haptic + TTS) + banner when bellsRung increases since the last
  /// poll — compare against the previous value so an unchanged count never
  /// re-announces.
  void _announceBellIfRung(CustomerLiveAuctionState s) {
    final bell = s.bell;
    if (bell.bellsRung > _lastBellsRung && bell.bellCount > 0) {
      final phrase = bell.phrase(winnerTicketNo: s.currentHighestBid?.ticketNo);
      HapticFeedback.heavyImpact();
      ref.speak(phrase);
      _bellToastTimer?.cancel();
      setState(() => _bellToast = phrase);
      _bellToastTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _bellToast = null);
      });
    }
    _lastBellsRung = bell.bellsRung;
  }

  Future<void> _run(Future<void> Function() fn) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await fn();
      await _poll();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_cleanError(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() => _run(() async {
        await _svc.join(widget.groupId, widget.auctionId);
      });

  Future<void> _confirmAndBid(double prizeAmount, {String source = 'tap', String? transcript}) async {
    final fmt = ref.read(currencyFmtProvider);
    final discount = (_state?.chitValue ?? 0) - prizeAmount;
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Confirm Your Bid', style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            Text('Ticket: ${_state?.membership.ticketNo ?? '—'}', style: AppTypography.body),
            Text('Prize amount: ${fmt.format(prizeAmount)}', style: AppTypography.body),
            Text('Discount offered: ${fmt.format(discount)}', style: AppTypography.body),
            const SizedBox(height: 10),
            Text(
              'This bid cannot be cancelled after it is accepted.',
              style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Confirm Bid'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    await _run(() async {
      await _svc.placeBid(
        widget.groupId,
        widget.auctionId,
        prizeAmount: prizeAmount,
        source: source,
        transcript: transcript,
      );
    });
  }

  void _submitTypedDiscount() {
    final s = _state;
    if (s == null) return;
    final discount = double.tryParse(_discountCtrl.text.replaceAll(',', ''));
    if (discount == null || discount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid discount amount')),
      );
      return;
    }
    _confirmAndBid(s.chitValue - discount);
  }

  void _quickBid(double discount) {
    final s = _state;
    if (s == null) return;
    _confirmAndBid(s.chitValue - discount);
  }

  Future<void> _holdToSpeak() async {
    final ok = await Permission.microphone.request();
    if (!ok.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Microphone permission is needed for voice bidding')),
        );
      }
      return;
    }
    final lang = ref.read(languageProvider).code;
    await ref.read(voiceEntryProvider.notifier).listen(lang, onFinal: (text) {
      final parsed = parseBidAmount(text);
      if (!parsed.hasAmount) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not understand "$text" — try again or enter manually')),
        );
        return;
      }
      ref.speak('Discount ${parsed.amount!.toStringAsFixed(0)}');
      // Voice never auto-submits — prefill the field and require the same
      // manual confirm as a typed bid.
      _discountCtrl.text = parsed.amount!.toStringAsFixed(0);
      final s = _state;
      if (s != null) {
        _confirmAndBid(s.chitValue - parsed.amount!, source: 'voice', transcript: text);
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageCtrl.text.trim();
    if (text.isEmpty) return;
    _messageCtrl.clear();
    await _run(() async {
      await _svc.sendMessage(widget.groupId, widget.auctionId, text);
    });
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    final s = _state;
    final voice = ref.watch(voiceEntryProvider);

    return Scaffold(
      appBar: AppBar(title: Text(widget.groupName)),
      body: s == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _poll,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) _ReconnectBanner(message: _error!),
                  if (_bellToast != null)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.warning,
                        borderRadius: BorderRadius.circular(AppTokens.radius),
                      ),
                      child: Text('🔔 $_bellToast',
                          textAlign: TextAlign.center,
                          style: AppTypography.body.copyWith(
                              color: Colors.white, fontWeight: FontWeight.w800)),
                    ),
                  _RoomStatusCard(state: s, displaySeconds: _displaySeconds, fmt: fmt),
                  const SizedBox(height: 12),
                  _buildBody(s, fmt, voice),
                ],
              ),
            ),
    );
  }

  Widget _buildBody(CustomerLiveAuctionState s, NumberFormat fmt, VoiceEntryState voice) {
    final m = s.membership;

    if (m.hasWon) {
      return _InfoCard(
        icon: Icons.emoji_events,
        color: AppColors.success,
        title: 'You already won this chit',
        message: 'Ticket ${m.ticketNo ?? '—'} is not eligible to bid again.',
      );
    }
    if (m.subscriberStatus != 'active') {
      return _InfoCard(
        icon: Icons.block,
        color: AppColors.danger,
        title: 'Bidding unavailable',
        message: 'Your ticket status is "${m.subscriberStatus}".',
      );
    }
    if (m.notJoined) {
      return _JoinCard(state: s, busy: _busy, onJoin: _join);
    }
    if (m.isWaiting) {
      return const _InfoCard(
        icon: Icons.hourglass_top,
        color: AppColors.info,
        title: 'Waiting for organizer approval',
        message: 'You will be able to bid as soon as the organizer admits you.',
      );
    }
    if (m.isDenied) {
      return const _InfoCard(
        icon: Icons.cancel_outlined,
        color: AppColors.danger,
        title: 'Entry denied',
        message: 'The organizer did not admit you to this room. Contact them directly.',
      );
    }

    // Admitted (or roomAdmission == 'auto', admitted immediately on join).
    if (s.roomStatus == 'closed') {
      return _WinnerCard(state: s, onViewSummary: _showSummarySheet);
    }
    if (!s.roomLive) {
      return const _InfoCard(
        icon: Icons.schedule,
        color: AppColors.textSecondary,
        title: 'Room not open yet',
        message: 'You are admitted — bidding starts once the organizer opens the room.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CustomerPokerTable(
          state: s,
          displaySeconds: _displaySeconds,
          onTapMySeat: () => _quickBid(s.minNextDiscount ?? 0),
        ),
        const SizedBox(height: 12),
        _BidEntryCard(
          state: s,
          fmt: fmt,
          busy: _busy,
          discountCtrl: _discountCtrl,
          voiceListening: voice.listening,
          voiceTranscript: voice.transcript,
          onSubmit: _submitTypedDiscount,
          onQuickBid: _quickBid,
          onHoldToSpeak: _holdToSpeak,
        ),
        if (s.myBids.isNotEmpty) ...[
          const SizedBox(height: 12),
          _MyBidHistory(state: s, fmt: fmt, onViewAll: _showTimelineSheet),
        ],
        const SizedBox(height: 12),
        _MessagesCard(state: s, controller: _messageCtrl, onSend: _sendMessage),
      ],
    );
  }
}

class _ReconnectBanner extends StatelessWidget {
  const _ReconnectBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        borderRadius: BorderRadius.circular(AppTokens.radius),
      ),
      child: Row(
        children: [
          const Icon(Icons.wifi_off, size: 16, color: AppColors.warningText),
          const SizedBox(width: 8),
          Expanded(child: Text(message, style: AppTypography.caption.copyWith(color: AppColors.warningText))),
        ],
      ),
    );
  }
}

class _RoomStatusCard extends StatelessWidget {
  const _RoomStatusCard({required this.state, required this.displaySeconds, required this.fmt});
  final CustomerLiveAuctionState state;
  final int displaySeconds;
  final NumberFormat fmt;

  String get _badgeLabel {
    switch (state.roomStatus) {
      case 'open':
        return 'LIVE';
      case 'extended':
        return 'EXTENDED';
      case 'closed':
        return 'CLOSED';
      default:
        return 'SCHEDULED';
    }
  }

  Color get _badgeColor {
    switch (state.roomStatus) {
      case 'open':
        return AppColors.success;
      case 'extended':
        return AppColors.warningText;
      case 'closed':
        return AppColors.textSecondary;
      default:
        return AppColors.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    final mins = (displaySeconds ~/ 60).toString().padLeft(2, '0');
    final secs = (displaySeconds % 60).toString().padLeft(2, '0');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _badgeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
                ),
                child: Text(_badgeLabel,
                    style: AppTypography.caption.copyWith(color: _badgeColor, fontWeight: FontWeight.w800)),
              ),
              Text('Your ticket: ${state.membership.ticketNo ?? '—'}', style: AppTypography.caption),
            ],
          ),
          if (state.roomLive) ...[
            const SizedBox(height: 10),
            Center(
              child: Text('$mins:$secs',
                  style: AppTypography.sectionTitle.copyWith(fontSize: 32, fontWeight: FontWeight.w800)),
            ),
          ],
          const SizedBox(height: 8),
          Text('Chit value: ${fmt.format(state.chitValue)}', style: AppTypography.caption),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.icon, required this.color, required this.title, required this.message});
  final IconData icon;
  final Color color;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        children: [
          Icon(icon, size: 40, color: color),
          const SizedBox(height: 10),
          Text(title, style: AppTypography.sectionTitle, textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(message, style: AppTypography.caption.copyWith(color: AppColors.textSecondary), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _JoinCard extends StatelessWidget {
  const _JoinCard({required this.state, required this.busy, required this.onJoin});
  final CustomerLiveAuctionState state;
  final bool busy;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final approvalGated = state.roomAdmission == 'approval';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        children: [
          const Icon(Icons.podcasts, size: 40, color: AppColors.success),
          const SizedBox(height: 10),
          Text(
            approvalGated ? 'Join the waiting room' : 'Join the auction',
            style: AppTypography.sectionTitle,
          ),
          const SizedBox(height: 6),
          Text(
            approvalGated
                ? 'The organizer must admit you before you can bid.'
                : 'You will be able to bid as soon as you join.',
            style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: busy ? null : onJoin,
              child: Text(approvalGated ? 'Join Waiting Room' : 'Join Auction'),
            ),
          ),
        ],
      ),
    );
  }
}

// ───────────────────── Poker table (customer view) ─────────────────────
// Same wooden-table visual the staff live room uses — every member seated
// around the oval, the current leader glowing — so a customer bidding from
// their phone feels like they're sitting at the same live auction, not
// filling out a form. Read-only for other seats; tapping your own seat
// places an instant minimum bid (same "tap to bid" gesture staff get).

const _kCustomerFeltFrame = Color(0xFF111827);

class _CustomerPokerTable extends StatelessWidget {
  const _CustomerPokerTable({
    required this.state,
    required this.displaySeconds,
    required this.onTapMySeat,
  });
  final CustomerLiveAuctionState state;
  final int displaySeconds;
  final VoidCallback onTapMySeat;

  @override
  Widget build(BuildContext context) {
    final seats = state.seats;
    return Container(
      decoration: BoxDecoration(
        color: _kCustomerFeltFrame,
        borderRadius: BorderRadius.circular(AppTokens.radius),
      ),
      padding: const EdgeInsets.all(10),
      child: AspectRatio(
        aspectRatio: seats.isEmpty ? 16 / 9 : 1536 / 2200,
        child: LayoutBuilder(
          builder: (context, box) {
            final w = box.maxWidth;
            final h = box.maxHeight;
            final cx = w / 2;
            final cy = h / 2;
            final rx = w * 0.34;
            final ry = h * 0.40;
            final seatRadius = seats.length <= 8 ? 22.0 : (seats.length <= 14 ? 18.0 : 14.0);
            return Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: RotatedBox(
                      quarterTurns: 1,
                      child: ColorFiltered(
                        colorFilter: const ColorFilter.mode(Color(0x14000000), BlendMode.darken),
                        child: Image.asset('assets/images/poker_table.png', fit: BoxFit.cover),
                      ),
                    ),
                  ),
                ),
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
                Center(child: _CustomerCenterHub(state: state, displaySeconds: displaySeconds)),
                for (var i = 0; i < seats.length; i++)
                  _seat(cx, cy, rx, ry, -math.pi / 2 + (2 * math.pi * i / seats.length), seats[i], seatRadius),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _seat(double cx, double cy, double rx, double ry, double angle, CustomerSeat seat, double radius) {
    final x = cx + rx * math.cos(angle);
    final y = cy + ry * math.sin(angle);
    return Positioned(
      left: x - 46,
      top: y - radius - 18,
      width: 92,
      child: _CustomerSeatChip(seat: seat, radius: radius, onTap: seat.isMe ? onTapMySeat : null),
    );
  }
}

class _CustomerCenterHub extends StatelessWidget {
  const _CustomerCenterHub({required this.state, required this.displaySeconds});
  final CustomerLiveAuctionState state;
  final int displaySeconds;

  @override
  Widget build(BuildContext context) {
    final mins = (displaySeconds ~/ 60).toString().padLeft(2, '0');
    final secs = (displaySeconds % 60).toString().padLeft(2, '0');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.inkElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inkBorder),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            state.roomStatus == 'extended' ? 'ANTI-SNIPE' : 'BIDDING OPEN',
            style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted, fontWeight: FontWeight.w800, letterSpacing: 1),
          ),
          const SizedBox(height: 4),
          Text(
            '$mins:$secs',
            style: AppTypography.sectionTitle.copyWith(
              color: AppColors.onInk,
              fontSize: 30,
              fontWeight: FontWeight.w800,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 2),
          Text('Your ticket ${state.membership.ticketNo ?? '—'}',
              style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted)),
        ],
      ),
    );
  }
}

class _CustomerSeatChip extends ConsumerWidget {
  const _CustomerSeatChip({required this.seat, required this.radius, required this.onTap});
  final CustomerSeat seat;
  final double radius;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final border = seat.isMe
        ? AppColors.success
        : seat.isLeader
            ? AppColors.primary
            : AppColors.inkBorder;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: border, width: seat.isMe || seat.isLeader ? 3 : 1.5),
              boxShadow: seat.isMe || seat.isLeader
                  ? [BoxShadow(color: border.withValues(alpha: 0.45), blurRadius: 12)]
                  : null,
            ),
            child: CircleAvatar(
              radius: radius,
              backgroundColor: seat.hasWon ? AppColors.inkElevated : const Color(0xFF2A2D35),
              foregroundImage: (seat.profilePhoto == null || seat.profilePhoto!.isEmpty)
                  ? null
                  : authedImage(ref, seat.profilePhoto!),
              child: Text(
                seat.name.isEmpty ? '?' : seat.name[0].toUpperCase(),
                style: AppTypography.body.copyWith(color: seat.hasWon ? AppColors.onInkMuted : AppColors.onInk),
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            seat.isMe ? 'You' : (seat.ticketNo ?? '—'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.tiny.copyWith(
              color: seat.isMe ? AppColors.success : AppColors.onInk,
              fontWeight: seat.isMe ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
          if (seat.latestDiscount != null)
            Text(
              '₹${seat.latestDiscount!.toStringAsFixed(0)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.tiny.copyWith(color: AppColors.onInkMuted),
            ),
        ],
      ),
    );
  }
}

class _BidEntryCard extends StatelessWidget {
  const _BidEntryCard({
    required this.state,
    required this.fmt,
    required this.busy,
    required this.discountCtrl,
    required this.voiceListening,
    required this.voiceTranscript,
    required this.onSubmit,
    required this.onQuickBid,
    required this.onHoldToSpeak,
  });

  final CustomerLiveAuctionState state;
  final NumberFormat fmt;
  final bool busy;
  final TextEditingController discountCtrl;
  final bool voiceListening;
  final String voiceTranscript;
  final VoidCallback onSubmit;
  final void Function(double discount) onQuickBid;
  final VoidCallback onHoldToSpeak;

  @override
  Widget build(BuildContext context) {
    final floor = state.minNextDiscount ?? 0;
    final steps = [500.0, 1000.0, 2000.0, 5000.0];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Place your bid', style: AppTypography.sectionTitle),
          const SizedBox(height: 10),
          TextField(
            controller: discountCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Discount amount (₹)',
              hintText: floor > 0 ? 'Minimum ${fmt.format(floor)}' : null,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ActionChip(label: const Text('Min'), onPressed: busy || floor <= 0 ? null : () => onQuickBid(floor)),
              for (final step in steps)
                ActionChip(
                  label: Text('+${step.toInt()}'),
                  onPressed: busy ? null : () => onQuickBid(floor + step),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: busy ? null : onSubmit,
                  child: const Text('Place Bid'),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onLongPressStart: (_) => onHoldToSpeak(),
                child: CircleAvatar(
                  radius: 24,
                  backgroundColor: voiceListening ? AppColors.danger : AppColors.primary,
                  child: const Icon(Icons.mic, color: Colors.white),
                ),
              ),
            ],
          ),
          if (voiceListening) ...[
            const SizedBox(height: 8),
            Text(voiceTranscript.isEmpty ? 'Listening…' : voiceTranscript,
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
          ],
          const SizedBox(height: 4),
          Text('Hold the mic and speak your discount, e.g. "fifty thousand"',
              style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _MyBidHistory extends StatelessWidget {
  const _MyBidHistory({required this.state, required this.fmt, this.onViewAll});
  final CustomerLiveAuctionState state;
  final NumberFormat fmt;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('My bids', style: AppTypography.sectionTitle),
              if (onViewAll != null)
                TextButton(
                  onPressed: onViewAll,
                  child: Text('Full activity', style: AppTypography.caption),
                ),
            ],
          ),
          const SizedBox(height: 8),
          for (final b in state.myBids)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${fmt.format(b.bidDiscount)} discount', style: AppTypography.body),
                  Text(b.source == 'voice' ? '🎙' : '👆', style: AppTypography.caption),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Full chronological "Auction activity" bottom sheet — bids/bells/opens/
/// extends/passes/winner, in one feed (doc 17). Opt-in deeper view; the
/// always-visible [_MyBidHistory] stays the lightweight "my bids only" view.
class _TimelineSheet extends ConsumerStatefulWidget {
  const _TimelineSheet({required this.groupId, required this.auctionId});
  final String groupId;
  final String auctionId;

  @override
  ConsumerState<_TimelineSheet> createState() => _TimelineSheetState();
}

class _TimelineSheetState extends ConsumerState<_TimelineSheet> {
  List<dynamic> _entries = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ref
          .read(borrowerChitServiceProvider)
          .timeline(widget.groupId, widget.auctionId);
      if (!mounted) return;
      setState(() {
        _entries = (data['entries'] as List<dynamic>?) ?? const [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load activity';
        _loading = false;
      });
    }
  }

  String _icon(Map<String, dynamic> e) {
    if (e['kind'] == 'message') return '💬';
    if (e['kind'] == 'bid') return e['bidStatus'] == 'retracted' ? '↩' : '💰';
    switch (e['type']) {
      case 'bell':
        return '🔔';
      case 'open':
      case 'close':
        return '🚪';
      case 'extend':
        return '⏱';
      case 'pass':
        return '↩';
      case 'winner':
        return '🏆';
      default:
        return '•';
    }
  }

  String _text(Map<String, dynamic> e) {
    if (e['kind'] == 'message') {
      return '${e['senderName'] ?? 'Member'}: ${e['body'] ?? ''}';
    }
    if (e['kind'] == 'bid') {
      final name = e['memberName'] ?? 'Member';
      if (e['bidAmount'] == null) return '$name bid a sealed amount';
      final prefix = e['bidStatus'] == 'retracted' ? 'Bid retracted' : 'Bid';
      return '$name — $prefix discount ${e['bidDiscount'] ?? 0}';
    }
    return (e['message'] as String?) ?? (e['type'] as String? ?? '');
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Auction activity', style: AppTypography.sectionTitle),
              ),
              if (_loading) const Expanded(child: Center(child: CircularProgressIndicator())),
              if (_error != null)
                Expanded(child: Center(child: Text(_error!, style: AppTypography.caption))),
              if (!_loading && _error == null)
                Expanded(
                  child: _entries.isEmpty
                      ? const Center(child: Text('No activity yet.'))
                      : ListView.separated(
                          controller: scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _entries.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final e = _entries[i] as Map<String, dynamic>;
                            final time = DateTime.tryParse(e['createdAt'] as String? ?? '');
                            return ListTile(
                              dense: true,
                              leading: Text(_icon(e), style: const TextStyle(fontSize: 18)),
                              title: Text(_text(e), style: AppTypography.body),
                              trailing: time == null
                                  ? null
                                  : Text(
                                      '${time.toLocal().hour.toString().padLeft(2, '0')}:${time.toLocal().minute.toString().padLeft(2, '0')}',
                                      style: AppTypography.caption,
                                    ),
                            );
                          },
                        ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Full post-win result sheet — "did I win," dividend, next due, full
/// breakdown (doc 15). Fetched once when the auction reaches confirmed.
class _SummarySheet extends ConsumerStatefulWidget {
  const _SummarySheet({required this.groupId, required this.auctionId});
  final String groupId;
  final String auctionId;

  @override
  ConsumerState<_SummarySheet> createState() => _SummarySheetState();
}

class _SummarySheetState extends ConsumerState<_SummarySheet> {
  Map<String, dynamic>? _summary;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ref
          .read(borrowerChitServiceProvider)
          .summary(widget.groupId, widget.auctionId);
      if (!mounted) return;
      setState(() {
        _summary = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Result not available yet — check back after the organizer confirms.';
        _loading = false;
      });
    }
  }

  void _copy(NumberFormat fmt) {
    final s = _summary;
    if (s == null) return;
    final me = s['me'] as Map<String, dynamic>?;
    final lines = [
      '${s['groupName']} — Period ${s['periodNumber']} Auction Result',
      'Winner: ${s['winnerName'] ?? '—'} (Ticket ${s['winnerTicketNo'] ?? '—'})',
      'Prize: ${fmt.format(s['prizeAmount'])}',
      'Dividend per ticket: ${fmt.format(s['dividend'])}',
      if (me != null && me['iWon'] == true) 'You won!',
      if (me != null && me['iWon'] != true) 'Your dividend: ${fmt.format(me['myDividend'])}',
    ];
    Clipboard.setData(ClipboardData(text: lines.join('\n')));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Copied to clipboard')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(_error!,
                            textAlign: TextAlign.center, style: AppTypography.body),
                      ),
                    )
                  : ListView(
                      controller: scrollController,
                      padding: const EdgeInsets.all(20),
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Auction result', style: AppTypography.sectionTitle),
                            IconButton(
                              icon: const Icon(Icons.copy_rounded, size: 20),
                              onPressed: () => _copy(fmt),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Builder(builder: (context) {
                          final me = _summary!['me'] as Map<String, dynamic>?;
                          final iWon = me?['iWon'] == true;
                          return Container(
                            padding: const EdgeInsets.all(14),
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: iWon ? AppColors.successBg : AppColors.inkElevated,
                              borderRadius: BorderRadius.circular(AppTokens.radius),
                            ),
                            child: Text(
                              iWon
                                  ? '🎉 You won! Prize ${fmt.format(_summary!['prizeAmount'])}'
                                  : me != null
                                      ? 'Ticket ${_summary!['winnerTicketNo'] ?? '—'} won — your dividend: ${fmt.format(me['myDividend'])}'
                                      : 'Ticket ${_summary!['winnerTicketNo'] ?? '—'} won this round',
                              style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
                            ),
                          );
                        }),
                        DividendBreakdown(
                          chitValue: (_summary!['chitValue'] as num).toDouble(),
                          prizeAmount: (_summary!['prizeAmount'] as num).toDouble(),
                          bidDiscount: (_summary!['bidDiscount'] as num).toDouble(),
                          commissionPct: (_summary!['commissionPct'] as num).toDouble(),
                          commissionBasis: _summary!['commissionBasis'] as String,
                          commission: (_summary!['commission'] as num).toDouble(),
                          gstPct: (_summary!['gstPct'] as num?)?.toDouble(),
                          gstAmount: (_summary!['gstAmount'] as num).toDouble(),
                          distributableDividend:
                              (_summary!['distributableDividend'] as num).toDouble(),
                          dividendEligibleMembers:
                              _summary!['dividendEligibleMembers'] as int,
                          dividend: (_summary!['dividend'] as num).toDouble(),
                          roundingIncome: (_summary!['roundingIncome'] as num).toDouble(),
                          dividendPolicy: _summary!['dividendPolicy'] as String,
                          dividendDistribution: _summary!['dividendDistribution'] as String,
                          fmt: fmt,
                        ),
                      ],
                    ),
        );
      },
    );
  }
}

class _WinnerCard extends StatelessWidget {
  const _WinnerCard({required this.state, this.onViewSummary});
  final CustomerLiveAuctionState state;
  final VoidCallback? onViewSummary;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _InfoCard(
          icon: Icons.emoji_events,
          color: state.winnerIsMe ? AppColors.success : AppColors.textSecondary,
          title: state.winnerIsMe ? 'You won this round!' : 'Auction closed',
          message: state.winnerIsMe
              ? 'Congratulations — the organizer will confirm settlement shortly.'
              : 'Ticket ${state.winnerTicketNo ?? '—'} won this round.',
        ),
        if (onViewSummary != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: TextButton.icon(
              onPressed: onViewSummary,
              icon: const Icon(Icons.receipt_long_rounded, size: 18),
              label: const Text('View full result'),
            ),
          ),
      ],
    );
  }
}

class _MessagesCard extends StatelessWidget {
  const _MessagesCard({required this.state, required this.controller, required this.onSend});
  final CustomerLiveAuctionState state;
  final TextEditingController controller;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Message organizer', style: AppTypography.sectionTitle),
          const SizedBox(height: 8),
          for (final m in state.latestMessages)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: RichText(
                text: TextSpan(
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  children: [
                    TextSpan(text: '${m.senderName}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
                    TextSpan(text: m.body),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  decoration: const InputDecoration(hintText: 'Type a message…', border: OutlineInputBorder()),
                ),
              ),
              IconButton(onPressed: onSend, icon: const Icon(Icons.send)),
            ],
          ),
        ],
      ),
    );
  }
}
