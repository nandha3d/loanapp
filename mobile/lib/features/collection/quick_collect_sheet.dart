import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/local/collection_queue.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/services/collection_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class QuickCollectSheet extends ConsumerStatefulWidget {
  const QuickCollectSheet({super.key, required this.row});
  final CollectionRow row;

  @override
  ConsumerState<QuickCollectSheet> createState() => _QuickCollectSheetState();
}

class _QuickCollectSheetState extends ConsumerState<QuickCollectSheet> {
  late final TextEditingController _amount =
      TextEditingController(text: widget.row.outstanding.toStringAsFixed(0));
  String _mode = 'cash';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  String _idempotencyKey() {
    final today = DateTime.now();
    final date = '${today.year}-${today.month.toString().padLeft(2, '0')}-'
        '${today.day.toString().padLeft(2, '0')}';
    return '$date:${widget.row.instalmentId}';
  }

  Future<void> _submit() async {
    final amt = double.tryParse(_amount.text);
    if (amt == null || amt <= 0) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });

    final key = _idempotencyKey();
    final today = DateTime.now();
    final sync = ref.read(collectionSyncProvider);
    final svc = ref.read(collectionServiceProvider);
    final queue = ref.read(collectionQueueProvider);

    try {
      if (!sync.online) {
        // Queue offline.
        await queue.add(QueuedCollection(
          idempotencyKey: key,
          instalmentId: widget.row.instalmentId,
          receivedAmount: amt,
          paymentMode: _mode,
          collectionDate: today,
          status: 'pending',
          customerName: widget.row.customerName,
          loanCode: widget.row.loanCode,
        ));
        await ref.read(collectionSyncProvider.notifier).refresh();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved offline — will sync')),
        );
        Navigator.of(context).pop();
        return;
      }

      if (_mode == 'upi') {
        final amount = amt.toStringAsFixed(2);
        final uri = Uri.parse(
          'upi://pay?pa=merchant@upi&pn=LoanTrack&am=$amount&tn=${widget.row.loanCode}',
        );
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }

      await svc.submit(
        instalmentId: widget.row.instalmentId,
        receivedAmount: amt,
        paymentMode: _mode,
        idempotencyKey: key,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Collection recorded')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      // Fall back to queue on network error.
      await queue.add(QueuedCollection(
        idempotencyKey: key,
        instalmentId: widget.row.instalmentId,
        receivedAmount: amt,
        paymentMode: _mode,
        collectionDate: today,
        status: 'pending',
        customerName: widget.row.customerName,
        loanCode: widget.row.loanCode,
      ));
      await ref.read(collectionSyncProvider.notifier).refresh();
      if (!mounted) return;
      setState(() => _error = 'Saved offline: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          Text('Collect Payment', style: AppTypography.sectionTitle),
          const SizedBox(height: 4),
          Text(
            '${widget.row.customerName} • ${widget.row.loanCode}',
            style: AppTypography.caption,
          ),
          const SizedBox(height: 4),
          Text('Due ${fmt.format(widget.row.dueAmount)}',
              style: AppTypography.caption),
          const SizedBox(height: 20),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: AppTypography.display.copyWith(
                color: AppColors.textPrimary,
                fontFamily: 'monospace',
                fontSize: 14 * 1.6),
            decoration: const InputDecoration(
              prefixText: '₹ ',
              prefixStyle: TextStyle(
                color: AppColors.primary,
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
              border: UnderlineInputBorder(),
              focusedBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: AppColors.primary, width: 2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Payment Mode', style: AppTypography.label),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'cash', label: Text('Cash')),
              ButtonSegment(value: 'upi', label: Text('UPI')),
              ButtonSegment(value: 'bank', label: Text('Bank')),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() => _mode = s.first),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.dangerBg,
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
              child: Text(_error!,
                  style: AppTypography.bodySmall
                      .copyWith(color: AppColors.dangerText)),
            ),
          ],
          const SizedBox(height: 20),
          AppButton(
            label: 'Confirm Collection',
            expand: true,
            loading: _submitting,
            onPressed: _submit,
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }
}
