import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/app_strings.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/api_exception.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit_live.dart';
import 'package:loantrack/data/services/borrower_chit_service.dart';
import 'package:loantrack/features/chits/bid_amount_parser.dart';
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
      return _WinnerCard(state: s);
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
        _LeadingBidCard(state: s, fmt: fmt),
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
          _MyBidHistory(state: s, fmt: fmt),
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

class _LeadingBidCard extends StatelessWidget {
  const _LeadingBidCard({required this.state, required this.fmt});
  final CustomerLiveAuctionState state;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    final best = state.currentHighestBid;
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
          Text('Current leading bid', style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          if (best == null)
            Text('No bids yet', style: AppTypography.sectionTitle)
          else
            Text('Ticket ${best.ticketNo ?? '—'} · discount ${fmt.format(best.bidDiscount)}',
                style: AppTypography.sectionTitle),
          if (state.minNextDiscount != null) ...[
            const SizedBox(height: 4),
            Text('Minimum next discount: ${fmt.format(state.minNextDiscount!)}', style: AppTypography.caption),
          ],
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
  const _MyBidHistory({required this.state, required this.fmt});
  final CustomerLiveAuctionState state;
  final NumberFormat fmt;

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
          Text('My bids', style: AppTypography.sectionTitle),
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

class _WinnerCard extends StatelessWidget {
  const _WinnerCard({required this.state});
  final CustomerLiveAuctionState state;

  @override
  Widget build(BuildContext context) {
    return _InfoCard(
      icon: Icons.emoji_events,
      color: state.winnerIsMe ? AppColors.success : AppColors.textSecondary,
      title: state.winnerIsMe ? 'You won this round!' : 'Auction closed',
      message: state.winnerIsMe
          ? 'Congratulations — the organizer will confirm settlement shortly.'
          : 'Ticket ${state.winnerTicketNo ?? '—'} won this round.',
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
