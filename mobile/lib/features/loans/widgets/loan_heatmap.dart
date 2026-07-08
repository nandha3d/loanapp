import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/instalment.dart';

/// Mobile port of the web "Calendar Tracker" heatmap.
///
/// Renders one colored cell per instalment in a wrap-grid:
///  • paid    → success green
///  • partial → warning amber
///  • missed  → danger red
///  • upcoming/other → neutral gray
///
/// Tap a cell → bottom sheet with that instalment's details
/// (and an optional `onJump` callback to scroll the schedule list).
class LoanHeatmap extends ConsumerWidget {
  const LoanHeatmap({
    super.key,
    required this.instalments,
    this.cellSize = 22,
    this.onJump,
    this.title = 'Calendar Tracker',
    this.extraPeriods = 0,
    this.projectedEndDate,
  });

  final List<Instalment> instalments;
  final double cellSize;
  final String title;
  final void Function(int instalmentNo)? onJump;

  /// Extra periods projected beyond the original schedule if the loan keeps
  /// paying at the normal per-instalment rate instead of restructuring —
  /// same figure as web's "extend term" default model.
  final int extraPeriods;
  final DateTime? projectedEndDate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
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
              Row(
                children: [
                  const Icon(
                    Icons.calendar_view_month_rounded,
                    size: 18,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: 8),
                  Text(title, style: AppTypography.sectionTitle),
                ],
              ),
              Text(
                '${instalments.length}',
                style: AppTypography.caption,
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (instalments.isEmpty)
            SizedBox(
              height: 60,
              child: Center(
                child: Text(
                  t.x('loan.no_instalments'),
                  style: const TextStyle(color: AppColors.textLight),
                ),
              ),
            )
          else
            Wrap(
              spacing: 5,
              runSpacing: 5,
              children: [
                for (final inst in instalments)
                  _HeatCell(
                    inst: inst,
                    size: cellSize,
                    onTap: () => _open(context, inst),
                  ),
                for (var i = 0; i < extraPeriods; i++)
                  _ExtraDayCell(size: cellSize, dayNumber: i + 1),
              ],
            ),
          if (extraPeriods > 0) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFC7D2FE).withAlpha(60),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.trending_up_rounded,
                      size: 15, color: Color(0xFF6366F1),),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      projectedEndDate == null
                          ? '+$extraPeriods extra ${extraPeriods == 1 ? 'day' : 'days'} projected at the current pace'
                          : '+$extraPeriods extra ${extraPeriods == 1 ? 'day' : 'days'} · projected finish ${DateFormat('d MMM yyyy').format(projectedEndDate!)}',
                      style: AppTypography.caption
                          .copyWith(color: const Color(0xFF4F46E5)),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          _Legend(t: t),
        ],
      ),
    );
  }

  void _open(BuildContext context, Instalment inst) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _InstSheet(
        inst: inst,
        onJump: onJump == null
            ? null
            : () {
                Navigator.of(context).pop();
                onJump!(inst.instalmentNo);
              },
      ),
    );
  }
}

class _HeatCell extends StatelessWidget {
  const _HeatCell({
    required this.inst,
    required this.size,
    required this.onTap,
  });
  final Instalment inst;
  final double size;
  final VoidCallback onTap;

  Color get _bg {
    switch (inst.dynamicStatus) {
      case 'paid':
        return AppColors.success;
      case 'partial':
        return AppColors.warning;
      case 'missed':
        return AppColors.danger;
      case 'due_today':
        return AppColors.primary;
      default:
        return AppColors.border;
    }
  }

  @override
  Widget build(BuildContext context) {
    final ds = inst.dynamicStatus;
    return Semantics(
      label:
          'Instalment ${inst.instalmentNo}, $ds, due ${DateFormat('d MMM').format(inst.dueDate)}',
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: _bg,
            borderRadius: BorderRadius.circular(4),
          ),
          alignment: Alignment.center,
          child: ds == 'paid'
              ? const Icon(Icons.check, color: Colors.white, size: 12)
              : ds == 'missed'
                  ? const Icon(
                      Icons.priority_high,
                      color: Colors.white,
                      size: 12,
                    )
                  : ds == 'due_today'
                      ? const Icon(
                          Icons.today,
                          color: Colors.white,
                          size: 12,
                        )
                      : null,
        ),
      ),
    );
  }
}

/// A projected "extend term" tail day — not a real instalment yet, just how
/// many extra periods the loan will need beyond its original schedule if it
/// keeps paying at the normal rate. Matches web's dashed indigo cells.
class _ExtraDayCell extends StatelessWidget {
  const _ExtraDayCell({required this.size, required this.dayNumber});
  final double size;
  final int dayNumber;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Extended day $dayNumber, projected',
      child: Tooltip(
        message: 'Extended day — projected, not yet scheduled',
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: const Color(0xFFC7D2FE).withAlpha(90),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(
              color: const Color(0xFF6366F1),
              width: 1,
              style: BorderStyle.solid,
            ),
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.t});
  final T t;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 14,
      runSpacing: 6,
      children: [
        _LegendDot(color: AppColors.success, label: t.x('loan.legend_paid')),
        _LegendDot(color: AppColors.warning, label: t.x('loan.legend_partial')),
        _LegendDot(color: AppColors.danger, label: t.x('loan.legend_missed')),
        _LegendDot(color: AppColors.primary, label: t.x('loan.legend_due_today')),
        _LegendDot(color: AppColors.border, label: t.x('loan.legend_upcoming')),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration:
              BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
        ),
        const SizedBox(width: 6),
        Text(label, style: AppTypography.caption),
      ],
    );
  }
}

class _InstSheet extends ConsumerWidget {
  const _InstSheet({required this.inst, required this.onJump});
  final Instalment inst;
  final VoidCallback? onJump;

  Color get _statusColor {
    switch (inst.dynamicStatus) {
      case 'paid':
        return AppColors.success;
      case 'partial':
        return AppColors.warning;
      case 'missed':
        return AppColors.danger;
      case 'due_today':
        return AppColors.primary;
      default:
        return AppColors.textLight;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final dateFmt = DateFormat('EEE, d MMM yyyy');
    final timeFmt = DateFormat('h:mm a');

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: _statusColor.withAlpha(36),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '#${inst.instalmentNo}',
                    style: AppTypography.bodyLarge
                        .copyWith(color: _statusColor),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${t.x('loan.instalment_n')} ${inst.instalmentNo}',
                        style: AppTypography.sectionTitle,
                      ),
                      Text(
                        dateFmt.format(inst.dueDate),
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: _statusColor.withAlpha(36),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    inst.dynamicStatus.toUpperCase(),
                    style: AppTypography.tiny.copyWith(color: _statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            _Row(label: t.x('loan.expected'), value: fmt.format(inst.dueAmount)),
            _Row(
              label: t.x('loan.collected'),
              value: fmt.format(inst.receivedAmount),
              valueColor: inst.receivedAmount > 0
                  ? AppColors.success
                  : AppColors.textLight,
            ),
            if (inst.paidAt != null)
              _Row(
                label: t.x('loan.paid_at'),
                value:
                    '${dateFmt.format(inst.paidAt!)} • ${timeFmt.format(inst.paidAt!)}',
              ),
            if (inst.paymentMode != null && inst.paymentMode!.isNotEmpty)
              _Row(label: t.x('loan.mode'), value: inst.paymentMode!.toUpperCase()),
            if (onJump != null) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: onJump,
                  icon: const Icon(Icons.arrow_downward_rounded),
                  label: Text(
                    t.x('loan.jump_to_row'),
                    style: AppTypography.actionLabel
                        .copyWith(color: Colors.white),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.valueColor});
  final String label, value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppTypography.body)),
          Text(
            value,
            style: AppTypography.bodyLarge.copyWith(color: valueColor),
          ),
        ],
      ),
    );
  }
}
