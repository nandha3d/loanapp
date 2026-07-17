import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/network/authed_image.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/chit_contribution.dart';
import 'package:loantrack/data/services/chit_service.dart';

/// Staff review queue for customer "I've paid" claims — mobile counterpart of
/// the web chits/payments page (audit 03: borrowers could submit proofs from
/// mobile but staff had no mobile surface to review them).
class ChitPaymentIntentsScreen extends ConsumerStatefulWidget {
  const ChitPaymentIntentsScreen({super.key, this.groupId});

  /// When set, the queue is scoped to one chit group (opened from its detail
  /// screen); otherwise it is the tenant-wide inbox.
  final String? groupId;

  @override
  ConsumerState<ChitPaymentIntentsScreen> createState() =>
      _ChitPaymentIntentsScreenState();
}

class _ChitPaymentIntentsScreenState
    extends ConsumerState<ChitPaymentIntentsScreen> {
  bool _pendingOnly = true;
  bool _loading = true;
  String? _error;
  List<ChitStaffPaymentIntent> _intents = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final intents = await ref.read(chitServiceProvider).paymentIntents(
            status: _pendingOnly ? 'pending' : 'all',
            groupId: widget.groupId,
          );
      if (!mounted) return;
      setState(() {
        _intents = intents;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  // In-app viewer: an external browser would lose the Bearer token and 401
  // against the authed /api/files route, so render via authedImage instead.
  void _openProof(String url) {
    if (url.toLowerCase().endsWith('.pdf')) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('PDF proof — open the web dashboard to view it')));
      return;
    }
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        child: InteractiveViewer(
          child: Image(
            image: authedImage(ref, url),
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Padding(
              padding: EdgeInsets.all(24),
              child: Text('Could not load proof image'),
            ),
          ),
        ),
      ),
    );
  }

  void _review(ChitStaffPaymentIntent intent) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ReviewSheet(
        intent: intent,
        onDone: () {
          _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Payment proofs'), centerTitle: true),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('Pending')),
                ButtonSegment(value: false, label: Text('All')),
              ],
              selected: {_pendingOnly},
              onSelectionChanged: (s) {
                setState(() => _pendingOnly = s.first);
                _load();
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text('Failed to load: $_error'),
                        ),
                      )
                    : _intents.isEmpty
                        ? Center(
                            child: Text(
                              _pendingOnly
                                  ? 'No pending payment proofs.'
                                  : 'No payment proofs yet.',
                              style: AppTypography.body
                                  .copyWith(color: AppColors.textSecondary),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _intents.length,
                              itemBuilder: (context, i) => _IntentCard(
                                intent: _intents[i],
                                fmt: fmt,
                                onReview: _review,
                                onOpenProof: _openProof,
                              ),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _IntentCard extends StatelessWidget {
  const _IntentCard({
    required this.intent,
    required this.fmt,
    required this.onReview,
    required this.onOpenProof,
  });

  final ChitStaffPaymentIntent intent;
  final NumberFormat fmt;
  final void Function(ChitStaffPaymentIntent) onReview;
  final void Function(String url) onOpenProof;

  Color get _statusColor {
    if (intent.status == 'approved') return AppColors.success;
    if (intent.status == 'rejected') return AppColors.danger;
    return AppColors.warning;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${intent.memberName} · Ticket ${intent.ticketNo ?? '—'}',
                      style: AppTypography.body
                          .copyWith(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      '${intent.groupName}'
                      '${intent.periodNumber != null ? ' · Period ${intent.periodNumber}' : ''}'
                      ' · ${DateFormat('dd MMM, HH:mm').format(intent.createdAt.toLocal())}',
                      style: AppTypography.caption
                          .copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: _statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  intent.status,
                  style: AppTypography.tiny.copyWith(
                      fontWeight: FontWeight.w700, color: _statusColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 4,
            children: [
              _stat('Claimed',
                  intent.amount != null ? fmt.format(intent.amount) : '—'),
              _stat('Mode', intent.paymentMode),
              _stat('Ref', intent.referenceNo ?? '—'),
              if (intent.periodOutstanding != null)
                _stat('Due now', fmt.format(intent.periodOutstanding)),
            ],
          ),
          if (intent.isDuplicateReference) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '⚠ Reference number seen before — check for duplicate',
                style: AppTypography.tiny.copyWith(
                    fontWeight: FontWeight.w700, color: AppColors.warning),
              ),
            ),
          ],
          if (intent.status == 'rejected' && intent.rejectionReason != null) ...[
            const SizedBox(height: 6),
            Text('Reason: ${intent.rejectionReason}',
                style:
                    AppTypography.caption.copyWith(color: AppColors.danger)),
          ],
          if (intent.status == 'approved' && intent.receiptNo != null) ...[
            const SizedBox(height: 6),
            Text('Receipt: ${intent.receiptNo}',
                style:
                    AppTypography.caption.copyWith(color: AppColors.success)),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              if (intent.proofUrl != null)
                OutlinedButton.icon(
                  onPressed: () => onOpenProof(intent.proofUrl!),
                  icon: const Icon(Icons.image_outlined, size: 16),
                  label: const Text('View proof'),
                  style: OutlinedButton.styleFrom(
                      visualDensity: VisualDensity.compact),
                ),
              const Spacer(),
              if (intent.status == 'pending')
                FilledButton(
                  onPressed: () => onReview(intent),
                  style: FilledButton.styleFrom(
                      visualDensity: VisualDensity.compact),
                  child: const Text('Review'),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: AppTypography.tiny.copyWith(color: AppColors.textSecondary)),
        Text(value,
            style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _ReviewSheet extends ConsumerStatefulWidget {
  const _ReviewSheet({required this.intent, required this.onDone});
  final ChitStaffPaymentIntent intent;
  final VoidCallback onDone;

  @override
  ConsumerState<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends ConsumerState<_ReviewSheet> {
  late final TextEditingController _amountCtrl = TextEditingController(
    text: (widget.intent.amount ?? widget.intent.periodOutstanding ?? 0)
        .toStringAsFixed(0),
  );
  final TextEditingController _reasonCtrl = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _approve() async {
    final amount = double.tryParse(_amountCtrl.text) ?? 0;
    if (amount <= 0) {
      setState(() => _error = 'Enter a valid confirmed amount');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final receiptNo =
          await ref.read(chitServiceProvider).approvePaymentIntent(widget.intent.id, amount);
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onDone();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Approved — receipt ${receiptNo ?? ''}')),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<void> _reject() async {
    final reason = _reasonCtrl.text.trim();
    if (reason.isEmpty) {
      setState(() => _error = 'Enter a rejection reason');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(chitServiceProvider).rejectPaymentIntent(widget.intent.id, reason);
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onDone();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Payment proof rejected')));
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = ref.watch(currencyFmtProvider);
    final intent = widget.intent;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Review payment proof', style: AppTypography.sectionTitle),
          const SizedBox(height: 6),
          Text(
            '${intent.memberName} · ${intent.groupName}'
            '${intent.periodNumber != null ? ' · Period ${intent.periodNumber}' : ''}',
            style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
          ),
          if (intent.periodOutstanding != null)
            Text('Outstanding this period: ${fmt.format(intent.periodOutstanding)}',
                style: AppTypography.caption
                    .copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 14),
          TextField(
            controller: _amountCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Confirmed amount',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _reasonCtrl,
            decoration: const InputDecoration(
              labelText: 'Rejection reason (only for reject)',
              border: OutlineInputBorder(),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: AppTypography.caption.copyWith(color: AppColors.danger)),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : _reject,
                  style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger),
                  child: const Text('Reject'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: _busy ? null : _approve,
                  child: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Approve'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
