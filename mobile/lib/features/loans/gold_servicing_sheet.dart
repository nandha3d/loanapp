import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/gold_service.dart';

/// Gold pledge servicing on mobile — outstanding, interest due, redemption,
/// and the pay-interest / part-payment / redeem actions. Server computes all
/// money; this sheet just displays + posts.
class GoldServicingSheet extends ConsumerStatefulWidget {
  const GoldServicingSheet({super.key, required this.loanId});
  final String loanId;

  @override
  ConsumerState<GoldServicingSheet> createState() => _GoldServicingSheetState();
}

class _GoldServicingSheetState extends ConsumerState<GoldServicingSheet> {
  GoldServicingSummary? _s;
  bool _loading = true;
  String? _error;
  String? _busy;
  final _fmt =
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

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
      final s = await ref.read(goldServiceProvider).servicing(widget.loanId);
      if (mounted) {
        setState(() {
          _s = s;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _run(String action, double amount) async {
    if (_busy != null) return;
    final t = T.of(ref);
    if (action == 'redeem') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text(t.x('gold.redeem_pledge')),
          content: Text(
            '${_fmt.format(_s!.redemptionAmount)} - ${t.x('gold.redeem_prompt')}',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: Text(t.x('common.cancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: Text(t.x('gold.redeem')),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _busy = action);
    try {
      await ref
          .read(goldServiceProvider)
          .recordServicing(widget.loanId, action, amount);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scroll) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: _loading
              ? const SizedBox(
                  height: 240,
                  child: Center(child: CircularProgressIndicator()),
                )
              : _error != null
                  ? SizedBox(
                      height: 240,
                      child: Center(
                        child: Text(_error!, style: AppTypography.body),
                      ),
                    )
                  : _body(scroll),
        ),
      ),
    );
  }

  Widget _body(ScrollController scroll) {
    final t = T.of(ref);
    final s = _s!;
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
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
        Row(
          children: [
            Text('${t.x('gold.pledge_title')} · ${s.loanCode}',
                style: AppTypography.nameLg),
            const Spacer(),
            if (s.isClosed)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.success.withAlpha(28),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  t.x('gold.status.redeemed'),
                  style:
                      AppTypography.caption.copyWith(color: AppColors.success),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _kpi(t.x('gold.outstanding'), _fmt.format(s.outstandingPrincipal)),
            _kpi(t.x('gold.monthly_interest'), _fmt.format(s.monthlyInterest)),
            _kpi('${t.x('gold.interest_due')} (${s.monthsDue} mo)',
                _fmt.format(s.interestDue)),
            _kpi(t.x('gold.redemption'), _fmt.format(s.redemptionAmount)),
          ],
        ),
        if (!s.isClosed) ...[
          const SizedBox(height: 18),
          _actionBtn(
            t.x('gold.pay_interest'),
            _fmt.format(
              s.interestDue > 0 ? s.interestDue : s.monthlyInterest,
            ),
            AppColors.primary,
            _busy == 'interest',
            () => _run(
              'interest',
              (s.interestDue > 0 ? s.interestDue : s.monthlyInterest)
                  .toDouble(),
            ),
          ),
          const SizedBox(height: 10),
          _partPayRow(s),
          const SizedBox(height: 10),
          _actionBtn(
            t.x('gold.redeem_close'),
            _fmt.format(s.redemptionAmount),
            AppColors.danger,
            _busy == 'redeem',
            () => _run('redeem', s.redemptionAmount.toDouble()),
          ),
        ],
        if (s.payments.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text(
            t.x('gold.history'),
            style: AppTypography.label.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 6),
          ...s.payments.take(8).map(
                (p) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Text('${p['paymentType']}', style: AppTypography.body),
                      const Spacer(),
                      Text(
                        _fmt.format(p['amount'] ?? 0),
                        style: AppTypography.body
                            .copyWith(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ],
    );
  }

  Widget _kpi(String label, String value) => Container(
        width: 150,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: AppTypography.caption
                  .copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style:
                  AppTypography.bodyLarge.copyWith(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      );

  Widget _actionBtn(
    String label,
    String amount,
    Color color,
    bool busy,
    VoidCallback onTap,
  ) =>
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: color,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onPressed: busy ? null : onTap,
          child: busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2,
                  ),
                )
              : Text('$label · $amount'),
        ),
      );

  final _partCtrl = TextEditingController();
  Widget _partPayRow(GoldServicingSummary s) => Row(
        children: [
          Expanded(
            child: TextField(
              controller: _partCtrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: T.of(ref).x('gold.part_payment'),
                border: const OutlineInputBorder(),
              ),
            ),
          ),
          const SizedBox(width: 10),
          FilledButton.tonal(
            onPressed: _busy == 'part'
                ? null
                : () {
                    final amt = double.tryParse(_partCtrl.text) ?? 0;
                    if (amt > 0) _run('part', amt);
                  },
            child: _busy == 'part'
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(T.of(ref).x('gold.part_pay')),
          ),
        ],
      );

  @override
  void dispose() {
    _partCtrl.dispose();
    super.dispose();
  }
}
