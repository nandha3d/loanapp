import 'package:loantrack/features/collection/collection_screen.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/a11y/voice_assist.dart';
import 'package:loantrack/data/services/upload_service.dart';
import 'package:loantrack/features/collection/qr_scan_screen.dart';
import 'package:loantrack/core/gps/gps_service.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/l10n/app_strings.dart';
import 'package:loantrack/core/network/api_exception.dart';
import 'package:loantrack/core/network/authed_image.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/local/collection_queue.dart';
import 'package:loantrack/data/models/collection_entry.dart';
import 'package:loantrack/data/services/collection_service.dart';
import 'package:loantrack/data/services/payment_service.dart';
import 'package:loantrack/features/collection/voice_entry_controller.dart';
import 'package:loantrack/features/collection/voice_amount_parser.dart';

class QuickCollectSheet extends ConsumerStatefulWidget {
  const QuickCollectSheet({super.key, required this.row, this.scopeRows});
  final CollectionRow row;
  final List<CollectionRow>? scopeRows;

  @override
  ConsumerState<QuickCollectSheet> createState() => _QuickCollectSheetState();
}

class _QuickCollectSheetState extends ConsumerState<QuickCollectSheet> {
  late String _amount = '0';
  String _mode = 'cash';
  String _proofMode = 'cash'; // cash | photo | qr
  bool _submitting = false;
  String? _error;

  double _todayDue = 0;
  double _overdueDue = 0;
  CollectionRow? _todayInstalment;
  CollectionRow? _overdueInstalment;
  bool _selectedToday = true;
  List<CollectionRow> _customerRows = [];

  double get _value => double.tryParse(_amount) ?? 0;
  double get _totalDue => _todayDue + _overdueDue;

  @override
  void initState() {
    super.initState();
    _initCustomerDues();
  }

  void _initCustomerDues() {
    try {
      final rows = widget.scopeRows ??
          ref.read(collectionTodayProvider).value ??
          const <CollectionRow>[];
      // Scope to the tapped LOAN (not the whole customer) so a payment never
      // bleeds across a customer's separate loans — matches the web popup and
      // the server's loan-wide oldest-first distribution.
      _customerRows = rows
          .where((r) => r.loanId == widget.row.loanId && r.status != 'paid')
          .toList();

      final todayRows = _customerRows.where((r) => r.daysOverdue <= 0).toList();
      final overdueRows =
          _customerRows.where((r) => r.daysOverdue > 0).toList();

      _todayDue = todayRows.fold<double>(0.0, (s, r) => s + r.outstanding);
      _overdueDue = overdueRows.fold<double>(0.0, (s, r) => s + r.outstanding);

      if (todayRows.isNotEmpty) {
        _todayInstalment = todayRows.first;
      }
      if (overdueRows.isNotEmpty) {
        _overdueInstalment = overdueRows.first;
      }
    } catch (_) {}

    if (_todayDue == 0 && _overdueDue == 0) {
      if (widget.row.daysOverdue <= 0) {
        _todayDue = widget.row.outstanding;
        _todayInstalment = widget.row;
      } else {
        _overdueDue = widget.row.outstanding;
        _overdueInstalment = widget.row;
      }
      _customerRows = [widget.row];
    }

    // Default selection: today's due if there is one, else the full total
    // (pure overdue catch-up). The chosen card just presets the amount — the
    // payment is always distributed today-first (today's due → overdue
    // oldest-first → future) by the server.
    _selectedToday = _todayDue > 0;
    final defaultAmt = _selectedToday ? _todayDue : _totalDue;
    _amount = defaultAmt.round().toString();
  }

  void _onSelectToday(bool today) {
    setState(() {
      _selectedToday = today;
      _amount = (today ? _todayDue : _totalDue).round().toString();
    });
  }

  String _idempotencyKey(String instalmentId, double amount) {
    final today = DateTime.now();
    final date =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    // Amount is part of the key so two genuinely different partial payments to
    // the same instalment on the same day aren't mistaken for a duplicate retry.
    return '$date:$instalmentId:${amount.toStringAsFixed(2)}';
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

  /// Voice entry: listen, parse the spoken amount + mode into the form, then
  /// read it back for confirmation. Never auto-submits — the agent still taps
  /// Confirm. Synonyms come from i18n so they are translatable, not hardcoded.
  Future<void> _startVoiceEntry() async {
    final t = T.of(ref);
    final lang = ref.read(languageProvider).code;
    final modeSynonyms = <String, List<String>>{
      'cash': t.x('voice.kw.cash').split(','),
      'upi': t.x('voice.kw.upi').split(','),
      'bank': t.x('voice.kw.bank').split(','),
    };
    await ref.read(voiceEntryProvider.notifier).listen(
      lang,
      onFinal: (text) {
        final res = parseVoiceEntry(text, modeSynonyms: modeSynonyms);
        if (!mounted) return;
        setState(() {
          _error = null;
          if (res.hasAmount) _amount = res.amount!.round().toString();
          if (res.mode != null) _mode = res.mode!;
        });
        if (res.hasAmount) {
          final modeSpoken = res.mode != null ? ', ${res.mode}' : '';
          ref.speak('${_speakAmount(res.amount!)}$modeSpoken. ${t.x('voice.entry.confirm')}');
        } else {
          ref.speak(t.x('voice.entry.notUnderstood'));
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(t.x('voice.entry.notUnderstood'))),
          );
        }
      },
    );
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

    final today = DateTime.now();
    final sync = ref.read(collectionSyncProvider);
    final svc = ref.read(collectionServiceProvider);
    final queue = ref.read(collectionQueueProvider);

    try {
      final customerRows = _customerRows.isEmpty ? [widget.row] : _customerRows;

      // TODAY-FIRST allocation: today's due → overdue (oldest first) → future.
      // The server (`/collection/collect`) is the single source of truth for
      // this order; the same ordering here is used only to preset the OFFLINE
      // queue (per-instalment entries replayed when back online) and to cap
      // the amount at the total outstanding.
      final allocationOrder = [...customerRows]
        ..sort((a, b) {
          int bucket(CollectionRow r) =>
              r.daysOverdue == 0 ? 0 : (r.daysOverdue > 0 ? 1 : 2);
          final d = bucket(a) - bucket(b);
          if (d != 0) return d;
          return a.dueDate.compareTo(b.dueDate);
        });

      // Never collect more than the total outstanding across the loaded dues.
      final totalRoom = allocationOrder.fold<double>(
        0,
        (s, r) => s + (r.outstanding > 0 ? r.outstanding : 0),
      );
      double remaining = amt > totalRoom ? totalRoom : amt;

      final payments = <MapEntry<CollectionRow, double>>[];
      for (final inst in allocationOrder) {
        if (remaining <= 0) break;
        final outstandingAmt = inst.outstanding;
        if (outstandingAmt <= 0) continue;
        final toPay = remaining < outstandingAmt ? remaining : outstandingAmt;
        if (toPay > 0) {
          payments.add(MapEntry(inst, toPay));
          remaining -= toPay;
        }
      }

      if (payments.isEmpty) {
        setState(() {
          _submitting = false;
          _error = t.x('err.enter_valid_amount');
        });
        return;
      }

      // Actual total applied (input is capped at total outstanding above).
      final appliedTotal = payments.fold<double>(0, (s, p) => s + p.value);

      if (!sync.online) {
        for (final p in payments) {
          final inst = p.key;
          final pAmt = p.value;
          await queue.add(
            QueuedCollection(
              idempotencyKey: _idempotencyKey(inst.instalmentId, pAmt),
              instalmentId: inst.instalmentId,
              receivedAmount: pAmt,
              paymentMode: _mode,
              collectionDate: today,
              status: 'pending',
              customerName: widget.row.customerName,
              loanCode: widget.row.loanCode,
            ),
          );
        }
        await ref.read(collectionSyncProvider.notifier).refresh();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t.x('sync.saved_offline'))),
        );
        Navigator.of(context).pop();
        return;
      }

      // Best-effort device location capture. Short timeout + medium accuracy —
      // this blocks payment submission, and a full high-accuracy fix can take
      // 10s+ indoors; a coarse fix tagged on the entry is good enough.
      Map<String, dynamic>? gps;
      try {
        final pos = await ref.read(gpsServiceProvider).currentPosition(
              accuracy: LocationAccuracy.medium,
              timeout: const Duration(seconds: 4),
            );
        if (pos != null) {
          gps = {
            'status': 'captured',
            'lat': pos.latitude,
            'lng': pos.longitude,
            'accuracy': pos.accuracy,
            'altitude': pos.altitude,
            'timestamp': pos.timestamp.toIso8601String(),
            'isMocked': pos.isMocked,
          };
        } else {
          gps = {'status': 'not_captured'};
        }
      } catch (_) {
        gps = {'status': 'not_captured'};
      }

      // ONE loan-level submit — the server allocates today-first (today's due
      // → overdue oldest-first → future) inside a single transaction, so web
      // and mobile always record identical figures. No client-side splitting.
      try {
        // No client key — the server derives stable per-instalment keys from
        // (agent, instalment, amount, day), exactly like the web popup.
        await svc.collectLoan(
          loanId: widget.row.loanId,
          amount: appliedTotal,
          paymentMode: _mode,
          gps: gps,
        );
      } catch (e) {
        if (e is ApiException) rethrow;
        // Network error: queue the allocation offline (per-instalment entries,
        // same today-first order) to replay when back online.
        for (final p in payments) {
          await queue.add(
            QueuedCollection(
              idempotencyKey: _idempotencyKey(p.key.instalmentId, p.value),
              instalmentId: p.key.instalmentId,
              receivedAmount: p.value,
              paymentMode: _mode,
              collectionDate: today,
              status: 'pending',
              customerName: widget.row.customerName,
              loanCode: widget.row.loanCode,
            ),
          );
        }
        await ref.read(collectionSyncProvider.notifier).refresh();
        if (!mounted) return;
        setState(() => _error = '${t.x('sync.saved_offline_err')}: $e');
        return;
      }

      ref.speak('Collected ${_speakAmount(appliedTotal)}');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              '${t.x('msg.collected_from')} ₹${appliedTotal.round()} — ${widget.row.customerName}'),
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
        final targetInst = (_todayInstalment != null && _selectedToday)
            ? _todayInstalment!
            : (_overdueInstalment ?? widget.row);
        await queue.add(
          QueuedCollection(
            idempotencyKey: _idempotencyKey(targetInst.instalmentId, amt),
            instalmentId: targetInst.instalmentId,
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

  /// Photo proof: snap a photo, upload it, and file a request the client must
  /// approve in their portal. The loan is untouched until then.
  Future<void> _submitPhoto() async {
    final t = T.of(ref);
    final amt = _value;
    if (amt <= 0) {
      setState(() => _error = t.x('err.enter_valid_amount'));
      return;
    }
    final picker = ImagePicker();
    final shot = await picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1200,
      imageQuality: 75,
    );
    if (shot == null) return;

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final up = await ref
          .read(uploadServiceProvider)
          .uploadFile(File(shot.path), contentType: 'image/jpeg');
      final targetInst = (_todayInstalment != null && _selectedToday)
          ? _todayInstalment!
          : (_overdueInstalment ?? widget.row);
      await ref.read(collectionServiceProvider).submitPhotoProof(
            instalmentId: targetInst.instalmentId,
            amount: amt,
            paymentMode: _mode,
            photoUrl: up.url,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(t.x('proof.photo_sent')),
            backgroundColor: AppColors.success),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// QR proof: open the scanner; on a valid scan it auto-confirms and pops.
  Future<void> _scanQr() async {
    final t = T.of(ref);
    final done = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const QrScanScreen()),
    );
    if (done == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(t.x('proof.qr_done')),
            backgroundColor: AppColors.success),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);

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
              _SplitDueCards(
                todayDue: _todayDue,
                totalDue: _totalDue,
                selectedToday: _selectedToday,
                onSelectToday: _onSelectToday,
                fmt: fmt,
                t: t,
              ),
              const SizedBox(height: 14),
              _AmountDisplay(
                value: _value,
                totalDue: _totalDue,
                t: t,
              ),
              const SizedBox(height: 10),
              _VoiceEntryButton(
                listening: ref.watch(voiceEntryProvider).listening,
                transcript: ref.watch(voiceEntryProvider).transcript,
                onTap: _submitting ? null : _startVoiceEntry,
                t: t,
              ),
              const SizedBox(height: 12),
              _QuickAmountRow(
                outstanding: _selectedToday ? _todayDue : _totalDue,
                due: _selectedToday ? _todayDue : _totalDue,
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
              const SizedBox(height: 16),
              Text(
                t.x('proof.label'),
                style: AppTypography.label
                    .copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  for (final m in const ['cash', 'photo', 'qr'])
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: ChoiceChip(
                          label: Text(t.x('proof.$m')),
                          selected: _proofMode == m,
                          onSelected: (_) => setState(() => _proofMode = m),
                          selectedColor: AppColors.primaryLight,
                          labelStyle: TextStyle(
                            color: _proofMode == m
                                ? AppColors.primaryDark
                                : AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              if (_proofMode == 'qr') ...[
                const SizedBox(height: 8),
                Text(
                  t.x('proof.qr_help'),
                  style: AppTypography.caption
                      .copyWith(color: AppColors.textLight),
                ),
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
                  onPressed: _submitting
                      ? null
                      : (_proofMode == 'qr'
                          ? _scanQr
                          : _proofMode == 'photo'
                              ? _submitPhoto
                              : _submit),
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Icon(
                          _proofMode == 'qr'
                              ? Icons.qr_code_scanner_rounded
                              : _proofMode == 'photo'
                                  ? Icons.photo_camera_rounded
                                  : Icons.check_circle_outline_rounded,
                          color: Colors.white,
                        ),
                  label: Text(
                    _proofMode == 'qr'
                        ? t.x('proof.scan_btn')
                        : _proofMode == 'photo'
                            ? '${t.x('proof.photo_btn')} ${fmt.format(_value)}'
                            : '${t.x('coll.confirm_prefix')} ${fmt.format(_value)}',
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
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            row.customerName.isEmpty ? '—' : row.customerName[0].toUpperCase(),
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
    required this.totalDue,
    required this.t,
  });
  final double value, totalDue;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = ref.watch(currencyFmtProvider);
    final Color color;
    final String hint;

    // Amount is always applied today-first (today's due → overdue oldest-first
    // → future), so the only thing that matters is how much of the total it clears.
    if (value <= 0) {
      color = AppColors.textPrimary;
      hint = '${t.x('coll.outstanding_label')} ${fmt.format(totalDue)}';
    } else if (value >= totalDue) {
      color = AppColors.success;
      hint = t.x('coll.settles_full');
    } else {
      color = AppColors.info;
      hint =
          '${t.x('coll.partial_remaining')}: ${fmt.format(totalDue - value)}';
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
    final fmt = ref.watch(currencyFmtProvider);

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
        if (qr.qrUrl == null && qr.upiId == null)
          return const SizedBox.shrink();
        // mediaBaseUrlProvider respects the runtime server-URL override;
        // kDefaultBaseUrl is only the compile-time fallback.
        final imageUrl = qr.qrUrl != null
            ? absoluteMediaUrl(ref.watch(mediaBaseUrlProvider), qr.qrUrl)
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
                Image(
                  image: authedImage(ref, imageUrl),
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

// ───────────────────────────── Voice entry button ───────────────────

class _VoiceEntryButton extends StatelessWidget {
  const _VoiceEntryButton({
    required this.listening,
    required this.transcript,
    required this.onTap,
    required this.t,
  });
  final bool listening;
  final String transcript;
  final VoidCallback? onTap;
  final T t;

  @override
  Widget build(BuildContext context) {
    final color = listening ? AppColors.danger : AppColors.primary;
    final label = listening
        ? (transcript.isEmpty ? t.x('voice.entry.listening') : transcript)
        : t.x('voice.entry.start');
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color),
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        icon: Icon(listening ? Icons.mic : Icons.mic_none_rounded, color: color),
        label: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.bodyLarge.copyWith(color: color),
        ),
      ),
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

// ───────────────────────────── Split due cards ───────────────────────

class _SplitDueCards extends StatelessWidget {
  const _SplitDueCards({
    required this.todayDue,
    required this.totalDue,
    required this.selectedToday,
    required this.onSelectToday,
    required this.fmt,
    required this.t,
  });
  final double todayDue;
  final double totalDue;
  final bool selectedToday;
  final ValueChanged<bool> onSelectToday;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _DueCard(
            title: t.x('coll.btn_today'),
            amount: todayDue,
            selected: selectedToday,
            onTap: () => onSelectToday(true),
            fmt: fmt,
            activeColor: AppColors.primary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _DueCard(
            title: t.x('coll.total_due'),
            amount: totalDue,
            selected: !selectedToday,
            onTap: () => onSelectToday(false),
            fmt: fmt,
            activeColor: AppColors.danger,
          ),
        ),
      ],
    );
  }
}

class _DueCard extends StatelessWidget {
  const _DueCard({
    required this.title,
    required this.amount,
    required this.selected,
    required this.onTap,
    required this.fmt,
    required this.activeColor,
  });
  final String title;
  final double amount;
  final bool selected;
  final VoidCallback onTap;
  final NumberFormat fmt;
  final Color activeColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? activeColor.withAlpha(20) : AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? activeColor : AppColors.border,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w600,
                  color: selected ? activeColor : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                fmt.format(amount),
                style: AppTypography.bodyLarge.copyWith(
                  fontWeight: FontWeight.w800,
                  color:
                      amount > 0 ? AppColors.textPrimary : AppColors.textLight,
                  fontSize: 18,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
