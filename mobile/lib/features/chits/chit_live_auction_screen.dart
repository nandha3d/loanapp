import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit.dart';
import 'package:loantrack/data/services/chit_service.dart';

/// Live beat auction room. Polls the live endpoint every 2.5s while visible;
/// the countdown always comes from the server's secondsRemaining, never the
/// device clock. Closing/winner selection stays with the confirm flow.
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
  Timer? _timer;
  Map<String, dynamic>? _live;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _poll();
    _timer = Timer.periodic(const Duration(milliseconds: 2500), (_) => _poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _poll() async {
    try {
      final state = await ref
          .read(chitServiceProvider)
          .liveState(widget.groupId, widget.auctionId);
      if (mounted) setState(() => _live = state);
    } catch (_) {
      // transient poll failure — next tick retries
    }
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
      if (mounted) setState(() => _error = e.toString());
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
              TextFormField(
                initialValue: '$duration',
                decoration:
                    const InputDecoration(labelText: 'Duration (minutes)'),
                keyboardType: TextInputType.number,
                onChanged: (v) => duration = int.tryParse(v) ?? 30,
              ),
              TextFormField(
                initialValue: '$antiSnipe',
                decoration: const InputDecoration(
                    labelText: 'Anti-snipe extend (seconds)'),
                keyboardType: TextInputType.number,
                onChanged: (v) => antiSnipe = int.tryParse(v) ?? 0,
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
    await _run(() async {
      await ref.read(chitServiceProvider).roomAction(
            widget.groupId,
            widget.auctionId,
            action: 'open',
            durationMinutes: duration,
            autoExtendSeconds: antiSnipe,
          );
    });
  }

  Future<void> _closeRoom() async {
    await _run(() async {
      await ref
          .read(chitServiceProvider)
          .roomAction(widget.groupId, widget.auctionId, action: 'close');
    });
  }

  Future<void> _addBid() async {
    final eligible = widget.members
        .where((m) => !m.hasWon && m.subscriberStatus == 'active')
        .toList();
    String? memberId;
    double prize = 0;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Place bid'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'Ticket'),
                items: eligible
                    .map((m) => DropdownMenuItem(
                          value: m.id,
                          child: Text(
                              '${m.ticketNo ?? m.memberNumber}. ${m.customerName}'),
                        ))
                    .toList(),
                onChanged: (v) => setLocal(() => memberId = v),
              ),
              TextFormField(
                decoration:
                    const InputDecoration(labelText: 'Prize amount accepted'),
                keyboardType: TextInputType.number,
                onChanged: (v) => prize = double.tryParse(v) ?? 0,
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Bid')),
          ],
        ),
      ),
    );
    if (ok != true || memberId == null || prize <= 0) return;
    await _run(() async {
      await ref.read(chitServiceProvider).addBid(
            widget.groupId,
            widget.auctionId,
            memberId: memberId!,
            bidAmount: prize,
          );
    });
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    final live = _live;
    final roomStatus = (live?['roomStatus'] as String?) ?? 'scheduled';
    final isOpen = roomStatus == 'open' || roomStatus == 'extended';
    final seconds = (live?['secondsRemaining'] as num?)?.toInt() ?? 0;
    final bids = (live?['bids'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final highest = live?['highestBid'] as Map<String, dynamic>?;
    final winner = live?['winner'] as Map<String, dynamic>?;
    final sealedCount = (live?['bidCount'] as num?)?.toInt() ?? 0;
    final sealedHidden = bids.isEmpty && sealedCount > 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('Live Auction — Period ${widget.periodNumber}'),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Container(
              padding: const EdgeInsets.all(10),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: AppColors.dangerBg,
                borderRadius: BorderRadius.circular(AppTokens.radius),
              ),
              child: Text(_error!,
                  style:
                      AppTypography.caption.copyWith(color: AppColors.danger)),
            ),
          // Countdown / room state
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppTokens.radius),
              boxShadow: AppTokens.shadow,
            ),
            child: Column(
              children: [
                Text(
                  isOpen
                      ? '${(seconds ~/ 60)}:${(seconds % 60).toString().padLeft(2, '0')}'
                      : roomStatus.toUpperCase(),
                  style: AppTypography.sectionTitle.copyWith(
                    fontSize: 34,
                    color: isOpen
                        ? (roomStatus == 'extended'
                            ? AppColors.warning
                            : AppColors.success)
                        : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isOpen
                      ? (roomStatus == 'extended'
                          ? 'Extended — anti-snipe active'
                          : 'Bidding open')
                      : roomStatus == 'closed'
                          ? 'Room closed — pending confirmation'
                          : 'Room not opened yet',
                  style: AppTypography.caption,
                ),
                if (highest != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Highest: ticket ${highest['ticketNo']} — discount ${fmt.format((highest['bidDiscount'] as num?)?.toDouble() ?? 0)}',
                    style: AppTypography.body
                        .copyWith(fontWeight: FontWeight.w700),
                  ),
                ],
                if (sealedHidden)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text('$sealedCount sealed bid(s) received',
                        style: AppTypography.body),
                  ),
                if (winner != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      'Provisional winner: ${winner['name']} (ticket ${winner['ticketNo']})',
                      style:
                          AppTypography.body.copyWith(color: AppColors.success),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Actions
          Row(
            children: [
              if (widget.isAdmin && !isOpen && roomStatus != 'closed')
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _busy ? null : _openRoom,
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Open room'),
                  ),
                ),
              if (isOpen) ...[
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _busy ? null : _addBid,
                    icon: const Icon(Icons.gavel),
                    label: const Text('Place bid'),
                  ),
                ),
                if (widget.isAdmin) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _closeRoom,
                      style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.danger),
                      icon: const Icon(Icons.stop),
                      label: const Text('Close'),
                    ),
                  ),
                ],
              ],
            ],
          ),
          const SizedBox(height: 16),
          // Bid ledger
          if (bids.isNotEmpty)
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppTokens.radius),
                boxShadow: AppTokens.shadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                    child: Text('Bids (${bids.length})',
                        style: AppTypography.sectionTitle),
                  ),
                  ...bids.map((b) => ListTile(
                        dense: true,
                        title: Text(
                            'Ticket ${b['ticketNo'] ?? '—'} · ${b['memberName'] ?? ''}',
                            style: AppTypography.body),
                        subtitle: Text(
                          DateFormat('HH:mm:ss').format(
                              DateTime.tryParse(b['bidTime'] as String? ?? '')
                                      ?.toLocal() ??
                                  DateTime.now()),
                          style: AppTypography.caption,
                        ),
                        trailing: Text(
                          fmt.format(
                              (b['bidDiscount'] as num?)?.toDouble() ?? 0),
                          style: AppTypography.body
                              .copyWith(fontWeight: FontWeight.w700),
                        ),
                      )),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
