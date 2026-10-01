import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/collection_run.dart';
import 'package:zolofund/data/services/collection_run_service.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

final _sheetProvider =
    FutureProvider.autoDispose.family<RunSheet, String>((ref, runId) {
  return ref.watch(collectionRunServiceProvider).fetchSheet(runId);
});

/// mCollect-A — batch collection sheet for a route run.
class RunSheetScreen extends ConsumerStatefulWidget {
  const RunSheetScreen({super.key, required this.runId});
  final String runId;

  @override
  ConsumerState<RunSheetScreen> createState() => _RunSheetScreenState();
}

/// One row per loan (not per instalment) — a loan with several missed dues
/// shows as a single stop with a total, like the default collection process.
class _LoanGroup {
  _LoanGroup(this.rows);
  final List<RunSheetRow> rows;

  String get key => '${rows.first.customerId}|${rows.first.loanCode}';
  RunSheetRow get primary => rows.first;
  double get totalOutstanding =>
      rows.fold(0.0, (s, r) => s + r.outstanding);
  int get maxDaysOverdue =>
      rows.fold(0, (m, r) => r.daysOverdue > m ? r.daysOverdue : m);
  bool get overdue => rows.any((r) => r.overdue);

  /// Rows in the server's MONEY-10 order (today's due first, then overdue
  /// oldest-first) from GET /api/v1/collection/run/:id/sheet.
  List<RunSheetRow> get serverOrder => rows;
}

List<_LoanGroup> _groupByLoan(List<RunSheetRow> rows) {
  final byKey = <String, List<RunSheetRow>>{};
  for (final r in rows) {
    byKey.putIfAbsent('${r.customerId}|${r.loanCode}', () => []).add(r);
  }
  return byKey.values.map(_LoanGroup.new).toList(growable: false);
}

class _RunSheetScreenState extends ConsumerState<RunSheetScreen> {
  final Map<String, TextEditingController> _amounts = {};
  final Map<String, String> _modes = {};
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _amounts.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _ctrl(String id) =>
      _amounts.putIfAbsent(id, () => TextEditingController());

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.danger : AppColors.success,
      ),
    );
  }

  Future<void> _collect(List<_LoanGroup> groups) async {
    final lines = <Map<String, dynamic>>[];
    for (final g in groups) {
      var remaining = double.tryParse(_ctrl(g.key).text.trim()) ?? 0;
      if (remaining <= 0) continue;
      final mode = _modes[g.key] ?? 'cash';
      for (final r in g.serverOrder) {
        if (remaining <= 0) break;
        final toPay = remaining < r.outstanding ? remaining : r.outstanding;
        if (toPay <= 0) continue;
        lines.add({
          'instalmentId': r.instalmentId,
          'receivedAmount': toPay,
          'paymentMode': mode,
        });
        remaining -= toPay;
      }
    }
    if (lines.isEmpty) {
      _snack('Enter at least one amount', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await ref
          .read(collectionRunServiceProvider)
          .collect(widget.runId, lines);
      _snack(
          'Posted ${res.posted}${res.skipped > 0 ? ', ${res.skipped} skipped' : ''}',);
      for (final g in groups) {
        _ctrl(g.key).clear();
      }
      ref.invalidate(_sheetProvider(widget.runId));
    } catch (e) {
      _snack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _close() async {
    setState(() => _busy = true);
    try {
      await ref.read(collectionRunServiceProvider).close(widget.runId);
      ref.invalidate(_sheetProvider(widget.runId));
      _snack('Run closed — deposit cash on Cash Float');
    } catch (e) {
      _snack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendPayLink(_LoanGroup g) async {
    try {
      final url = await ref
          .read(collectionRunServiceProvider)
          .selfPayLink(g.serverOrder.first.instalmentId);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        builder: (ctx) => _PayLinkSheet(name: g.primary.name, url: url),
      );
    } catch (e) {
      _snack(e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sheetAsync = ref.watch(_sheetProvider(widget.runId));
    final fmt = ref.watch(currencyFmtProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Run Sheet'), centerTitle: true),
      body: sheetAsync.when(
        loading: () => const Padding(
            padding: EdgeInsets.all(16), child: Skeleton(height: 320),),
        error: (e, _) => Center(
          child: Text(e.toString(),
              style: AppTypography.body.copyWith(color: AppColors.danger),),
        ),
        data: (sheet) {
          final run = sheet.run;
          final groups = _groupByLoan(sheet.rows);
          return Column(
            children: [
              _Header(run: run, fmt: fmt),
              Expanded(
                child: run.isLocked
                    ? _SettleRun(run: run, fmt: fmt)
                    : groups.isEmpty
                        ? const EmptyState(
                            icon: Icons.check_circle_outline_rounded,
                            title: 'Nothing due on this route',)
                        : ListView.builder(
                            padding: const EdgeInsets.all(12),
                            itemCount: groups.length,
                            itemBuilder: (_, i) => _GroupTile(
                              group: groups[i],
                              fmt: fmt,
                              amountCtrl: _ctrl(groups[i].key),
                              mode: _modes[groups[i].key] ?? 'cash',
                              onMode: (String m) =>
                                  setState(() => _modes[groups[i].key] = m),
                              onFill: () => setState(() {
                                _ctrl(groups[i].key).text = groups[i]
                                    .totalOutstanding
                                    .toStringAsFixed(2);
                              }),
                              onPayLink: () => _sendPayLink(groups[i]),
                            ),
                          ),
              ),
              // RUN-01: a run can be closed even when nothing is left to collect.
              if (!run.isLocked)
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _busy || groups.isEmpty ? null : () => _collect(groups),
                            icon: const Icon(Icons.check_rounded),
                            label: Text(_busy ? 'Posting…' : 'Collect'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton(
                          onPressed: _busy ? null : _close,
                          child: const Text('Close run'),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.run, required this.fmt});
  final CollectionRun run;
  final NumberFormat fmt;

  @override
  Widget build(BuildContext context) {
    Widget stat(String label, String value, [Color? c]) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTypography.caption),
            Text(value,
                style: AppTypography.bodyLarge.copyWith(
                    fontWeight: FontWeight.w800,
                    color: c ?? AppColors.textPrimary,),),
          ],
        );
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      color: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Run · ${run.day}', style: AppTypography.sectionTitle),
              Chip(
                label: Text(run.status, style: AppTypography.caption),
                backgroundColor: AppColors.primaryLight,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 22,
            runSpacing: 10,
            children: [
              stat('Expected', fmt.format(run.expectedTotal)),
              stat('Collected', fmt.format(run.collectedTotal),
                  AppColors.success,),
              stat('Cash', fmt.format(run.cashCollected)),
              stat('Digital', fmt.format(run.digitalCollected)),
              stat('Stops', '${run.stopsCollected}/${run.stopsExpected}'),
            ],
          ),
        ],
      ),
    );
  }
}

class _GroupTile extends StatelessWidget {
  const _GroupTile({
    required this.group,
    required this.fmt,
    required this.amountCtrl,
    required this.mode,
    required this.onMode,
    required this.onFill,
    required this.onPayLink,
  });
  final _LoanGroup group;
  final NumberFormat fmt;
  final TextEditingController amountCtrl;
  final String mode;
  final ValueChanged<String> onMode;
  final VoidCallback onFill;
  final VoidCallback onPayLink;

  @override
  Widget build(BuildContext context) {
    final row = group.primary;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(row.name, style: AppTypography.bodyLarge),
                    Text(
                        group.rows.length > 1
                            ? '${row.loanCode} · ${group.rows.length} dues'
                            : '${row.loanCode} · #${row.instalmentNo}',
                        style: AppTypography.caption,),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(fmt.format(group.totalOutstanding),
                      style: AppTypography.bodyLarge
                          .copyWith(fontWeight: FontWeight.w700),),
                  if (group.overdue)
                    Text('overdue ${group.maxDaysOverdue}d',
                        style: AppTypography.caption
                            .copyWith(color: AppColors.danger),),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: amountCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Amount',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButton<String>(
                value: mode,
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Cash')),
                  DropdownMenuItem(value: 'upi', child: Text('UPI')),
                  DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
                ],
                onChanged: (v) => onMode(v ?? 'cash'),
              ),
              IconButton(
                tooltip: 'Fill due',
                onPressed: onFill,
                icon: Icon(Icons.bolt_rounded, color: AppColors.primary),
              ),
              IconButton(
                tooltip: 'Send pay link',
                onPressed: onPayLink,
                icon:
                    const Icon(Icons.qr_code_2_rounded, color: AppColors.info),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Run closed → declare the cash handed in and reconcile through the same
/// server path as web (reconcileRun): one deposit, variance raised for
/// approval, run marked reconciled (MON-02).
class _SettleRun extends ConsumerStatefulWidget {
  const _SettleRun({required this.run, required this.fmt});
  final CollectionRun run;
  final NumberFormat fmt;

  @override
  ConsumerState<_SettleRun> createState() => _SettleRunState();
}

class _SettleRunState extends ConsumerState<_SettleRun> {
  late final _amount =
      TextEditingController(text: widget.run.cashCollected.toStringAsFixed(2));
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _reconcile() async {
    final amt = double.tryParse(_amount.text.trim());
    if (amt == null || amt < 0) {
      setState(() => _error = T.of(ref).x('err.enter_valid_amount'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(collectionRunServiceProvider)
          .reconcile(widget.run.id, cashDeposited: amt);
      ref.invalidate(_sheetProvider(widget.run.id));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final run = widget.run;
    final fmt = widget.fmt;
    final reconciled = run.status == 'reconciled';
    final variance = run.varianceAmount ?? 0;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(t.x(reconciled ? 'run.reconciled' : 'run.closed'),
            style: AppTypography.sectionTitle,),
        const SizedBox(height: 10),
        Text('${t.x('run.cash_collected')}: ${fmt.format(run.cashCollected)}',
            style: AppTypography.bodyLarge,),
        const SizedBox(height: 12),
        if (reconciled) ...[
          Text(
              '${t.x('run.cash_deposited')}: ${fmt.format(run.cashDeposited ?? 0)}',
              style: AppTypography.bodyLarge,),
          const SizedBox(height: 6),
          Text('${t.x('run.variance')}: ${fmt.format(variance)}',
              style: AppTypography.bodyLarge.copyWith(
                color: variance == 0 ? AppColors.textPrimary : AppColors.danger,
              ),),
        ] else ...[
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: t.x('run.cash_deposited')),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: AppTypography.caption.copyWith(color: AppColors.danger),),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _busy ? null : _reconcile,
            icon: const Icon(Icons.account_balance_rounded),
            label: Text(t.x('run.reconcile')),
          ),
        ],
      ],
    );
  }
}

class _PayLinkSheet extends StatelessWidget {
  const _PayLinkSheet({required this.name, required this.url});
  final String name;
  final String url;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Pay link · $name', style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            SelectableText(url, style: AppTypography.body),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: url));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Link copied')),
                      );
                    },
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Copy'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () {
                      final wa = Uri.parse(
                          'https://wa.me/?text=${Uri.encodeComponent('Pay here: $url')}',);
                      launchUrl(wa, mode: LaunchMode.externalApplication);
                    },
                    icon: const Icon(Icons.share_rounded),
                    label: const Text('Share'),
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
