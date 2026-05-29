import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/core/gps/gps_service.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/network/api_exception.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/local/collection_queue.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/services/collection_service.dart';
import 'package:loantrack/data/services/payment_service.dart';

class QuickCollectSheet extends ConsumerStatefulWidget {
  const QuickCollectSheet({super.key, required this.row});
  final CollectionRow row;

  @override
  ConsumerState<QuickCollectSheet> createState() => _QuickCollectSheetState();
}

class _QuickCollectSheetState extends ConsumerState<QuickCollectSheet> {
  late String _amount =
      widget.row.outstanding.round().toString();
  String _mode = 'cash';
  bool _submitting = false;
  String? _error;

  double get _value => double.tryParse(_amount) ?? 0;

  String _idempotencyKey() {
    final today = DateTime.now();
    final date =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    return '$date:${widget.row.instalmentId}';
  }

  void _press(String key) {
    setState(() {
      _error = null;
      if (key == 'C') {
        _amount = '0';
      } else if (key == '⌫') {
        if (_amount.length <= 1) {
          _amount = '0';
        } else {
          _amount = _amount.substring(0, _amount.length - 1);
        }
      } else if (key == '00') {
        if (_amount == '0') return;
        _amount = '$_amount${'00'}';
      } else {
        if (_amount == '0') {
          _amount = key;
        } else {
          _amount = '$_amount$key';
        }
      }
    });
  }

  void _quickSet(double v) {
    setState(() {
      _error = null;
      _amount = v.round().toString();
    });
    ref.speak('${_speakAmount(v)} entered');
  }

  Future<void> _submit() async {
    final t = T.of(ref);
    final amt = _value;
    if (amt <= 0) {
      setState(() => _error = t.x('err.enter_valid_amount'));
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
        await queue.add(
          QueuedCollection(
            idempotencyKey: key,
            instalmentId: widget.row.instalmentId,
            receivedAmount: amt,
            paymentMode: _mode,
            collectionDate: today,
            status: 'pending',
            customerName: widget.row.customerName,
            loanCode: widget.row.loanCode,
          ),
        );
        await ref.read(collectionSyncProvider.notifier).refresh();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t.x('sync.saved_offline'))),
        );
        Navigator.of(context).pop();
        return;
      }

      // Best-effort device location so the entry is geo-stamped + verified
      // server-side (same as web). Never blocks the collection if unavailable.
      Map<String, dynamic>? gps;
      try {
        final pos = await ref.read(gpsServiceProvider).currentPosition();
        if (pos != null) {
          gps = {
            'status': 'captured',
            'lat': pos.latitude,
            'lng': pos.longitude,
            'accuracy': pos.accuracy,
            'altitude': pos.altitude,
            'timestamp': pos.timestamp.toIso8601String(),
          };
        } else {
          gps = {'status': 'not_captured'};
        }
      } catch (_) {
        gps = {'status': 'not_captured'};
      }

      await svc.submit(
        instalmentId: widget.row.instalmentId,
        receivedAmount: amt,
        paymentMode: _mode,
        idempotencyKey: key,
        gps: gps,
      );

      ref.speak('Collected ${_speakAmount(amt)}');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${t.x('msg.collected_from')} ₹${amt.round()} — ${widget.row.customerName}'),
          backgroundColor: AppColors.success,
        ),
      );
      Navigator.of(context).pop();
    } catch (e) {
      final isServerReject = e is ApiException &&
          e.statusCode != null &&
          e.statusCode! >= 400 &&
          e.statusCode! < 500;
      if (isServerReject) {
        if (!mounted) return;
        setState(() => _error = e.message);
      } else {
        await queue.add(
          QueuedCollection(
            idempotencyKey: key,
            instalmentId: widget.row.instalmentId,
            receivedAmount: amt,
            paymentMode: _mode,
            collectionDate: today,
            status: 'pending',
            customerName: widget.row.customerName,
            loanCode: widget.row.loanCode,
          ),
        );
        await ref.read(collectionSyncProvider.notifier).refresh();
        if (!mounted) return;
        setState(() => _error = '${t.x('sync.saved_offline_err')}: $e');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );

    final due = widget.row.dueAmount;
    final outstanding = widget.row.outstanding;
    final isOver = _value > outstanding;
    final isPartial = _value > 0 && _value < outstanding;

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.6,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scroll) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              _HeaderRow(row: widget.row, fmt: fmt),
              const SizedBox(height: 14),
              _AmountDisplay(
                value: _value,
                outstanding: outstanding,
                isOver: isOver,
                isPartial: isPartial,
              ),
              const SizedBox(height: 12),
              _QuickAmountRow(
                outstanding: outstanding,
                due: due,
                onPick: _quickSet,
              ),
              const SizedBox(height: 16),
              _NumberPad(onPress: _press),
              const SizedBox(height: 18),
              Text(
                t.x('coll.payment_mode'),
                style: AppTypography.label.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              _ModeRow(
                mode: _mode,
                onChange: (m) => setState(() => _mode = m),
                t: t,
              ),
              if (_mode == 'upi') ...[
                const SizedBox(height: 14),
                _UpiQrSection(amount: _value),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline,
                        color: AppColors.danger,
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error!,
                          style: AppTypography.body.copyWith(
                            color: AppColors.dangerText,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(
                          Icons.check_circle_outline_rounded,
                          color: Colors.white,
                        ),
                  label: Text(
                    '${t.x('coll.confirm_prefix')} ${fmt.format(_value)}',
                    style: AppTypography.bigKey.copyWith(
                      color: Colors.white,
                      fontSize: 16,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Center(
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(t.x('common.cancel')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ───────────────────────────── Header row ───────────────────────────

class _HeaderRow extends ConsumerWidget {
  const _HeaderRow({required this.row, required this.fmt});
  final CollectionRow row;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    return Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: const BoxDecoration(
            color: AppColors.primaryLight,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            row.customerName.isEmpty
                ? '—'
                : row.customerName[0].toUpperCase(),
            style: AppTypography.heroLabel.copyWith(
              color: AppColors.primaryDark,
              fontSize: 18,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                row.customerName,
                style: AppTypography.nameLg,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                '${row.loanCode} • ${t.x('coll.due_label')} ${fmt.format(row.dueAmount)}',
                style: AppTypography.caption,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ───────────────────────────── Amount display ───────────────────────

class _AmountDisplay extends ConsumerWidget {
  const _AmountDisplay({
    required this.value,
    required this.outstanding,
    required this.isOver,
    required this.isPartial,
  });
  final double value, outstanding;
  final bool isOver, isPartial;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final Color color;
    final String hint;
    if (isOver) {
      color = AppColors.warning;
      hint = '${t.x('coll.above_outstanding')} ${fmt.format(outstanding)}';
    } else if (isPartial) {
      color = AppColors.info;
      hint =
          '${t.x('coll.partial_remaining')}: ${fmt.format(outstanding - value)}';
    } else if (value == outstanding && value > 0) {
      color = AppColors.success;
      hint = t.x('coll.settles_full');
    } else {
      color = AppColors.textPrimary;
      hint = '${t.x('coll.outstanding_label')} ${fmt.format(outstanding)}';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Column(
        children: [
          Text(
            fmt.format(value),
            style: AppTypography.heroNumber.copyWith(color: color),
          ),
          const SizedBox(height: 4),
          Text(
            hint,
            style: AppTypography.caption.copyWith(color: color),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────── Quick amounts ────────────────────────

class _QuickAmountRow extends ConsumerWidget {
  const _QuickAmountRow({
    required this.outstanding,
    required this.due,
    required this.onPick,
  });
  final double outstanding, due;
  final ValueChanged<double> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final half = (outstanding / 2).roundToDouble();
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Row(
      children: [
        Expanded(
          child: _Quick(
            label: t.x('coll.quick_full'),
            value: fmt.format(outstanding),
            color: AppColors.success,
            onTap: () => onPick(outstanding),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _Quick(
            label: t.x('coll.quick_half'),
            value: fmt.format(half),
            color: AppColors.info,
            onTap: () => onPick(half),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _Quick(
            label: t.x('coll.quick_due'),
            value: fmt.format(due),
            color: AppColors.warning,
            onTap: () => onPick(due),
          ),
        ),
      ],
    );
  }
}

class _Quick extends StatelessWidget {
  const _Quick({
    required this.label,
    required this.value,
    required this.color,
    required this.onTap,
  });
  final String label, value;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withAlpha(28),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          child: Column(
            children: [
              Text(
                label,
                style: AppTypography.tiny.copyWith(color: color),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: AppTypography.bodyLarge.copyWith(color: color),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ───────────────────────────── Number pad ───────────────────────────

class _NumberPad extends StatelessWidget {
  const _NumberPad({required this.onPress});
  final ValueChanged<String> onPress;

  @override
  Widget build(BuildContext context) {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['00', '0', '⌫'],
    ];
    return Column(
      children: [
        for (final row in keys) ...[
          Row(
            children: [
              for (final k in row) ...[
                Expanded(
                  child: _PadKey(label: k, onTap: () => onPress(k)),
                ),
                if (k != row.last) const SizedBox(width: 8),
              ],
            ],
          ),
          if (row != keys.last) const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _PadKey extends StatelessWidget {
  const _PadKey({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isBack = label == '⌫';
    return Material(
      color: isBack ? AppColors.background : AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          height: 58,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: isBack
              ? const Icon(
                  Icons.backspace_outlined,
                  color: AppColors.textSecondary,
                  size: 22,
                )
              : Text(
                  label,
                  style: AppTypography.bigKey.copyWith(
                    color: AppColors.textPrimary,
                  ),
                ),
        ),
      ),
    );
  }
}

// ───────────────────────────── Mode row ─────────────────────────────

class _ModeRow extends StatelessWidget {
  const _ModeRow({
    required this.mode,
    required this.onChange,
    required this.t,
  });
  final String mode;
  final ValueChanged<String> onChange;
  final T t;

  @override
  Widget build(BuildContext context) {
    final items = [
      (
        key: 'cash',
        label: t.x('coll.cash'),
        icon: Icons.payments_outlined,
        color: AppColors.success,
      ),
      (
        key: 'upi',
        label: t.x('coll.upi'),
        icon: Icons.qr_code_2_rounded,
        color: AppColors.info,
      ),
      (
        key: 'bank',
        label: t.x('coll.bank'),
        icon: Icons.account_balance_outlined,
        color: AppColors.purple,
      ),
    ];

    return Row(
      children: [
        for (final it in items) ...[
          Expanded(
            child: _ModeBtn(
              icon: it.icon,
              label: it.label,
              color: it.color,
              active: mode == it.key,
              onTap: () => onChange(it.key),
            ),
          ),
          if (it.key != items.last.key) const SizedBox(width: 8),
        ],
      ],
    );
  }
}

class _ModeBtn extends StatelessWidget {
  const _ModeBtn({
    required this.icon,
    required this.label,
    required this.color,
    required this.active,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? color : AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? color : AppColors.border),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 22,
                color: active ? Colors.white : color,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: AppTypography.bodyLarge.copyWith(
                  color: active ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ───────────────────────────── UPI QR section ───────────────────────

class _UpiQrSection extends ConsumerWidget {
  const _UpiQrSection({required this.amount});
  final double amount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final qrAsync = ref.watch(paymentQrProvider);
    return qrAsync.when(
      loading: () => const SizedBox(
        height: 48,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (qr) {
        if (qr.qrUrl == null && qr.upiId == null) return const SizedBox.shrink();
        final baseOrigin = Uri.parse(kDefaultBaseUrl)
            .replace(path: '', query: '')
            .toString()
            .replaceAll(RegExp(r'/$'), '');
        final imageUrl = qr.qrUrl != null
            ? (qr.qrUrl!.startsWith('http') ? qr.qrUrl! : '$baseOrigin${qr.qrUrl!}')
            : null;
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              if (imageUrl != null)
                Image.network(
                  imageUrl,
                  width: 180,
                  height: 180,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(
                    Icons.qr_code_2_rounded,
                    size: 80,
                    color: AppColors.textSecondary,
                  ),
                ),
              if (qr.upiId != null) ...[
                const SizedBox(height: 10),
                Text(
                  qr.upiId!,
                  style: AppTypography.body.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  t.x('coll.scan_to_pay'),
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

// ───────────────────────────── Voice helper ─────────────────────────

String _speakAmount(double amount) {
  if (amount <= 0) return 'zero rupees';
  final rounded = amount.round();
  if (rounded >= 100000) {
    final l = (amount / 100000).toStringAsFixed(2);
    return '$l lakh rupees';
  }
  if (rounded >= 1000) {
    final k = (amount / 1000).toStringAsFixed(1);
    return '$k thousand rupees';
  }
  return '$rounded rupees';
}
